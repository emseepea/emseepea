import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { ExternalMcpEventError, type ExternalMcpEventInvocation } from './events-external.js';
import type { OwnedEventPool, EventSql } from './events-postgres-owned.js';
import { createDeliverySessionOwner } from './events-postgres-delivery-owned.js';

type Invocation=ExternalMcpEventInvocation;
type Row=Record<string,unknown>;
/** Private provider boundary. The packaged provider must verify exact task equivalence. */
export interface EventDispatchTransport {
 readonly fingerprint:string;
 queue(invocation:Invocation):Promise<'present'|'unavailable'>;
 inspect(task:Readonly<{deliveryId:string;taskId:string}>,invocation:Invocation):Promise<'matching'|'conflict'|'missing'|'unavailable'>;
 create(task:Readonly<{deliveryId:string;taskId:string}>,invocation:Invocation):Promise<'created'|'exists'|'unavailable'>;
}
export interface EventDispatchOptions {
 readonly namespace:string;readonly pool:OwnedEventPool;readonly transport:EventDispatchTransport;
 readonly isPaused:()=>boolean;
}
export interface EventDispatchResult {
 readonly selected:number;readonly created:number;readonly observed:number;readonly conflicts:number;
 readonly unknown:number;readonly deferred:number;
 readonly status:'complete'|'retry_pending'|'paused'|'stopping';
}
const names=['namespace','source_kind','source_id','subscription_id','generation'] as const;
const key=(row:Row)=>names.map(name=>row[name]);
const equal=(alias:string)=>names.map((name,i)=>`${alias}.${name}=$${i+1}`).join(' AND ');
const join=(a:string,b:string)=>names.map(name=>`${a}.${name}=${b}.${name}`).join(' AND ');
const dbNow="pg_catalog.floor(EXTRACT(epoch FROM pg_catalog.clock_timestamp())*1000)::pg_catalog.float8";
const invalid=():never=>{throw new ExternalMcpEventError('INVALID_INPUT');};
const validId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&Buffer.byteLength(value)<=240&&
 !value.includes('\u0000')&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
const eligible=`i.state='pending' AND i.event_id=s.event_id AND s.owner_key=c.owner_key AND c.owner_key=h.owner_key
 AND s.event_name=c.event_name AND h.generation=c.generation AND h.url IS NOT NULL AND c.active
 AND c.expires_at>pg_catalog.clock_timestamp() AND (w.terminal IS NULL)`;
const joins=`JOIN public.emseepea_event_sources s ON s.namespace=i.namespace AND s.source_kind=i.source_kind AND s.source_id=i.source_id
 JOIN public.emseepea_event_capture_subscriptions c ON c.namespace=i.namespace AND c.subscription_id=i.subscription_id AND c.generation=i.generation
 JOIN public.emseepea_event_heads h ON h.namespace=i.namespace AND h.subscription_id=i.subscription_id
 LEFT JOIN public.emseepea_event_delivery_state w ON ${join('w','i')}`;

/** Internal implementation seam; no route, provider credentials, timer or adopter callback API. */
export function createPostgresEventDispatchRuntime(options:EventDispatchOptions) {
 const namespace=options?.namespace,transport=options?.transport,fingerprint=transport?.fingerprint;
 if(!validId(namespace)||
  !options.pool||typeof options.pool.connect!=='function'||typeof options.isPaused!=='function'||
  typeof fingerprint!=='string'||!/^[0-9a-f]{64}$/.test(fingerprint)||
  typeof transport.queue!=='function'||typeof transport.inspect!=='function'||typeof transport.create!=='function')invalid();
 const owner=createDeliverySessionOwner(options.pool),pending=new Set<Promise<unknown>>();
 let busy=false,closing=false;
 function track<T>(promise:Promise<T>):Promise<T> {
  pending.add(promise);void promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;
 }
 function paused():boolean {const value:unknown=options.isPaused();if(typeof value!=='boolean')return invalid();return value;}
 async function operation(target:string|undefined,input:Invocation):Promise<EventDispatchResult> {
  const result={selected:0,created:0,observed:0,conflicts:0,unknown:0,deferred:0,status:'complete' as EventDispatchResult['status']};
  if(!input?.signal||!Number.isFinite(input.deadlineMs))return invalid();
  if(target!==undefined&&!validId(target))return invalid();
  if(closing)return {...result,status:'stopping'};
  if(busy)return {...result,status:'retry_pending'};
  busy=true;
  const end=performance.now()+Math.min(25000,input.deadlineMs-Date.now());
  function check(required=0) {
   if(closing||input.signal.aborted)throw new ExternalMcpEventError('ABORTED');
   if(paused())throw new Error('DISPATCH_PAUSED');
   if(end-performance.now()<required)throw new ExternalMcpEventError('DEADLINE');
  }
  const invocation=():Invocation=>({signal:input.signal,deadlineMs:Date.now()+Math.max(0,end-performance.now()-1000)});
  async function sql<T>(work:(run:EventSql)=>Promise<T>):Promise<T> {
   check(5000);return owner.run(invocation(),session=>session.transaction(work));
  }
  async function provider<T>(work:(inv:Invocation)=>Promise<T>):Promise<T> {
   check(4000);let timer:ReturnType<typeof setTimeout>|undefined,stop:(()=>void)|undefined;
   const controller=new AbortController(),until=Math.min(end-1000,performance.now()+3000);
   try {
    const actual=track(Promise.resolve().then(()=>{check(4000);return work({signal:controller.signal,deadlineMs:Date.now()+Math.max(0,until-performance.now())});}));
    const value=await Promise.race([actual,new Promise<never>((_resolve,reject)=>{
     timer=setTimeout(()=>{controller.abort();reject(new ExternalMcpEventError('DEADLINE'));},Math.max(1,until-performance.now()));
     stop=()=>{controller.abort();reject(new ExternalMcpEventError('ABORTED'));};input.signal.addEventListener('abort',stop,{once:true});if(input.signal.aborted)stop();
    })]);
    check();if(performance.now()>=until)throw new ExternalMcpEventError('DEADLINE');return value;
   }finally{if(timer)clearTimeout(timer);if(stop)input.signal.removeEventListener('abort',stop);}
  }
  async function seed() {
   await sql(async run=>{
    await run(`INSERT INTO public.emseepea_event_dispatch_state(${names.join(',')},config_hash)
     SELECT ${names.map(name=>`i.${name}`).join(',')},$2 FROM public.emseepea_event_intents i ${joins}
     WHERE i.namespace=$1 AND ${eligible} AND ($3::pg_catalog.text IS NULL OR i.delivery_id=$3)
     AND NOT EXISTS(SELECT 1 FROM public.emseepea_event_dispatch_state d WHERE ${join('d','i')})
     ORDER BY i.delivery_id LIMIT 100 ON CONFLICT(${names.join(',')}) DO NOTHING`,[namespace,fingerprint,target??null]);
   });
  }
  async function claim():Promise<Row|null> {
   return sql(async run=>{
    const row=(await run(`SELECT d.*,i.delivery_id FROM public.emseepea_event_dispatch_state d
     JOIN public.emseepea_event_intents i ON ${join('d','i')}
     WHERE d.namespace=$1 AND NOT d.terminal AND d.due_at<=pg_catalog.clock_timestamp()
     AND (d.lease_until IS NULL OR d.lease_until<=pg_catalog.clock_timestamp())
     AND ($2::pg_catalog.text IS NULL OR i.delivery_id=$2)
     ORDER BY d.due_at,i.delivery_id FOR UPDATE OF d SKIP LOCKED LIMIT 1`,[namespace,target??null])).rows[0];
    if(!row)return null;
    if(names.some(name=>typeof row[name]!=='string')||typeof row.delivery_id!=='string'||!Number.isInteger(row.transport_generation)||
     Number(row.transport_generation)<0||Number(row.transport_generation)>2147483646||!Number.isInteger(row.recovery_count)||
     typeof row.config_hash!=='string')throw new ExternalMcpEventError('UNAVAILABLE');
    const lease=randomUUID();
    await run(`UPDATE public.emseepea_event_dispatch_state d SET lease_id=$6,lease_until=pg_catalog.clock_timestamp()+interval '30 seconds',
     recovery_count=CASE WHEN recovery_count<2147483647 THEN recovery_count+1 ELSE recovery_count END,
     due_at=pg_catalog.clock_timestamp()+pg_catalog.make_interval(secs=>(CASE WHEN recovery_count>=6 THEN 60 ELSE pg_catalog.power(2,recovery_count)::pg_catalog.int4 END)::pg_catalog.float8)
     WHERE ${equal('d')}`,[...key(row),lease]);
    row.lease_id=lease;
    const fresh=(await run(`SELECT ${eligible} AS eligible,${dbNow} AS now,
     pg_catalog.ceil(EXTRACT(epoch FROM w.lease_until)*1000)::pg_catalog.float8 AS worker_lease_until,
     pg_catalog.ceil(EXTRACT(epoch FROM w.due_at)*1000)::pg_catalog.float8 AS worker_due_at
     FROM public.emseepea_event_intents i ${joins} WHERE ${equal('i')}`,key(row))).rows[0];
    row.eligible=fresh?.eligible===true;
    if(fresh){
     if(!Number.isSafeInteger(fresh.now))throw new ExternalMcpEventError('UNAVAILABLE');
     for(const name of ['worker_lease_until','worker_due_at'])if(fresh[name]!==null&&!Number.isSafeInteger(fresh[name]))throw new ExternalMcpEventError('UNAVAILABLE');
     const until=Math.max(Number(fresh.worker_lease_until??0),Number(fresh.worker_due_at??0));
     row.waitUntil=until>Number(fresh.now)?until:null;
    }else row.waitUntil=null;
    return row;
   });
  }
  async function finish(row:Row,category:string,terminal=false,deferUntil:number|null=null) {
   check(5000);
   const found=await sql(async run=>(await run(`UPDATE public.emseepea_event_dispatch_state d
    SET category=$8,terminal=$9,lease_id=NULL,lease_until=NULL,
    due_at=CASE WHEN $12::pg_catalog.float8 IS NULL THEN due_at ELSE
     GREATEST(due_at,pg_catalog.clock_timestamp()+interval '1 second',pg_catalog.to_timestamp($12::pg_catalog.float8/1000)) END
    WHERE ${equal('d')} AND lease_id=$6 AND config_hash=$7 AND lease_until>pg_catalog.clock_timestamp()
    AND transport_generation=$10 AND task_id IS NOT DISTINCT FROM $11 RETURNING namespace`,
    [...key(row),row.lease_id,row.config_hash,category,terminal,row.transport_generation,row.task_id??null,deferUntil])).rows);
   if(found.length!==1)throw new ExternalMcpEventError('OUTCOME_UNKNOWN');
  }
  async function reserve(row:Row) {
   check(12000);
   const previous=Number(row.transport_generation);if(previous>=2147483646)throw new ExternalMcpEventError('UNAVAILABLE');
   const generation=previous+1,taskId='emseepea-'+createHash('sha256').update(JSON.stringify([fingerprint,namespace,row.delivery_id,generation])).digest('hex');
   const found=await sql(async run=>(await run(`UPDATE public.emseepea_event_dispatch_state d SET transport_generation=$8,task_id=$9,category='unknown'
    WHERE ${equal('d')} AND lease_id=$6 AND config_hash=$7 AND lease_until>pg_catalog.clock_timestamp()
    AND transport_generation=$10 AND task_id IS NOT DISTINCT FROM $11 RETURNING namespace`,
    [...key(row),row.lease_id,fingerprint,generation,taskId,previous,row.task_id??null])).rows);
   if(found.length!==1)throw new ExternalMcpEventError('OUTCOME_UNKNOWN');
   row.transport_generation=generation;row.task_id=taskId;
  }
  try {
   check(5000);
   if(await provider(inv=>transport.queue(inv))!=='present'){result.status='retry_pending';result.deferred++;return result;}
   await seed();
   while(result.selected<100) {
    check(18000);const row=await claim();if(!row)break;result.selected++;
    if(row.config_hash!==fingerprint){await finish(row,'conflict');result.conflicts++;continue;}
    if(!row.eligible){await finish(row,'ineligible',true);result.deferred++;continue;}
    if(typeof row.waitUntil==='number'){await finish(row,'unavailable',false,row.waitUntil);result.deferred++;continue;}
    let create=Number(row.transport_generation)===0;
    if(!create) {
     if(typeof row.task_id!=='string'||!/^emseepea-[0-9a-f]{64}$/.test(row.task_id))throw new ExternalMcpEventError('UNAVAILABLE');
     const state=await provider(inv=>transport.inspect({deliveryId:String(row.delivery_id),taskId:String(row.task_id)},inv));
     if(state==='matching'){await finish(row,'present');result.observed++;continue;}
     if(state==='conflict'){await finish(row,'conflict');result.conflicts++;continue;}
     if(state!=='missing'){await finish(row,'unknown');result.unknown++;continue;}
     check(15000);
     if(await provider(inv=>transport.queue(inv))!=='present'){await finish(row,'unavailable');result.deferred++;continue;}
     create=true;
    }
    if(create) {
     await reserve(row);check(8000);
     const state=await provider(inv=>transport.create({deliveryId:String(row.delivery_id),taskId:String(row.task_id)},inv));
     await finish(row,state==='created'?'present':'unknown');
     if(state==='created')result.created++;else result.unknown++;
    }
    if(target!==undefined)break;
   }
   return result;
  }catch(error){
   result.status=error instanceof Error&&error.message==='DISPATCH_PAUSED'?'paused':closing?'stopping':'retry_pending';
   result.unknown++;return result;
  }finally{
   // A visible timeout never frees the single slot while raw SDK/SQL or disposal is outstanding.
   const drained=owner.quiesce();
   const held=track(Promise.allSettled([...pending,drained]));
   void held.then(async()=>{if(await drained)busy=false;});
  }
 }
 return Object.freeze({
  reconcile:(invocation:Invocation)=>operation(undefined,invocation),
  dispatch:(deliveryId:string,invocation:Invocation)=>operation(deliveryId,invocation),
  async settle(invocation:Invocation):Promise<boolean> {
   closing=true;const end=performance.now()+Math.max(0,invocation.deadlineMs-Date.now());
   const settling=owner.settle(invocation);
   while(pending.size){if(invocation.signal.aborted||performance.now()>=end)return false;
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{const done=await Promise.race([Promise.allSettled(pending).then(()=>true),new Promise<false>(resolve=>{timer=setTimeout(()=>resolve(false),Math.max(1,end-performance.now()));})]);if(!done)return false;}
    finally{if(timer)clearTimeout(timer);}
   }
   return settling;
  },
 });
}
