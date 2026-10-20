import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { ExternalMcpEventError, type ExternalMcpEventLifecycle, type ExternalMcpEventIdentity, type ExternalMcpEventObservation } from './events-external.js';
import { mcpEventSubscriptionIdentity } from './events.js';
import { createOwnedEventOperations, type OwnedEventPool, type EventSql } from './events-postgres-owned.js';
export { createPostgresEventLifecycleMigrator } from './events-postgres-lifecycle-migrations.js';
export interface PostgresEventLifecycleOptions {
  readonly namespace:string;
  /** The observation pool must have `SELECT` access to subscription heads and subscriptions only. It must not have access to signing keys. */
  readonly observationPool:OwnedEventPool;
  /** The mutation pool must allow only the required lifecycle data changes. Keep it separate from the caller-owned capture role. */
  readonly mutationPool:OwnedEventPool;
}
const fail=(code:ConstructorParameters<typeof ExternalMcpEventError>[0]):never=>{throw new ExternalMcpEventError(code);};
function text(value:unknown,max=240):string {
  if(typeof value!=='string'||!value||Buffer.byteLength(value)>max||/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))fail('INVALID_INPUT');
  return value as string;
}
function json(value:unknown,depth=0):unknown {
  if(depth>32)fail('INVALID_INPUT');
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)&&!Object.is(value,-0))return value;
  if(typeof value==='string') {if(value)text(value,65536);return value;}
  if(!value||typeof value!=='object'||!(Array.isArray(value)?Object.getPrototypeOf(value)===Array.prototype:[null,Object.prototype].includes(Object.getPrototypeOf(value))))fail('INVALID_INPUT');
  const fields=Object.getOwnPropertyDescriptors(value),array=Array.isArray(value),result:Record<string,unknown>|unknown[]=array?[]:Object.create(null);
  if(array&&Reflect.ownKeys(fields).length!==value.length+1)fail('INVALID_INPUT');
  for(const key of Reflect.ownKeys(fields)) {
    if(typeof key!=='string'||/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(key))fail('INVALID_INPUT');
    const item=fields[key as string]!;
    if(!('value' in item)||!item.enumerable&&!(array&&key==='length'))fail('INVALID_INPUT');
    if(array&&key==='length')continue;
    if(array&&!/^(0|[1-9][0-9]*)$/.test(key as string))fail('INVALID_INPUT');
    (result as Record<string,unknown>)[key as string]=json(item.value,depth+1);
  }
  return Object.freeze(result);
}
function request(value:unknown):Record<string,unknown> {
  const copy=json(value) as Record<string,unknown>;
  if(!copy||Array.isArray(copy)||typeof copy!=='object'||Buffer.byteLength(JSON.stringify(copy))>65536)fail('INVALID_INPUT');
  return copy;
}
function identity(value:Record<string,unknown>):ExternalMcpEventIdentity {
  const id=text(value.id),ownerKey=text(value.ownerKey,256),name=text(value.name),url=text(value.url,8192),args=value.arguments;
  if(!args||typeof args!=='object'||Array.isArray(args))fail('INVALID_INPUT');
  let parsed:URL;try{parsed=new URL(url);}catch{return fail('INVALID_INPUT');}
  if(parsed.href!==url||parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash||parsed.port&&parsed.port!=='443'||isIP(parsed.hostname.replace(/^\[|\]$/g,''))||parsed.hostname==='localhost'||parsed.hostname.endsWith('.localhost')||parsed.hostname.endsWith('.local'))fail('INVALID_INPUT');
  if(mcpEventSubscriptionIdentity(ownerKey,name,args as Record<string,unknown>,url)!==id)fail('INVALID_INPUT');
  return Object.freeze({id,ownerKey,name,url,arguments:args as Record<string,unknown>});
}
const dbTime=`pg_catalog.floor(EXTRACT(epoch FROM pg_catalog.clock_timestamp())*1000)::pg_catalog.float8`;
const conflict=()=>fail('SUBSCRIPTION_CHANGED');
const validMs=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
/** Creates the experimental PostgreSQL lifecycle implementation. Run the explicit migration first and configure finite timeouts on both PostgreSQL pools. */
export function createPostgresEventLifecycle(options:PostgresEventLifecycleOptions):ExternalMcpEventLifecycle {
  const namespace=text(options?.namespace);
  if(!options.observationPool||!options.mutationPool||typeof options.observationPool.connect!=='function'||typeof options.mutationPool.connect!=='function')fail('INVALID_INPUT');
  const owned=createOwnedEventOperations();
  async function locked(run:EventSql,i:ExternalMcpEventIdentity) {
    const inserted=(await run(`INSERT INTO public.emseepea_event_heads(namespace,subscription_id,owner_key,url,revision,generation)
      VALUES($1,$2,$3,NULL,$4,NULL) ON CONFLICT(namespace,subscription_id) DO NOTHING RETURNING revision`,[namespace,i.id,i.ownerKey,randomUUID()])).rows.length===1;
    const row=(await run(`SELECT owner_key,url,revision,generation FROM public.emseepea_event_heads WHERE namespace=$1 AND subscription_id=$2 FOR UPDATE`,[namespace,i.id])).rows[0];
    if(!row||row.owner_key!==i.ownerKey||typeof row.revision!=='string')return conflict();
    return {row,inserted};
  }
  async function current(run:EventSql,i:ExternalMcpEventIdentity,generation:unknown) {
    if(generation===null)return null;
    const row=(await run(`SELECT owner_key,event_name,arguments,active,pg_catalog.floor(EXTRACT(epoch FROM expires_at)*1000)::pg_catalog.float8 AS expires_at
      FROM public.emseepea_event_capture_subscriptions WHERE namespace=$1 AND subscription_id=$2 AND generation=$3`,[namespace,i.id,generation])).rows[0];
    if(!row||row.owner_key!==i.ownerKey||row.event_name!==i.name||mcpEventSubscriptionIdentity(i.ownerKey,i.name,row.arguments as Record<string,unknown>,i.url)!==i.id||!validMs(row.expires_at)||typeof row.active!=='boolean')return fail('UNAVAILABLE');
    return row;
  }
  return Object.freeze<ExternalMcpEventLifecycle>({
    async observe(input,invocation):Promise<ExternalMcpEventObservation> {
      const i=identity(request(input));
      return owned.run(options.observationPool,invocation,async run=>{
        const row=(await run(`WITH clock AS MATERIALIZED(SELECT ${dbTime} AS now)
          SELECT clock.now,h.owner_key,h.url,h.revision,h.generation,s.owner_key AS capture_owner,s.event_name,s.arguments,s.active,
          pg_catalog.floor(EXTRACT(epoch FROM s.expires_at)*1000)::pg_catalog.float8 AS expires_at
          FROM clock LEFT JOIN public.emseepea_event_heads h ON h.namespace=$1 AND h.subscription_id=$2
          LEFT JOIN public.emseepea_event_capture_subscriptions s ON s.namespace=h.namespace AND s.subscription_id=h.subscription_id AND s.generation=h.generation`,[namespace,i.id])).rows[0];
        if(!row||!validMs(row.now))return fail('UNAVAILABLE');
        const base={id:i.id,ownerKey:i.ownerKey,observedAt:row.now};
        if(row.revision===null)return {...base,revision:null,generation:null,active:false,subscription:null};
        if(row.owner_key!==i.ownerKey||typeof row.revision!=='string'||!(row.generation===null||typeof row.generation==='string'))return fail('UNAVAILABLE');
        if(row.url===null)return {...base,revision:row.revision,generation:row.generation as string|null,active:false,subscription:null};
        if(row.url!==i.url||row.capture_owner!==i.ownerKey||row.event_name!==i.name||!validMs(row.expires_at)||typeof row.active!=='boolean'||mcpEventSubscriptionIdentity(i.ownerKey,i.name,row.arguments as Record<string,unknown>,i.url)!==i.id)return fail('UNAVAILABLE');
        return {...base,revision:row.revision,generation:row.generation as string,active:row.active&&row.expires_at>row.now,
          subscription:{id:i.id,ownerKey:i.ownerKey,name:i.name,arguments:row.arguments as Record<string,unknown>,url:i.url,expiresAt:row.expires_at}};
      },true);
    },
    async activate(input,invocation) {
      const value=request(input),i=identity(value);
      const expected=value.expectedRevision;
      if(!(expected===null||typeof expected==='string'&&text(expected))||!['new','renew'].includes(value.intent as string)||!Number.isSafeInteger(value.ttlMs)||Number(value.ttlMs)<1||Number(value.ttlMs)>86400000)fail('INVALID_INPUT');
      const secret=text(value.secret,100);
      if(!secret.startsWith('whsec_'))fail('INVALID_INPUT');
      const decoded=Buffer.from(secret.slice(6),'base64');
      if(decoded.length<24||decoded.length>64||decoded.toString('base64')!==secret.slice(6))fail('INVALID_INPUT');
      return owned.run(options.mutationPool,invocation,async run=>{
        const {row,inserted}=await locked(run,i);
        if(expected===null?!inserted:inserted||row.revision!==expected)return conflict();
        if(row.url!==null&&row.generation===null)return fail('UNAVAILABLE');
        const prior=await current(run,i,row.generation);
        if(row.url!==null&&row.url!==i.url)return fail('UNAVAILABLE');
        const now=(await run(`SELECT ${dbTime} AS now`)).rows[0]?.now;
        if(!validMs(now))return fail('UNAVAILABLE');
        const active=row.url!==null&&prior?.active===true&&Number(prior.expires_at)>now;
        if(value.intent==='renew'?!active:active)return conflict();
        const expiresAt=now+Number(value.ttlMs),generation=value.intent==='renew'?String(row.generation):randomUUID(),revision=randomUUID();
        if(value.intent==='new') {
          await run('UPDATE public.emseepea_event_capture_subscriptions SET active=false WHERE namespace=$1 AND subscription_id=$2 AND active',[namespace,i.id]);
          await run('DELETE FROM public.emseepea_event_keys WHERE namespace=$1 AND subscription_id=$2',[namespace,i.id]);
          await run(`INSERT INTO public.emseepea_event_capture_subscriptions(namespace,subscription_id,generation,owner_key,event_name,arguments,active,expires_at)
            VALUES($1,$2,$3,$4,$5,$6::pg_catalog.jsonb,true,pg_catalog.to_timestamp($7::pg_catalog.float8/1000))`,[namespace,i.id,generation,i.ownerKey,i.name,JSON.stringify(i.arguments),expiresAt]);
          await run(`INSERT INTO public.emseepea_event_keys(namespace,subscription_id,generation,secret,previous_secret,previous_until,verified_until)
            VALUES($1,$2,$3,$4,NULL,NULL,pg_catalog.to_timestamp($5::pg_catalog.float8/1000))`,[namespace,i.id,generation,secret,Math.min(now+300000,expiresAt)]);
        } else {
          const key=(await run('SELECT secret FROM public.emseepea_event_keys WHERE namespace=$1 AND subscription_id=$2 AND generation=$3',[namespace,i.id,generation])).rows[0];
          if(typeof key?.secret!=='string')return fail('UNAVAILABLE');
          await run(`UPDATE public.emseepea_event_keys SET previous_secret=CASE WHEN secret=$4 THEN previous_secret ELSE secret END,
            previous_until=CASE WHEN secret=$4 THEN previous_until ELSE pg_catalog.to_timestamp($5::pg_catalog.float8/1000) END,
            secret=$4,verified_until=pg_catalog.to_timestamp($5::pg_catalog.float8/1000) WHERE namespace=$1 AND subscription_id=$2 AND generation=$3`,[namespace,i.id,generation,secret,Math.min(now+300000,expiresAt)]);
          await run(`UPDATE public.emseepea_event_capture_subscriptions SET expires_at=pg_catalog.to_timestamp($4::pg_catalog.float8/1000) WHERE namespace=$1 AND subscription_id=$2 AND generation=$3`,[namespace,i.id,generation,expiresAt]);
        }
        await run('UPDATE public.emseepea_event_heads SET url=$3,revision=$4,generation=$5 WHERE namespace=$1 AND subscription_id=$2',[namespace,i.id,i.url,revision,generation]);
        return {id:i.id,revision,generation,observedAt:now,expiresAt};
      });
    },
    async revoke(input,invocation) {
      const i=identity(request(input));
      await owned.run(options.mutationPool,invocation,async run=>{
        await locked(run,i);
        await run('UPDATE public.emseepea_event_capture_subscriptions SET active=false WHERE namespace=$1 AND subscription_id=$2 AND active',[namespace,i.id]);
        await run("UPDATE public.emseepea_event_intents SET state='revoked' WHERE namespace=$1 AND subscription_id=$2 AND state='pending'",[namespace,i.id]);
        await run('DELETE FROM public.emseepea_event_keys WHERE namespace=$1 AND subscription_id=$2',[namespace,i.id]);
        await run('UPDATE public.emseepea_event_heads SET url=NULL,revision=$3 WHERE namespace=$1 AND subscription_id=$2',[namespace,i.id,randomUUID()]);
      });
    },
    settle:owned.settle,
  });
}
