import { createPostgresEventCaptureMigrator, type PostgresEventMigrationPool } from './events-postgres-migrations.js';
import type { PostgresEventInvocation } from './events-postgres.js';
import { createOwnedEventOperations, type EventSql } from './events-postgres-owned.js';
export class PostgresEventLifecycleMigrationError extends Error {
  constructor(readonly code:'INCOMPATIBLE_SCHEMA'|'UNAVAILABLE'|'OUTCOME_UNKNOWN',
    readonly phase:'capture'|'lifecycle'='lifecycle', readonly captureCommitted=false) {super(code);this.name='PostgresEventLifecycleMigrationError';}
}
const incompatible=():never=>{throw new PostgresEventLifecycleMigrationError('INCOMPATIBLE_SCHEMA');};
const tables=['emseepea_event_lifecycle_migrations','emseepea_event_heads','emseepea_event_keys'];
const ddl=[
 `CREATE TABLE public.emseepea_event_lifecycle_migrations(singleton pg_catalog.bool PRIMARY KEY DEFAULT true CHECK(singleton),version pg_catalog.int4 NOT NULL,revision pg_catalog.text NOT NULL)`,
 `CREATE TABLE public.emseepea_event_heads(namespace pg_catalog.text NOT NULL,subscription_id pg_catalog.text NOT NULL,owner_key pg_catalog.text NOT NULL,url pg_catalog.text,revision pg_catalog.text NOT NULL,generation pg_catalog.text,PRIMARY KEY(namespace,subscription_id))`,
 `CREATE TABLE public.emseepea_event_keys(namespace pg_catalog.text NOT NULL,subscription_id pg_catalog.text NOT NULL,generation pg_catalog.text NOT NULL,secret pg_catalog.text NOT NULL,previous_secret pg_catalog.text,previous_until pg_catalog.timestamptz,verified_until pg_catalog.timestamptz NOT NULL,
 PRIMARY KEY(namespace,subscription_id,generation),FOREIGN KEY(namespace,subscription_id,generation) REFERENCES public.emseepea_event_capture_subscriptions(namespace,subscription_id,generation),CHECK((previous_secret IS NULL)=(previous_until IS NULL)))`,
];
const expected:Record<string,readonly string[]>={
 emseepea_event_lifecycle_migrations:['singleton:16:-1:true','version:23:-1:true','revision:25:-1:true'],
 emseepea_event_heads:['namespace:25:-1:true','subscription_id:25:-1:true','owner_key:25:-1:true','url:25:-1:false','revision:25:-1:true','generation:25:-1:false'],
 emseepea_event_keys:['namespace:25:-1:true','subscription_id:25:-1:true','generation:25:-1:true','secret:25:-1:true','previous_secret:25:-1:false','previous_until:1184:-1:false','verified_until:1184:-1:true'],
};
const catalog=`SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_catalog.pg_get_userbyid(c.relowner)=current_user AS owned,
 pg_catalog.array_agg(a.attname::pg_catalog.text||':'||a.atttypid::pg_catalog.text||':'||a.atttypmod::pg_catalog.text||':'||a.attnotnull::pg_catalog.text ORDER BY a.attnum) AS columns,
 pg_catalog.jsonb_object_agg(a.attname,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) AS defaults
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[]) GROUP BY c.oid,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relowner`;
async function verify(run:EventSql) {
  const rows=(await run(catalog,[tables])).rows;
  if(rows.length!==3)incompatible();
  for(const row of rows) {
    if(typeof row.relname!=='string'||row.relkind!=='r'||row.owned!==true||row.relrowsecurity!==false||row.relforcerowsecurity!==false||JSON.stringify(row.columns)!==JSON.stringify(expected[row.relname]))incompatible();
    const defaults=row.defaults as Record<string,unknown>;
    if(!defaults||typeof defaults!=='object')incompatible();
    for(const item of expected[String(row.relname)]??[]) {
      const column=item.split(':')[0]!;
      if(defaults[column]!== (row.relname===tables[0]&&column==='singleton'?'true':null))incompatible();
    }
  }
  const wanted=new Set([
    [tables[0],'p','PRIMARY KEY (singleton)'],[tables[0],'c','CHECK (singleton)'],
    [tables[1],'p','PRIMARY KEY (namespace, subscription_id)'],
    [tables[2],'p','PRIMARY KEY (namespace, subscription_id, generation)'],
    [tables[2],'f','FOREIGN KEY (namespace, subscription_id, generation) REFERENCES emseepea_event_capture_subscriptions(namespace, subscription_id, generation)'],
    [tables[2],'c','CHECK (((previous_secret IS NULL) = (previous_until IS NULL)))'],
  ].map(value=>JSON.stringify(value)));
  const constraints=(await run(`SELECT c.relname,t.contype,pg_catalog.pg_get_constraintdef(t.oid) AS definition,t.convalidated,t.condeferrable,t.condeferred,
    CASE WHEN t.contype='p' THEN i.indisvalid AND i.indisready AND i.indisunique ELSE true END AS key_valid
    FROM pg_catalog.pg_constraint t JOIN pg_catalog.pg_class c ON c.oid=t.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=t.conindid WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[])`,[tables])).rows;
  for(const row of constraints)if(row.convalidated!==true||row.condeferrable!==false||row.condeferred!==false||row.key_valid!==true||!wanted.delete(JSON.stringify([row.relname,row.contype,row.definition])))incompatible();
  if(wanted.size)incompatible();
  const indexes=(await run(`SELECT i.indexrelid FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[])`,[tables])).rows;
  if(indexes.length!==3)incompatible();
  const triggers=(await run(`SELECT t.oid FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[]) AND NOT t.tgisinternal`,[tables])).rows;
  if(triggers.length)incompatible();
  const marker=(await run('SELECT singleton,version,revision FROM public.emseepea_event_lifecycle_migrations')).rows;
  if(marker.length!==1||marker[0]?.singleton!==true||marker[0].version!==1||marker[0].revision!=='lifecycle-v1')incompatible();
}
/** Runs the capture migration before the lifecycle migration. If the lifecycle migration fails, `capture-v1` can remain installed.
 * The lifecycle migration rejects an existing populated capture-only subscription store because it cannot establish verification state safely.
 * Serving constructors never call this function. The deployment owner must configure database grants.
 */
export function createPostgresEventLifecycleMigrator(pool:PostgresEventMigrationPool) {
  if(!pool||typeof pool.connect!=='function')throw new PostgresEventLifecycleMigrationError('UNAVAILABLE');
  const owned=createOwnedEventOperations();
  let closing=false;
  const prerequisite=createPostgresEventCaptureMigrator(pool);
  async function migrate(invocation:PostgresEventInvocation):Promise<void> {
    if(closing)throw new PostgresEventLifecycleMigrationError('UNAVAILABLE');
    let captureCommitted=false;
    try {
      await prerequisite.migrate(invocation);
      captureCommitted=true;
      await owned.run(pool,invocation,async run=>{
        await run('SELECT pg_catalog.pg_advisory_xact_lock(1740126,1)');
        const found=(await run(catalog,[tables])).rows;
        if(found.length===0) {
          await run('LOCK TABLE public.emseepea_event_capture_subscriptions IN SHARE ROW EXCLUSIVE MODE');
          const present=(await run('SELECT 1 FROM public.emseepea_event_capture_subscriptions LIMIT 1')).rows;
          if(present.length)incompatible();
          for(const statement of ddl)await run(statement);
          await run("INSERT INTO public.emseepea_event_lifecycle_migrations VALUES(true,1,'lifecycle-v1')");
        }
        await verify(run);
      },false,error=>error instanceof PostgresEventLifecycleMigrationError);
    } catch(error) {
      const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
      throw new PostgresEventLifecycleMigrationError(code==='OUTCOME_UNKNOWN'?'OUTCOME_UNKNOWN':code==='INCOMPATIBLE_SCHEMA'?'INCOMPATIBLE_SCHEMA':'UNAVAILABLE',captureCommitted?'lifecycle':'capture',captureCommitted);
    }
  }
  return Object.freeze({
    migrate(invocation:PostgresEventInvocation) {return owned.track(migrate(invocation));},
    async settle(invocation:PostgresEventInvocation) {
      closing=true;
      const results=await Promise.all([prerequisite.settle(invocation),owned.settle(invocation)]);
      return results.every(Boolean);
    },
  });
}
