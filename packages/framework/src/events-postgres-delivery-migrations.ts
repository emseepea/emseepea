import {
 createPostgresEventLifecycleMigrator,
 PostgresEventLifecycleMigrationError,
} from './events-postgres-lifecycle-migrations.js';
import { createOwnedEventOperations, type OwnedEventPool, type EventSql } from './events-postgres-owned.js';
import type { ExternalMcpEventInvocation } from './events-external.js';
export class PostgresEventDeliveryMigrationError extends Error {
  constructor(readonly code:'INCOMPATIBLE_SCHEMA'|'UNAVAILABLE'|'OUTCOME_UNKNOWN',
    readonly phase:'capture'|'lifecycle'|'delivery'='delivery',
    readonly captureCommitted=false,readonly lifecycleCommitted=false){
    super(code);this.name='PostgresEventDeliveryMigrationError';
  }
}
const incompatible=():never=>{throw new PostgresEventDeliveryMigrationError('INCOMPATIBLE_SCHEMA');};
const tables=['emseepea_event_delivery_migrations','emseepea_event_delivery_state','emseepea_event_delivery_attempts'];
const names='namespace,source_kind,source_id,subscription_id,generation';
const keyColumns=names.split(',').map(name=>`${name} pg_catalog.text NOT NULL`).join(',');
const keyTypes=names.split(',').map(name=>`${name}:25:-1:true`);
const ddl=[
 `CREATE TABLE public.emseepea_event_delivery_migrations(singleton pg_catalog.bool PRIMARY KEY DEFAULT true CHECK(singleton),version pg_catalog.int4 NOT NULL,revision pg_catalog.text NOT NULL)`,
 `CREATE TABLE public.emseepea_event_delivery_state(${keyColumns},reservations pg_catalog.int4 NOT NULL DEFAULT 0 CHECK(reservations>=0 AND reservations<=4),
 lease_id pg_catalog.text,lease_until pg_catalog.timestamptz,due_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),terminal pg_catalog.text CHECK(terminal IN('accepted','suppressed','gone','too_large','exhausted')),
 PRIMARY KEY(${names}),FOREIGN KEY(${names}) REFERENCES public.emseepea_event_intents(${names}) ON DELETE RESTRICT,CHECK((lease_id IS NULL)=(lease_until IS NULL)))`,
 `CREATE TABLE public.emseepea_event_delivery_attempts(${keyColumns},attempt pg_catalog.int4 NOT NULL CHECK(attempt>=1 AND attempt<=4),reservation_id pg_catalog.text NOT NULL UNIQUE,
 lease_id pg_catalog.text NOT NULL,reserved_at pg_catalog.timestamptz NOT NULL,outcome pg_catalog.text NOT NULL CHECK(outcome IN('reserved','accepted','failed','terminal')),
 status pg_catalog.int4 CHECK(status>=100 AND status<=599),PRIMARY KEY(${names},attempt),FOREIGN KEY(${names}) REFERENCES public.emseepea_event_delivery_state(${names}) ON DELETE RESTRICT)`,
];
const expected:Record<string,readonly string[]>={
 emseepea_event_delivery_migrations:['singleton:16:-1:true','version:23:-1:true','revision:25:-1:true'],
 emseepea_event_delivery_state:[...keyTypes,'reservations:23:-1:true','lease_id:25:-1:false','lease_until:1184:-1:false','due_at:1184:-1:true','terminal:25:-1:false'],
 emseepea_event_delivery_attempts:[...keyTypes,'attempt:23:-1:true','reservation_id:25:-1:true','lease_id:25:-1:true','reserved_at:1184:-1:true','outcome:25:-1:true','status:23:-1:false'],
};
const catalog=`SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_catalog.pg_get_userbyid(c.relowner)=current_user AS owned,
 pg_catalog.array_agg(a.attname::pg_catalog.text||':'||a.atttypid::pg_catalog.text||':'||a.atttypmod::pg_catalog.text||':'||a.attnotnull::pg_catalog.text ORDER BY a.attnum) AS columns,
 pg_catalog.jsonb_object_agg(a.attname,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) AS defaults
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[])
 GROUP BY c.oid,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relowner`;
const spaced=names.split(',').join(', ');
const expectedConstraints=[
 [tables[0],'p','PRIMARY KEY (singleton)'],[tables[0],'c','CHECK (singleton)'],
 [tables[1],'p',`PRIMARY KEY (${spaced})`],
 [tables[1],'f',`FOREIGN KEY (${spaced}) REFERENCES emseepea_event_intents(${spaced}) ON DELETE RESTRICT`],
 [tables[1],'c','CHECK (((reservations >= 0) AND (reservations <= 4)))'],
 [tables[1],'c',"CHECK ((terminal = ANY (ARRAY['accepted'::text, 'suppressed'::text, 'gone'::text, 'too_large'::text, 'exhausted'::text])))"],
 [tables[1],'c','CHECK (((lease_id IS NULL) = (lease_until IS NULL)))'],
 [tables[2],'p',`PRIMARY KEY (${spaced}, attempt)`],[tables[2],'u','UNIQUE (reservation_id)'],
 [tables[2],'f',`FOREIGN KEY (${spaced}) REFERENCES emseepea_event_delivery_state(${spaced}) ON DELETE RESTRICT`],
 [tables[2],'c','CHECK (((attempt >= 1) AND (attempt <= 4)))'],
 [tables[2],'c',"CHECK ((outcome = ANY (ARRAY['reserved'::text, 'accepted'::text, 'failed'::text, 'terminal'::text])))"],
 [tables[2],'c','CHECK (((status >= 100) AND (status <= 599)))'],
];
async function verify(run:EventSql) {
 const rows=(await run(catalog,[tables])).rows;if(rows.length!==3)incompatible();
 for(const row of rows){
  if(typeof row.relname!=='string'||row.relkind!=='r'||row.owned!==true||row.relrowsecurity!==false||row.relforcerowsecurity!==false||JSON.stringify(row.columns)!==JSON.stringify(expected[row.relname]))incompatible();
  const defaults=row.defaults as Record<string,unknown>;if(!defaults||typeof defaults!=='object')incompatible();
  for(const column of expected[String(row.relname)]??[]){const name=column.split(':')[0]!;
   const wanted=row.relname===tables[0]&&name==='singleton'?'true':row.relname===tables[1]&&name==='reservations'?'0':row.relname===tables[1]&&name==='due_at'?'clock_timestamp()':null;
   if(defaults[name]!==wanted)incompatible();
  }
 }
 const wanted=new Set(expectedConstraints.map(row=>JSON.stringify(row)));
 const constraints=(await run(`SELECT c.relname,t.contype,pg_catalog.pg_get_constraintdef(t.oid) AS definition,t.convalidated,t.condeferrable,t.condeferred,
 CASE WHEN t.contype IN('p','u') THEN i.indisvalid AND i.indisready AND i.indisunique ELSE true END AS key_valid
 FROM pg_catalog.pg_constraint t JOIN pg_catalog.pg_class c ON c.oid=t.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=t.conindid WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[])`,[tables])).rows;
 for(const row of constraints)if(row.convalidated!==true||row.condeferrable!==false||row.condeferred!==false||row.key_valid!==true||!wanted.delete(JSON.stringify([row.relname,row.contype,row.definition])))incompatible();
 if(wanted.size)incompatible();
 const indexes=(await run(`SELECT i.indexrelid FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[])`,[tables])).rows;
 if(indexes.length!==4)incompatible();
 const triggers=(await run(`SELECT t.oid FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[]) AND NOT t.tgisinternal`,[tables])).rows;
 if(triggers.length)incompatible();
 const marker=(await run('SELECT singleton,version,revision FROM public.emseepea_event_delivery_migrations')).rows;
 if(marker.length!==1||marker[0]?.singleton!==true||marker[0].version!==1||marker[0].revision!=='delivery-v1')incompatible();
}
/** Runs the capture and lifecycle migrations before the delivery migration. If a
 * later migration fails, earlier prerequisite schemas can remain installed.
 * Serving constructors never call this function.
 */
export function createPostgresEventDeliveryMigrator(pool:OwnedEventPool) {
 let prerequisite:ReturnType<typeof createPostgresEventLifecycleMigrator>;
 try{prerequisite=createPostgresEventLifecycleMigrator(pool);}
 catch(error){
  if(error instanceof PostgresEventLifecycleMigrationError){
   throw new PostgresEventDeliveryMigrationError(error.code,error.phase,error.captureCommitted,false);
  }
  throw new PostgresEventDeliveryMigrationError('UNAVAILABLE');
 }
 const owned=createOwnedEventOperations();let closing=false;
 async function migrate(invocation:ExternalMcpEventInvocation):Promise<void> {
  if(closing)throw new PostgresEventDeliveryMigrationError('UNAVAILABLE');
  let captureCommitted=false,lifecycleCommitted=false;
  try{
   await prerequisite.migrate(invocation);
   captureCommitted=true;lifecycleCommitted=true;
   await owned.run(pool,invocation,async run=>{
    await run('SELECT pg_catalog.pg_advisory_xact_lock(1740126,2)');
    const found=(await run(catalog,[tables])).rows;
    if(found.length===0){for(const statement of ddl)await run(statement);await run("INSERT INTO public.emseepea_event_delivery_migrations VALUES(true,1,'delivery-v1')");}
    await verify(run);
   },false,error=>error instanceof PostgresEventDeliveryMigrationError);
  }catch(error){
   if(error instanceof PostgresEventDeliveryMigrationError){
    throw new PostgresEventDeliveryMigrationError(error.code,'delivery',captureCommitted,lifecycleCommitted);
   }
   if(error instanceof PostgresEventLifecycleMigrationError){
    throw new PostgresEventDeliveryMigrationError(error.code,error.phase,error.captureCommitted,false);
   }
   const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
   throw new PostgresEventDeliveryMigrationError(
    code==='INCOMPATIBLE_SCHEMA'?'INCOMPATIBLE_SCHEMA':code==='OUTCOME_UNKNOWN'?'OUTCOME_UNKNOWN':'UNAVAILABLE',
    'delivery',captureCommitted,lifecycleCommitted);
  }
 }
 return Object.freeze({
  migrate(invocation:ExternalMcpEventInvocation){return owned.track(migrate(invocation));},
  async settle(invocation:ExternalMcpEventInvocation){closing=true;const results=await Promise.allSettled([prerequisite.settle(invocation),owned.settle(invocation)]);return results.every(result=>result.status==='fulfilled'&&result.value===true);},
 });
}
