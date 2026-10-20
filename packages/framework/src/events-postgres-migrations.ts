import { performance } from "node:perf_hooks";
import { createOwnedEventOperations } from './events-postgres-owned.js';
import type { PostgresEventClient, PostgresEventInvocation } from "./events-postgres.js";

export interface PostgresEventMigrationClient extends PostgresEventClient { release(error?: Error): void }
export interface PostgresEventMigrationPool { connect(): Promise<PostgresEventMigrationClient> }
export class PostgresEventMigrationError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "DEADLINE" | "ABORTED" | "INCOMPATIBLE_SCHEMA" | "UNAVAILABLE" | "OUTCOME_UNKNOWN") {
    super(code); this.name = "PostgresEventMigrationError";
  }
}
const VERSION = 1;
const REVISION = "capture-v1";
const TABLES = ["emseepea_event_capture_migrations", "emseepea_event_capture_subscriptions", "emseepea_event_sources", "emseepea_event_intents"] as const;
const statements = Object.freeze([
  `CREATE TABLE public.emseepea_event_capture_migrations (
   singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),version integer NOT NULL,revision text NOT NULL)`,
  `CREATE TABLE public.emseepea_event_capture_subscriptions (
   namespace text NOT NULL,subscription_id text NOT NULL,generation text NOT NULL,
   owner_key text NOT NULL,event_name text NOT NULL,arguments jsonb NOT NULL CHECK(jsonb_typeof(arguments)='object'),
   active boolean NOT NULL,expires_at timestamptz NOT NULL,
   PRIMARY KEY(namespace,subscription_id,generation))`,
  `CREATE UNIQUE INDEX emseepea_event_capture_active_generation ON public.emseepea_event_capture_subscriptions(namespace,subscription_id) WHERE active`,
  `CREATE INDEX emseepea_event_capture_candidates ON public.emseepea_event_capture_subscriptions(namespace,owner_key,event_name,subscription_id,generation) WHERE active`,
  `CREATE TABLE public.emseepea_event_sources (
   namespace text NOT NULL,source_kind text NOT NULL,source_id text NOT NULL,source_version text NOT NULL,
   fingerprint text NOT NULL,event_id text NOT NULL UNIQUE,owner_key text NOT NULL,event_name text NOT NULL,
   occurred_at timestamptz NOT NULL,eligibility_at timestamptz NOT NULL,
   recipient_count integer NOT NULL CHECK(recipient_count>=0),payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
   PRIMARY KEY(namespace,source_kind,source_id))`,
  `CREATE TABLE public.emseepea_event_intents (
   namespace text NOT NULL,source_kind text NOT NULL,source_id text NOT NULL,
   subscription_id text NOT NULL,generation text NOT NULL,delivery_id text NOT NULL UNIQUE,event_id text NOT NULL,
   state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','completed','revoked')),
   PRIMARY KEY(namespace,source_kind,source_id,subscription_id,generation),
   FOREIGN KEY(namespace,source_kind,source_id) REFERENCES public.emseepea_event_sources(namespace,source_kind,source_id) ON DELETE CASCADE)`,
]);
/** Deployment migrations. `createPostgresEventCapture` never applies them. */
export const postgresEventCaptureMigrations = Object.freeze([Object.freeze({ version: VERSION, revision: REVISION, statements })]);
const EXPECTED: Readonly<Record<string, readonly string[]>> = Object.freeze({
  emseepea_event_capture_migrations: ["singleton:boolean", "version:integer", "revision:text"],
  emseepea_event_capture_subscriptions: ["namespace:text", "subscription_id:text", "generation:text", "owner_key:text", "event_name:text", "arguments:jsonb", "active:boolean", "expires_at:timestamp with time zone"],
  emseepea_event_sources: ["namespace:text", "source_kind:text", "source_id:text", "source_version:text", "fingerprint:text", "event_id:text", "owner_key:text", "event_name:text", "occurred_at:timestamp with time zone", "eligibility_at:timestamp with time zone", "recipient_count:integer", "payload:jsonb"],
  emseepea_event_intents: ["namespace:text", "source_kind:text", "source_id:text", "subscription_id:text", "generation:text", "delivery_id:text", "event_id:text", "state:text"],
});
const CATALOG = `SELECT c.relname,pg_catalog.pg_get_userbyid(c.relowner) AS owner,current_user AS actor,c.relkind,
 c.relrowsecurity,c.relforcerowsecurity,
 pg_catalog.array_agg(a.attname||':'||pg_catalog.format_type(a.atttypid,a.atttypmod) ORDER BY a.attnum) AS columns,
 pg_catalog.bool_and(a.attnotnull) AS all_not_null,
 pg_catalog.jsonb_object_agg(a.attname,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) AS defaults
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[]) GROUP BY c.oid,c.relname,c.relowner,c.relkind,c.relrowsecurity,c.relforcerowsecurity`;
type Run = (sql: string, values?: readonly unknown[]) => ReturnType<PostgresEventClient["query"]>;
const EXPECTED_CONSTRAINTS: readonly (readonly string[])[] = [
  [TABLES[0], "p", "PRIMARY KEY (singleton)"], [TABLES[0], "c", "CHECK (singleton)"],
  [TABLES[1], "p", "PRIMARY KEY (namespace, subscription_id, generation)"],
  [TABLES[1], "c", "CHECK ((jsonb_typeof(arguments) = 'object'::text))"],
  [TABLES[2], "p", "PRIMARY KEY (namespace, source_kind, source_id)"], [TABLES[2], "u", "UNIQUE (event_id)"],
  [TABLES[2], "c", "CHECK ((recipient_count >= 0))"], [TABLES[2], "c", "CHECK ((jsonb_typeof(payload) = 'object'::text))"],
  [TABLES[3], "p", "PRIMARY KEY (namespace, source_kind, source_id, subscription_id, generation)"],
  [TABLES[3], "u", "UNIQUE (delivery_id)"],
  [TABLES[3], "f", "FOREIGN KEY (namespace, source_kind, source_id) REFERENCES emseepea_event_sources(namespace, source_kind, source_id) ON DELETE CASCADE"],
  [TABLES[3], "c", "CHECK ((state = ANY (ARRAY['pending'::text, 'completed'::text, 'revoked'::text])))"],
];
async function verify(run: Run) {
  const found = (await run(CATALOG, [TABLES])).rows;
  if (found.length !== TABLES.length) throw new PostgresEventMigrationError("INCOMPATIBLE_SCHEMA");
  for (const item of found) {
    if (typeof item.relname !== "string" || item.owner !== item.actor || item.relkind !== "r" || item.all_not_null !== true ||
      item.relrowsecurity !== false || item.relforcerowsecurity !== false ||
      JSON.stringify(item.columns) !== JSON.stringify(EXPECTED[item.relname])) throw new PostgresEventMigrationError("INCOMPATIBLE_SCHEMA");
    const defaults = item.defaults;
    if (!defaults || typeof defaults !== "object") throw new PostgresEventMigrationError("INCOMPATIBLE_SCHEMA");
    for (const column of EXPECTED[item.relname]!) {
      const name = column.split(":")[0]!;
      const expectedDefault = item.relname === TABLES[0] && name === "singleton" ? "true" :
        item.relname === TABLES[3] && name === "state" ? "'pending'::text" : null;
      if ((defaults as Record<string, unknown>)[name] !== expectedDefault) throw new PostgresEventMigrationError("INCOMPATIBLE_SCHEMA");
    }
  }
  const version = (await run("SELECT version,revision FROM public.emseepea_event_capture_migrations WHERE singleton")).rows;
  if (version.length !== 1 || version[0]?.version !== VERSION || version[0]?.revision !== REVISION) throw new PostgresEventMigrationError("INCOMPATIBLE_SCHEMA");
  const constraints = (await run(`SELECT c.relname,t.contype,t.convalidated,t.condeferrable,t.condeferred,
    pg_catalog.pg_get_constraintdef(t.oid) AS definition,
    CASE WHEN t.contype IN ('p','u') THEN i.indisvalid AND i.indisready AND i.indisunique ELSE true END AS key_valid
    FROM pg_catalog.pg_constraint t JOIN pg_catalog.pg_class c ON c.oid=t.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=t.conindid
    WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[])`, [TABLES])).rows;
  if (constraints.length !== EXPECTED_CONSTRAINTS.length) throw new PostgresEventMigrationError("INCOMPATIBLE_SCHEMA");
  const expected = new Set(EXPECTED_CONSTRAINTS.map((item) => JSON.stringify(item)));
  for (const item of constraints) {
    const key = JSON.stringify([item.relname,item.contype,item.definition]);
    if (item.convalidated !== true || item.condeferrable !== false || item.condeferred !== false || item.key_valid !== true ||
      !expected.delete(key)) throw new PostgresEventMigrationError("INCOMPATIBLE_SCHEMA");
  }
  if (expected.size) throw new PostgresEventMigrationError("INCOMPATIBLE_SCHEMA");
  const indexes = (await run(`SELECT ic.relname AS name,tc.relname AS target,tn.nspname AS target_schema,
    pg_catalog.pg_get_userbyid(ic.relowner) AS owner,current_user AS actor,
    i.indisvalid,i.indisready,i.indisunique,i.indnkeyatts,i.indnatts,
    pg_catalog.pg_get_expr(i.indpred,i.indrelid) AS predicate,
    ARRAY(SELECT a.attname::pg_catalog.text FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY AS k(attnum,ordinal)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum ORDER BY k.ordinal) AS keys
    FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=ic.relnamespace JOIN pg_catalog.pg_class tc ON tc.oid=i.indrelid
    JOIN pg_catalog.pg_namespace tn ON tn.oid=tc.relnamespace
    WHERE n.nspname='public' AND ic.relname=ANY($1::pg_catalog.text[])`,
    [["emseepea_event_capture_active_generation","emseepea_event_capture_candidates"]])).rows;
  if (indexes.length !== 2) throw new PostgresEventMigrationError("INCOMPATIBLE_SCHEMA");
  for (const item of indexes) {
    const unique = item.name === "emseepea_event_capture_active_generation";
    const keys = unique ? ["namespace","subscription_id"] : ["namespace","owner_key","event_name","subscription_id","generation"];
    if (item.target !== TABLES[1] || item.target_schema !== "public" || item.owner !== item.actor ||
      item.indisvalid !== true || item.indisready !== true || item.indisunique !== unique || item.predicate !== "active" ||
      Number(item.indnkeyatts) !== keys.length || Number(item.indnatts) !== keys.length || JSON.stringify(item.keys) !== JSON.stringify(keys)) {
      throw new PostgresEventMigrationError("INCOMPATIBLE_SCHEMA");
    }
  }
  const triggers = (await run(`SELECT t.oid FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::pg_catalog.text[])
    AND NOT t.tgisinternal`, [TABLES])).rows;
  if (triggers.length) throw new PostgresEventMigrationError("INCOMPATIBLE_SCHEMA");
}

/** Runs deployment migrations using only the acquired connection, which this function owns.
 * Supported pools must also configure finite acquisition and query timeouts. A local timeout
 * does not prove that PostgreSQL cancelled the operation. Connections with an uncertain outcome
 * are discarded.
 */
export async function migratePostgresEventCapture(pool: PostgresEventMigrationPool, invocation: PostgresEventInvocation): Promise<void> {
  const failure = (code: ConstructorParameters<typeof PostgresEventMigrationError>[0]): never => { throw new PostgresEventMigrationError(code); };
  if (!pool || typeof pool.connect !== "function" || !invocation?.signal || !Number.isFinite(invocation.deadlineMs)) failure("INVALID_INPUT");
  const remaining = Math.min(10000, invocation.deadlineMs - Date.now());
  if (remaining <= 0) failure("DEADLINE");
  const end = performance.now() + remaining;
  const check = () => { if (invocation.signal.aborted) failure("ABORTED"); if (performance.now() >= end) failure("DEADLINE"); };
  check();
  async function bounded<T>(pending: Promise<T>, maximum: number, observeAbort: boolean): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let aborted: (() => void) | undefined;
    try {
      return await Promise.race([pending,new Promise<never>((_resolve,reject) => {
        timer = setTimeout(() => reject(new PostgresEventMigrationError("DEADLINE")),Math.max(1,Math.min(maximum,end-performance.now())));
        if (observeAbort) {
          aborted = () => reject(new PostgresEventMigrationError("ABORTED"));
          invocation.signal.addEventListener("abort",aborted,{once:true});
          if (invocation.signal.aborted) aborted();
        }
      })]);
    } finally {
      if (timer) clearTimeout(timer);
      if (aborted) invocation.signal.removeEventListener("abort",aborted);
    }
  }
  function dispose(client: PostgresEventMigrationClient, uncertain: boolean): boolean {
    try { client.release(uncertain ? new Error("MIGRATION_OUTCOME_UNKNOWN") : undefined); return true; }
    catch { return false; }
  }
  let abandoned = false;
  let pending: Promise<PostgresEventMigrationClient>;
  try { pending = Promise.resolve(pool.connect()); } catch { failure("UNAVAILABLE"); }
  void pending!.then((value) => { if (abandoned) dispose(value,true); }).catch(() => {});
  let client: PostgresEventMigrationClient;
  try { client = await bounded(pending!,1500,true); }
  catch { abandoned = true; throw new PostgresEventMigrationError("UNAVAILABLE"); }
  let uncertain = false;
  let committing = false;
  const run: Run = async (sql,values) => {
    check();
    try {
      const result = await bounded(Promise.resolve().then(() => client.query(sql,values)),3000,true);
      check(); return result;
    } catch (error) {
      if (error instanceof PostgresEventMigrationError) { uncertain = true; failure("OUTCOME_UNKNOWN"); }
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (typeof code !== "string" || !/^[0-9A-Z]{5}$/.test(code) || code.startsWith("08")) uncertain = true;
      throw error;
    }
  };
  let resultError: PostgresEventMigrationError | undefined;
  try {
    await run("BEGIN");
    await run("SET LOCAL search_path=pg_catalog,public,pg_temp; SET LOCAL statement_timeout='1500ms'; SET LOCAL lock_timeout='500ms'");
    await run("SELECT pg_catalog.pg_advisory_xact_lock(1740125,1)");
    const existing = (await run(CATALOG,[TABLES])).rows;
    if (existing.length === 0) {
      for (const statement of statements) await run(statement);
      await run("INSERT INTO public.emseepea_event_capture_migrations(singleton,version,revision) VALUES(true,$1,$2)",[VERSION,REVISION]);
    }
    await verify(run);
    committing = true; await run("COMMIT"); committing = false;
  } catch (error) {
    uncertain ||= committing;
    if (!uncertain) {
      try { await bounded(Promise.resolve().then(() => client.query("ROLLBACK")),1000,false); }
      catch { uncertain = true; }
    }
    resultError = uncertain ? new PostgresEventMigrationError("OUTCOME_UNKNOWN") :
      error instanceof PostgresEventMigrationError ? error : new PostgresEventMigrationError("UNAVAILABLE");
  } finally {
    if (!dispose(client,uncertain)) resultError = new PostgresEventMigrationError("OUTCOME_UNKNOWN");
  }
  if (resultError) throw resultError;
}

/** Creates lifecycle-managed migration operations for composed deployments. The standalone
 * migration function retains its existing contract. This owner stops accepting work when
 * shutdown begins, never closes the supplied pool, and does not treat a caller-facing
 * deadline as proof of SQL cancellation. */
export function createPostgresEventCaptureMigrator(pool: PostgresEventMigrationPool) {
  if (!pool || typeof pool.connect !== 'function') throw new PostgresEventMigrationError('INVALID_INPUT');
  const owned = createOwnedEventOperations();
  let closing = false, disposalFailed = false;
  const retainedPool: PostgresEventMigrationPool = {
    async connect() {
      const client = await pool.connect();
      const queries = new Set<Promise<unknown>>();
      let released = false;
      return {
        query: ((sql: string, values?: readonly unknown[]) => {
          if (released) return Promise.reject(new PostgresEventMigrationError('UNAVAILABLE'));
          const pending = owned.track(Promise.resolve().then(() => client.query(sql, values)));
          queries.add(pending);
          void pending.then(() => queries.delete(pending), () => queries.delete(pending));
          return pending;
        }) as PostgresEventMigrationClient['query'],
        release(error?: Error) {
          if (released) { disposalFailed = true; return; }
          released = true;
          // release is synchronous in pg, but disposal must wait for actual raw
          // query completion and remain retained independently of method outcome.
          owned.track(Promise.allSettled([...queries]).then(() => {
            try { client.release(error); } catch { disposalFailed = true; }
          }));
        },
      };
    },
  };
  return Object.freeze({
    async migrate(invocation: PostgresEventInvocation): Promise<void> {
      if (closing) throw new PostgresEventMigrationError('UNAVAILABLE');
      try {
        await owned.run(retainedPool, invocation, async run => {
          await run('SELECT pg_catalog.pg_advisory_xact_lock(1740125,1)');
          // A missing capture catalog is not evidence of an empty Events store:
          // views, partial objects and retained later families forbid recreation.
          const reserved = (await run(`SELECT c.relname,c.relkind FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND pg_catalog.starts_with(c.relname::pg_catalog.text,'emseepea_event_')`)).rows;
          if (reserved.length === 0) {
            for (const statement of statements) await run(statement);
            await run('INSERT INTO public.emseepea_event_capture_migrations(singleton,version,revision) VALUES(true,$1,$2)', [VERSION,REVISION]);
          }
          await verify(run);
        }, false, error => error instanceof PostgresEventMigrationError);
      } catch (error) {
        if (error instanceof PostgresEventMigrationError) throw error;
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
        throw new PostgresEventMigrationError(code === 'OUTCOME_UNKNOWN' ? code : code === 'ABORTED' || code === 'DEADLINE' || code === 'INVALID_INPUT' ? code : 'UNAVAILABLE');
      }
    },
    async settle(invocation: PostgresEventInvocation): Promise<boolean> {
      closing = true;
      return await owned.settle(invocation) && !disposalFailed;
    },
  });
}
