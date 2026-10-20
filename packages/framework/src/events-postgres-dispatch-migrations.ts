import {
 createPostgresEventDeliveryMigrator,
 PostgresEventDeliveryMigrationError,
} from './events-postgres-delivery-migrations.js';
import { createOwnedEventOperations, type OwnedEventPool, type EventSql } from './events-postgres-owned.js';
import type { ExternalMcpEventInvocation } from './events-external.js';

export class PostgresEventDispatchMigrationError extends Error {
 constructor(readonly code:'INCOMPATIBLE_SCHEMA'|'UNAVAILABLE'|'OUTCOME_UNKNOWN',
  readonly phase:'capture'|'lifecycle'|'delivery'|'dispatch'='dispatch',
  readonly captureCommitted=false,readonly lifecycleCommitted=false,readonly deliveryCommitted=false){
  super(code);this.name='PostgresEventDispatchMigrationError';
 }
}
const bad=():never=>{throw new PostgresEventDispatchMigrationError('INCOMPATIBLE_SCHEMA');};
const tables=['emseepea_event_dispatch_migrations','emseepea_event_dispatch_state'];
const names=['namespace','source_kind','source_id','subscription_id','generation'];
const k=names.join(', ');
const ddl=[
 `CREATE TABLE public.emseepea_event_dispatch_migrations(singleton pg_catalog.bool PRIMARY KEY DEFAULT true CHECK(singleton),version pg_catalog.int4 NOT NULL,revision pg_catalog.text NOT NULL)`,
 `CREATE TABLE public.emseepea_event_dispatch_state(${names.map(n=>`${n} pg_catalog.text NOT NULL`).join(',')},
 config_hash pg_catalog.text NOT NULL CHECK(config_hash ~ '^[0-9a-f]{64}$'),
 transport_generation pg_catalog.int4 NOT NULL DEFAULT 0 CHECK(transport_generation>=0 AND transport_generation<=2147483646),
 task_id pg_catalog.text CHECK(task_id ~ '^emseepea-[0-9a-f]{64}$'),
 lease_id pg_catalog.text,lease_until pg_catalog.timestamptz,due_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 recovery_count pg_catalog.int4 NOT NULL DEFAULT 0 CHECK(recovery_count>=0),
 category pg_catalog.text NOT NULL DEFAULT 'fresh' CHECK(category IN('fresh','present','unknown','unavailable','conflict','ineligible')),
 terminal pg_catalog.bool NOT NULL DEFAULT false,
 PRIMARY KEY(${k}),FOREIGN KEY(${k}) REFERENCES public.emseepea_event_intents(${k}) ON DELETE RESTRICT,
 CHECK((lease_id IS NULL)=(lease_until IS NULL)),CHECK((transport_generation=0)=(task_id IS NULL)))`,
 `CREATE INDEX emseepea_event_dispatch_due ON public.emseepea_event_dispatch_state(namespace,due_at,source_kind,source_id,subscription_id,generation) WHERE NOT terminal`,
];
const expected:Record<string,readonly string[]>={
 emseepea_event_dispatch_migrations:['singleton:16:-1:true','version:23:-1:true','revision:25:-1:true'],
 emseepea_event_dispatch_state:[...names.map(n=>`${n}:25:-1:true`),'config_hash:25:-1:true','transport_generation:23:-1:true','task_id:25:-1:false','lease_id:25:-1:false','lease_until:1184:-1:false','due_at:1184:-1:true','recovery_count:23:-1:true','category:25:-1:true','terminal:16:-1:true'],
};
const constraints=[
 [tables[0],'p','PRIMARY KEY (singleton)'],[tables[0],'c','CHECK (singleton)'],
 [tables[1],'p',`PRIMARY KEY (${k})`],[tables[1],'f',`FOREIGN KEY (${k}) REFERENCES emseepea_event_intents(${k}) ON DELETE RESTRICT`],
 [tables[1],'c',"CHECK ((config_hash ~ '^[0-9a-f]{64}$'::text))"],
 [tables[1],'c','CHECK (((transport_generation >= 0) AND (transport_generation <= 2147483646)))'],
 [tables[1],'c',"CHECK ((task_id ~ '^emseepea-[0-9a-f]{64}$'::text))"],
 [tables[1],'c','CHECK ((recovery_count >= 0))'],
 [tables[1],'c',"CHECK ((category = ANY (ARRAY['fresh'::text, 'present'::text, 'unknown'::text, 'unavailable'::text, 'conflict'::text, 'ineligible'::text])))"],
 [tables[1],'c','CHECK (((lease_id IS NULL) = (lease_until IS NULL)))'],
 [tables[1],'c','CHECK (((transport_generation = 0) = (task_id IS NULL)))'],
];
const catalog=`SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_catalog.pg_get_userbyid(c.relowner)=current_user AS owned,
 pg_catalog.array_agg(a.attname::pg_catalog.text||':'||a.atttypid::pg_catalog.text||':'||a.atttypmod::pg_catalog.text||':'||a.attnotnull::pg_catalog.text ORDER BY a.attnum) AS columns,
 pg_catalog.jsonb_object_agg(a.attname,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) AS defaults
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[])
 GROUP BY c.oid,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relowner`;
async function verify(run:EventSql) {
 const rows=(await run(catalog,[tables])).rows;if(rows.length!==2)bad();
 for(const row of rows){
  if(typeof row.relname!=='string'||row.relkind!=='r'||row.owned!==true||row.relrowsecurity!==false||row.relforcerowsecurity!==false||JSON.stringify(row.columns)!==JSON.stringify(expected[row.relname]))bad();
  const defaults=row.defaults as Record<string,unknown>;if(!defaults||typeof defaults!=='object')bad();
  for(const column of expected[String(row.relname)]??[]){const name=column.split(':')[0]!;
   const value=row.relname===tables[0]&&name==='singleton'?'true':row.relname===tables[1]&&['transport_generation','recovery_count'].includes(name)?'0':
    row.relname===tables[1]&&name==='due_at'?'clock_timestamp()':row.relname===tables[1]&&name==='category'?"'fresh'::text":row.relname===tables[1]&&name==='terminal'?'false':null;
   if(defaults[name]!==value)bad();
  }
 }
 const wanted=new Set(constraints.map(row=>JSON.stringify(row)));
 const found=(await run(`SELECT c.relname,t.contype,pg_catalog.pg_get_constraintdef(t.oid) AS definition,t.convalidated,t.condeferrable,t.condeferred,
 CASE WHEN t.contype IN('p','u') THEN i.indisvalid AND i.indisready AND i.indisunique ELSE true END AS key_valid
 FROM pg_catalog.pg_constraint t JOIN pg_catalog.pg_class c ON c.oid=t.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=t.conindid WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[])`,[tables])).rows;
 for(const row of found)if(row.convalidated!==true||row.condeferrable!==false||row.condeferred!==false||row.key_valid!==true||!wanted.delete(JSON.stringify([row.relname,row.contype,row.definition])))bad();
 if(wanted.size)bad();
 const indexes=(await run(`SELECT c.relname,x.relname AS index_name,i.indisvalid,i.indisready,i.indisunique,
 pg_catalog.pg_get_expr(i.indpred,i.indrelid) AS predicate,
 ARRAY(SELECT a.attname::pg_catalog.text FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY z(num,ord)
 JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=z.num ORDER BY z.ord) AS keys
 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_class x ON x.oid=i.indexrelid WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[])`,[tables])).rows;
 if(indexes.length!==3)bad();
 for(const row of indexes){
  const due=row.index_name==='emseepea_event_dispatch_due';
  const keys=due?['namespace','due_at','source_kind','source_id','subscription_id','generation']:row.relname===tables[0]?['singleton']:names;
  if(row.indisvalid!==true||row.indisready!==true||row.indisunique!==!due||row.predicate!==(due?'(NOT terminal)':null)||JSON.stringify(row.keys)!==JSON.stringify(keys)||due&&row.relname!==tables[1])bad();
 }
 const triggers=(await run(`SELECT t.oid FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[]) AND NOT t.tgisinternal`,[tables])).rows;if(triggers.length)bad();
 const marker=(await run('SELECT singleton,version,revision FROM public.emseepea_event_dispatch_migrations')).rows;
 if(marker.length!==1||marker[0]?.singleton!==true||marker[0].version!==1||marker[0].revision!=='dispatch-v1')bad();
}
/** Runs the capture, lifecycle, and delivery migrations before the dispatch
 * migration. If a later migration fails, earlier prerequisite schemas can
 * remain installed. Serving constructors never call this function.
 */
export function createPostgresEventDispatchMigrator(pool:OwnedEventPool) {
 let prerequisite:ReturnType<typeof createPostgresEventDeliveryMigrator>;
 try{prerequisite=createPostgresEventDeliveryMigrator(pool);}
 catch(error){
  if(error instanceof PostgresEventDeliveryMigrationError){
   throw new PostgresEventDispatchMigrationError(error.code,error.phase,error.captureCommitted,error.lifecycleCommitted,false);
  }
  throw new PostgresEventDispatchMigrationError('UNAVAILABLE');
 }
 const owned=createOwnedEventOperations();let closing=false;
 async function migrate(invocation:ExternalMcpEventInvocation):Promise<void> {
  if(closing)throw new PostgresEventDispatchMigrationError('UNAVAILABLE');
  let captureCommitted=false,lifecycleCommitted=false,deliveryCommitted=false;
  try{
   await prerequisite.migrate(invocation);
   captureCommitted=true;lifecycleCommitted=true;deliveryCommitted=true;
   await owned.run(pool,invocation,async run=>{
    await run('SELECT pg_catalog.pg_advisory_xact_lock(1740126,3)');
    const found=(await run(catalog,[tables])).rows;
    if(found.length===0){for(const statement of ddl)await run(statement);await run("INSERT INTO public.emseepea_event_dispatch_migrations VALUES(true,1,'dispatch-v1')");}
    await verify(run);
   },false,error=>error instanceof PostgresEventDispatchMigrationError);
  }catch(error){
   if(error instanceof PostgresEventDispatchMigrationError){
    throw new PostgresEventDispatchMigrationError(error.code,'dispatch',captureCommitted,lifecycleCommitted,deliveryCommitted);
   }
   if(error instanceof PostgresEventDeliveryMigrationError){
    throw new PostgresEventDispatchMigrationError(error.code,error.phase,error.captureCommitted,error.lifecycleCommitted,false);
   }
   const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
   throw new PostgresEventDispatchMigrationError(
    code==='INCOMPATIBLE_SCHEMA'?'INCOMPATIBLE_SCHEMA':code==='OUTCOME_UNKNOWN'?'OUTCOME_UNKNOWN':'UNAVAILABLE',
    'dispatch',captureCommitted,lifecycleCommitted,deliveryCommitted);
  }
 }
 return Object.freeze({
  migrate(invocation:ExternalMcpEventInvocation){return owned.track(migrate(invocation));},
  async settle(invocation:ExternalMcpEventInvocation){closing=true;const results=await Promise.allSettled([prerequisite.settle(invocation),owned.settle(invocation)]);return results.every(result=>result.status==='fulfilled'&&result.value===true);},
 });
}
