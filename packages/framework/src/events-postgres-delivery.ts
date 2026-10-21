import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { McpEventsOptions } from './events.js';
import { normalizeMcpEventDefinitions, mcpEventSubscriptionIdentity, validateMcpEventSubscription } from './events.js';
import { ExternalMcpEventError, type ExternalMcpEventInvocation } from './events-external.js';
import { postCheckedWebhook, signWebhook } from './events-webhook.js';
import type { OwnedEventPool, EventSql } from './events-postgres-owned.js';
import { createDeliverySessionOwner } from './events-postgres-delivery-owned.js';
export {
  createPostgresEventDeliveryMigrator,
  PostgresEventDeliveryMigrationError,
} from './events-postgres-delivery-migrations.js';
export interface PostgresEventDeliveryOptions {
  readonly namespace:string;readonly pool:OwnedEventPool;
  readonly definitions:McpEventsOptions['definitions'];readonly authorize:McpEventsOptions['authorize'];
}
export type PostgresEventDeliveryOutcome =
  | Readonly<{outcome:'terminal';reason:'callback_accepted'|'suppressed'|'gone'|'too_large'|'attempts_exhausted'|'missing'}>
  | Readonly<{outcome:'retry_pending';reason:'leased'|'not_due'|'callback_failed'|'unavailable'|'deadline'|'aborted'|'stopping'|'unknown_outcome'}>;
export interface PostgresEventDelivery {
  deliver(deliveryId:string,invocation:ExternalMcpEventInvocation):Promise<PostgresEventDeliveryOutcome>;
  settle(invocation:ExternalMcpEventInvocation):Promise<boolean>;
}
type Row=Record<string,unknown>;
const columns='namespace,source_kind,source_id,subscription_id,generation';
const predicate='namespace=$1 AND source_kind=$2 AND source_id=$3 AND subscription_id=$4 AND generation=$5';
const values=(k:Row)=>[k.namespace,k.source_kind,k.source_id,k.subscription_id,k.generation];
const dbTime=`pg_catalog.floor(EXTRACT(epoch FROM pg_catalog.clock_timestamp())*1000)::pg_catalog.float8`;
const terminal=(reason:Extract<PostgresEventDeliveryOutcome,{outcome:'terminal'}>['reason']):PostgresEventDeliveryOutcome=>({outcome:'terminal',reason});
const retry=(reason:Extract<PostgresEventDeliveryOutcome,{outcome:'retry_pending'}>['reason']):PostgresEventDeliveryOutcome=>({outcome:'retry_pending',reason});
const unavailable=():never=>{throw new ExternalMcpEventError('UNAVAILABLE');};
function identifier(value:unknown):string {
  if(typeof value!=='string'||!value||Buffer.byteLength(value)>240||/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))throw new ExternalMcpEventError('INVALID_INPUT');
  return value;
}
function canonical(value:unknown,depth=0):unknown {
  if(depth>32)return unavailable();
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
  if(Array.isArray(value))return Object.freeze(value.map(v=>canonical(v,depth+1)));
  if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)return unavailable();
  const result:Record<string,unknown>=Object.create(null);
  for(const key of Object.keys(value).sort())result[key]=canonical((value as Row)[key],depth+1);
  return Object.freeze(result);
}
function acceptedOrTerminal(value:unknown):PostgresEventDeliveryOutcome|null {
  if(value===null)return null;
  const reasons:Record<string,Extract<PostgresEventDeliveryOutcome,{outcome:'terminal'}>['reason']>={accepted:'callback_accepted',suppressed:'suppressed',gone:'gone',too_large:'too_large',exhausted:'attempts_exhausted'};
  if(typeof value!=='string'||!Object.hasOwn(reasons,value))return unavailable();
  return terminal(reasons[value]!);
}
/** Call this API only from an authenticated worker service. It creates no HTTP
 * route, timer, provider job, or automatic delivery.
 */
export function createPostgresEventDelivery(options:PostgresEventDeliveryOptions):PostgresEventDelivery {
  return createPostgresEventDeliveryRuntime(options);
}
/** Internal test seam: production uses the checked transport above. */
export function createPostgresEventDeliveryRuntime(options:PostgresEventDeliveryOptions,send:typeof postCheckedWebhook=postCheckedWebhook):PostgresEventDelivery {
  const namespace=identifier(options?.namespace);
  if(!options.pool||typeof options.pool.connect!=='function'||typeof options.authorize!=='function'||!Array.isArray(options.definitions)||!options.definitions.length)throw new ExternalMcpEventError('INVALID_INPUT');
  const definitions=normalizeMcpEventDefinitions(options.definitions),owner=createDeliverySessionOwner(options.pool);
  let closing=false,busy=false;
  async function lock(run:EventSql,k:Row) {
    await run('SELECT revision FROM public.emseepea_event_heads WHERE namespace=$1 AND subscription_id=$2 FOR UPDATE',[namespace,k.subscription_id]);
    const intent=(await run(`SELECT state,event_id FROM public.emseepea_event_intents WHERE ${predicate} FOR UPDATE`,values(k))).rows[0];
    if(!intent)return null;
    await run(`INSERT INTO public.emseepea_event_delivery_state(${columns}) VALUES($1,$2,$3,$4,$5) ON CONFLICT(${columns}) DO NOTHING`,values(k));
    const row=(await run(`SELECT reservations,lease_id,terminal,
      pg_catalog.floor(EXTRACT(epoch FROM lease_until)*1000)::pg_catalog.float8 AS lease_until,
      pg_catalog.floor(EXTRACT(epoch FROM due_at)*1000)::pg_catalog.float8 AS due_at
      FROM public.emseepea_event_delivery_state WHERE ${predicate} FOR UPDATE`,values(k))).rows[0];
    if(!row)return unavailable();
    row.now=(await run(`SELECT ${dbTime} AS now`)).rows[0]?.now;
    if(!Number.isSafeInteger(row.now)||!Number.isInteger(row.reservations)||Number(row.reservations)<0||Number(row.reservations)>4)return unavailable();
    return {intent,row};
  }
  async function snapshot(run:EventSql,k:Row,includeKeys:boolean):Promise<Row|null> {
    const keySelect=includeKeys?',key.secret,key.previous_secret,pg_catalog.floor(EXTRACT(epoch FROM key.previous_until)*1000)::pg_catalog.float8 AS previous_until':'';
    const keyJoin=includeKeys?'JOIN public.emseepea_event_keys key ON key.namespace=c.namespace AND key.subscription_id=c.subscription_id AND key.generation=c.generation':'';
    const rows=(await run(`SELECT s.event_id,s.owner_key,s.event_name,s.payload,
      pg_catalog.floor(EXTRACT(epoch FROM s.occurred_at)*1000)::pg_catalog.float8 AS occurred_at,
      c.arguments,h.url,${dbTime} AS now ${keySelect}
      FROM public.emseepea_event_intents i JOIN public.emseepea_event_sources s ON s.namespace=i.namespace AND s.source_kind=i.source_kind AND s.source_id=i.source_id
      JOIN public.emseepea_event_capture_subscriptions c ON c.namespace=i.namespace AND c.subscription_id=i.subscription_id AND c.generation=i.generation
      JOIN public.emseepea_event_heads h ON h.namespace=c.namespace AND h.subscription_id=c.subscription_id AND h.generation=c.generation ${keyJoin}
      WHERE i.namespace=$1 AND i.source_kind=$2 AND i.source_id=$3 AND i.subscription_id=$4 AND i.generation=$5 AND i.state='pending'
      AND i.event_id=s.event_id AND s.owner_key=c.owner_key AND s.owner_key=h.owner_key AND s.event_name=c.event_name
      AND c.active AND c.expires_at>pg_catalog.clock_timestamp() AND h.url IS NOT NULL`,values(k))).rows;
    return rows.length===1?rows[0]!:null;
  }
  function body(row:Row):Buffer|null {
    const definition=definitions.find(v=>v.name===row.event_name);
    if(!definition||typeof row.owner_key!=='string'||typeof row.event_id!=='string'||!Number.isSafeInteger(row.occurred_at)||!row.payload||typeof row.payload!=='object'||Array.isArray(row.payload)||!row.arguments||typeof row.arguments!=='object'||Array.isArray(row.arguments))return null;
    const payload=canonical(row.payload),args=canonical(row.arguments);
    if(!definition.payloadSchema.safeParse(payload).success||!definition.inputSchema.safeParse(args).success)return null;
    const matched:unknown=definition.matches(args as Row,payload as Row,row.owner_key);
    if(typeof matched!=='boolean') {
      if(matched&&typeof(matched as PromiseLike<unknown>).then==='function')owner.track(Promise.resolve(matched));
      return unavailable();
    }
    if(!matched)return null;
    // Validate but do not substitute a current schema's transformed output.
    return Buffer.from(JSON.stringify({eventId:row.event_id,name:row.event_name,timestamp:new Date(Number(row.occurred_at)).toISOString(),data:payload,cursor:null}));
  }
  async function finishTerminal(run:EventSql,k:Row,category:'suppressed'|'exhausted'|'accepted'|'gone'|'too_large') {
    await run(`UPDATE public.emseepea_event_intents SET state=$6 WHERE ${predicate} AND state='pending'`,[...values(k),category==='suppressed'?'revoked':'completed']);
    await run(`UPDATE public.emseepea_event_delivery_state SET terminal=$6,lease_id=NULL,lease_until=NULL WHERE ${predicate} AND terminal IS NULL`,[...values(k),category]);
  }
  async function leaseSuppression(run:EventSql,k:Row,lease:string):Promise<PostgresEventDeliveryOutcome> {
    const locked=await lock(run,k);if(!locked)return terminal('missing');
    const previous=acceptedOrTerminal(locked.row.terminal);if(previous)return previous;
    if(locked.row.lease_id!==lease||Number(locked.row.lease_until)<=Number(locked.row.now))return retry('leased');
    await finishTerminal(run,k,'suppressed');return terminal('suppressed');
  }
  return Object.freeze<PostgresEventDelivery>({
    async deliver(deliveryId,invocation):Promise<PostgresEventDeliveryOutcome> {
      identifier(deliveryId);if(closing)return retry('stopping');if(busy)return retry('unavailable');busy=true;
      let sendStarted=false;
      try{return await owner.run(invocation,async session=>{
        const claim=await session.transaction(async run=>{
          const k=(await run(`SELECT ${columns} FROM public.emseepea_event_intents WHERE namespace=$1 AND delivery_id=$2`,[namespace,deliveryId])).rows[0];
          if(!k)return {result:terminal('missing')};
          for(const column of columns.split(','))identifier(k[column]);
          const locked=await lock(run,k);if(!locked)return {result:terminal('missing')};
          const previous=acceptedOrTerminal(locked.row.terminal);if(previous)return {result:previous};
          if(locked.intent.state!=='pending'){await finishTerminal(run,k,'suppressed');return {result:terminal('suppressed')};}
          if(locked.row.lease_id!==null&&Number(locked.row.lease_until)>Number(locked.row.now))return {result:retry('leased')};
          if(Number(locked.row.reservations)>=4){await finishTerminal(run,k,'exhausted');return {result:terminal('attempts_exhausted')};}
          if(Number(locked.row.due_at)>Number(locked.row.now))return {result:retry('not_due')};
          const data=await snapshot(run,k,false);if(!data||!body(data)){await finishTerminal(run,k,'suppressed');return {result:terminal('suppressed')};}
          const lease=randomUUID();await run(`UPDATE public.emseepea_event_delivery_state SET lease_id=$6,lease_until=pg_catalog.to_timestamp(($7::pg_catalog.float8+60000)/1000) WHERE ${predicate}`,[...values(k),lease,locked.row.now]);
          return {lease,data,k};
        });
        if('result' in claim)return claim.result!;
        const k=claim.k;
        const allowed=await session.wait(()=>options.authorize({ownerKey:String(claim.data.owner_key),name:String(claim.data.event_name),arguments:canonical(claim.data.arguments) as Row,phase:'delivery'}),1000);
        if(allowed!==true)return session.transaction(run=>leaseSuppression(run,k,claim.lease));
        if(session.remaining()<18000)return retry('deadline');
        const reserved=await session.transaction(async run=>{
          const locked=await lock(run,k);if(!locked)return {result:terminal('missing')};
          const previous=acceptedOrTerminal(locked.row.terminal);if(previous)return {result:previous};
          if(locked.row.lease_id!==claim.lease||Number(locked.row.lease_until)<=Number(locked.row.now))return {result:retry('leased')};
          if(locked.intent.state!=='pending'){await finishTerminal(run,k,'suppressed');return {result:terminal('suppressed')};}
          if(Number(locked.row.reservations)>=4)return {result:retry('leased')};
          const snapshotStart=performance.now(),data=await snapshot(run,k,true);
          if(!data){await finishTerminal(run,k,'suppressed');return {result:terminal('suppressed')};}
          const bytes=body(data);if(!bytes){await finishTerminal(run,k,'suppressed');return {result:terminal('suppressed')};}
          if(bytes.byteLength>262144){await finishTerminal(run,k,'too_large');return {result:terminal('too_large')};}
          if(typeof data.secret!=='string'||typeof data.url!=='string'||!Number.isSafeInteger(data.now))return unavailable();
          try {
            const valid=validateMcpEventSubscription(definitions,{name:data.event_name,arguments:data.arguments,delivery:{mode:'webhook',url:data.url,secret:data.secret}});
            if(valid.url!==data.url||mcpEventSubscriptionIdentity(String(data.owner_key),String(data.event_name),data.arguments as Row,data.url)!==k.subscription_id)return unavailable();
            if(data.previous_secret!==null)validateMcpEventSubscription(definitions,{name:data.event_name,arguments:data.arguments,delivery:{mode:'webhook',url:data.url,secret:data.previous_secret}});
          } catch {return unavailable();}
          if(session.remaining()<16000||Number(locked.row.lease_until)-Number(data.now)-(performance.now()-snapshotStart)<16000)return {result:retry('deadline')};
          const reservation=randomUUID(),attempt=Number(locked.row.reservations)+1;
          await run(`INSERT INTO public.emseepea_event_delivery_attempts(${columns},attempt,reservation_id,lease_id,reserved_at,outcome)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,pg_catalog.to_timestamp($9::pg_catalog.float8/1000),'reserved')`,[...values(k),attempt,reservation,claim.lease,data.now]);
          await run(`UPDATE public.emseepea_event_delivery_state SET reservations=$6 WHERE ${predicate}`,[...values(k),attempt]);
          return {reservation,attempt,data,bytes,snapshotStart,leaseUntil:Number(locked.row.lease_until)};
        });
        if('result' in reserved)return reserved.result!;
        session.check();
        if(session.remaining()<15000||reserved.leaseUntil-Number(reserved.data.now)-(performance.now()-reserved.snapshotStart)<15000)return retry('deadline');
        const timestamp=Math.floor(Number(reserved.data.now)/1000),eventId=String(reserved.data.event_id);
        const primary=signWebhook(String(reserved.data.secret),eventId,timestamp,reserved.bytes);
        const previous=typeof reserved.data.previous_secret==='string'&&Number(reserved.data.previous_until)>Number(reserved.data.now)?` ${signWebhook(reserved.data.previous_secret,eventId,timestamp,reserved.bytes)}`:'';
        let status=0;
        try{const response=await session.wait(()=>{sendStarted=true;return send(String(reserved.data.url),reserved.bytes,{'webhook-id':eventId,'webhook-timestamp':String(timestamp),'webhook-signature':primary+previous,'X-MCP-Subscription-Id':String(k.subscription_id)});},10000);if(!Number.isInteger(response.status)||response.status<100||response.status>599)return retry('unknown_outcome');status=response.status;}
        catch {return retry('unknown_outcome');}
        return session.transaction(async run=>{
          const locked=await lock(run,k);if(!locked)return terminal('missing');
          const old=acceptedOrTerminal(locked.row.terminal);if(old)return old;
          if(locked.row.lease_id!==claim.lease||Number(locked.row.lease_until)<=Number(locked.row.now))return retry('leased');
          const attemptRow=(await run(`SELECT reservation_id FROM public.emseepea_event_delivery_attempts WHERE ${predicate} AND attempt=$6 FOR UPDATE`,[...values(k),reserved.attempt])).rows[0];
          if(attemptRow?.reservation_id!==reserved.reservation)return retry('leased');
          const accepted=status>=200&&status<300;
          await run(`UPDATE public.emseepea_event_delivery_attempts SET outcome=$7,status=$8 WHERE ${predicate} AND attempt=$6`,[...values(k),reserved.attempt,accepted?'accepted':status===410||status===413?'terminal':'failed',status>=100&&status<=599?status:null]);
          if(locked.intent.state!=='pending'){await finishTerminal(run,k,'suppressed');return terminal('suppressed');}
          if(accepted){await finishTerminal(run,k,'accepted');return terminal('callback_accepted');}
          if(status===410||status===413){await finishTerminal(run,k,status===410?'gone':'too_large');return terminal(status===410?'gone':'too_large');}
          if(reserved.attempt>=4){await finishTerminal(run,k,'exhausted');return terminal('attempts_exhausted');}
          const delay=[1000,5000,25000][reserved.attempt-1]!;
          await run(`UPDATE public.emseepea_event_delivery_state SET lease_id=NULL,lease_until=NULL,due_at=pg_catalog.to_timestamp(($6::pg_catalog.float8+$7::pg_catalog.int4)/1000) WHERE ${predicate}`,[...values(k),locked.row.now,delay]);
          return retry('callback_failed');
        });
      });}catch(error){
        if(sendStarted)return retry('unknown_outcome');
        if(error instanceof ExternalMcpEventError){if(error.code==='INVALID_INPUT')throw error;if(error.code==='OUTCOME_UNKNOWN')return retry('unknown_outcome');if(error.code==='DEADLINE')return retry('deadline');if(error.code==='ABORTED')return retry(closing?'stopping':'aborted');}
        return retry('unavailable');
      }finally{
        // Visible UNKNOWN can precede raw policy/SQL/HTTP settlement. Retain private admission.
        void owner.quiesce().then(drained=>{if(drained)busy=false;},()=>{});
      }
    },
    settle(invocation){closing=true;return owner.settle(invocation);},
  });
}
