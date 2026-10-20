// Run only on a new explicitly owned disposable PG17.11 loopback fixture.
// env -i PATH="$PATH" node packages/framework/test/events-postgres.integration.mjs PROJECT_ROOT PORT
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, isAbsolute } from 'node:path';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { createPostgresEventCapture, migratePostgresEventCapture } from '../dist/events-postgres.js';
const [project, textPort] = process.argv.slice(2);
const port = Number(textPort);
if (!isAbsolute(project ?? '') || !Number.isInteger(port) || port < 1024 || port > 65535) process.exit(2);
const require = createRequire(join(project, 'package.json'));
const { Pool } = require('pg');
assert.equal(require('pg/package.json').version, '8.23.0');
// Exact installed-driver decoding, without changing any parser registration.
assert.equal(typeof require('pg').types.getTypeParser(1003,'text')('{namespace,subscription_id}'),'string');
assert.deepEqual(require('pg').types.getTypeParser(1009,'text')('{namespace,subscription_id}'),['namespace','subscription_id']);
const pools = [];
const owned = new Set();
const report = { scope: 'POSTGRES_CAPTURE_FOUNDATION', node: process.version,
  platform: `${process.platform}/${process.arch}`, pgVersion: '8.23.0', cases: [] };
const hard = setTimeout(() => { process.stderr.write('WHOLE_PROCESS_DEADLINE\n'); process.exit(1); }, 90000);
const config = (user) => ({ host: '127.0.0.1', port, database: 'postgres', user, password: 'synthetic-fixture-not-a-secret',
  application_name: 'emseepea_capture_implementation_probe', ssl: false, connectionTimeoutMillis: 1500,
  query_timeout: 3000, statement_timeout: 1500, lock_timeout: 500, idle_in_transaction_session_timeout: 10000,
  max: 3, idleTimeoutMillis: 1000, pipeline: false });
const pool = (user) => { const value = new Pool(config(user)); pools.push(value); return value; };
const inv = (ms = 10000) => ({ signal: new AbortController().signal, deadlineMs: Date.now()+ms });
const definition = { name: 'synthetic.reply', description: 'Synthetic reply reference.',
  inputSchema: z.strictObject({ threadId: z.string() }),
  payloadSchema: z.strictObject({ threadId: z.string(), messageId: z.string() }),
  matches: (args, data) => args.threadId === data.threadId };
const api = createPostgresEventCapture({ namespace: 'synthetic', sourceKind: 'reply', definitions: [definition] });
const source = (patch = {}) => ({ sourceEventId: 'reply:123:version:1', sourceVersion: '1', eventName: definition.name,
  ownerKey: 'owner:1', occurredAt: '2026-10-16T00:00:00.000Z', data: { threadId: 'thread:1', messageId: 'message:1' }, ...patch });
let admin, migration, runtime;
const own = async (from) => { const client = await from.connect(); owned.add(client); return client; };
const release = async (client) => { try { await client.query('ROLLBACK'); } finally { client.release(); owned.delete(client); } };
const begin = (client, isolation = 'REPEATABLE READ') => {
  assert.ok(['REPEATABLE READ', 'SERIALIZABLE'].includes(isolation));
  return client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
};
const reject = (promise, code) => assert.rejects(promise, (error) => error?.code === code);
const counts = async () => ({ sources: Number((await admin.query('SELECT count(*)::int AS n FROM public.emseepea_event_sources')).rows[0].n),
  intents: Number((await admin.query('SELECT count(*)::int AS n FROM public.emseepea_event_intents')).rows[0].n) });
async function reset() {
  for (const client of [...owned]) await release(client);
  await admin.query('TRUNCATE public.emseepea_event_intents,public.emseepea_event_sources,public.emseepea_event_capture_subscriptions');
  await admin.query(`INSERT INTO public.emseepea_event_capture_subscriptions VALUES
   ('synthetic','sub:1','g:1','owner:1','synthetic.reply','{"threadId":"thread:1"}',true,now()+interval '1 hour'),
   ('synthetic','sub:other','g:1','owner:other','synthetic.reply','{"threadId":"thread:1"}',true,now()+interval '1 hour')`);
}
async function run(name, fn, shouldReset = true) {
  const started = performance.now();
  try {
    if (shouldReset) await reset();
    const facts = await fn();
    report.cases.push({ name, status: 'PASS', ...facts, elapsedMs: Math.round(performance.now()-started) });
  } catch (error) {
    report.cases.push({ name, status: 'FAIL', category: /^[A-Z0-9_]{1,60}$/.test(error?.code ?? '') ? error.code : 'ASSERTION_OR_FIXTURE_FAILED', elapsedMs: Math.round(performance.now()-started) });
  } finally { for (const client of [...owned]) await release(client); }
}
try {
  admin = pool('postgres');
  report.serverVersionNum = (await admin.query('SHOW server_version_num')).rows[0].server_version_num;
  assert.equal(report.serverVersionNum, '170011');
  await admin.query("CREATE ROLE emseepea_capture_migrator LOGIN PASSWORD 'synthetic-fixture-not-a-secret'");
  await admin.query("CREATE ROLE emseepea_capture_runtime LOGIN PASSWORD 'synthetic-fixture-not-a-secret'");
  await admin.query('GRANT USAGE,CREATE ON SCHEMA public TO emseepea_capture_migrator');
  await admin.query('GRANT USAGE ON SCHEMA public TO emseepea_capture_runtime');
  migration = pool('emseepea_capture_migrator'); runtime = pool('emseepea_capture_runtime');
  // No runtime grants exist yet. Explicit migration entry is the only DDL path.
  await run('fresh migration then exact repeat with separate migration role', async () => {
    const observedKeyOids = [];
    const inspectedPool = { async connect() {
      const client = await migration.connect();
      return { async query(sql,values) {
        const result = await client.query(sql,values);
        const keyField = result.fields?.find((field) => field.name === 'keys');
        if (keyField) {
          observedKeyOids.push(keyField.dataTypeID);
          assert.equal(keyField.dataTypeID,1009);
          assert.ok(result.rows.every((row) => Array.isArray(row.keys)));
        }
        return result;
      }, release(error) { client.release(error); } };
    } };
    await migratePostgresEventCapture(inspectedPool, inv()); await migratePostgresEventCapture(inspectedPool, inv());
    assert.deepEqual(observedKeyOids,[1009,1009]);
    const saved = (await admin.query('SELECT version,revision FROM public.emseepea_event_capture_migrations')).rows;
    assert.deepEqual(saved, [{ version: 1, revision: 'capture-v1' }]);
    return { schemaVersion: 1, repeatSafe: true, catalogKeysOid:1009, catalogKeyArraysObserved:true };
  }, false);
  if (report.cases[0]?.status !== 'PASS') throw new Error('MIGRATION_PREREQUISITE_FAILED');
  await admin.query('GRANT SELECT ON public.emseepea_event_sources,public.emseepea_event_intents,public.emseepea_event_capture_subscriptions TO emseepea_capture_runtime');
  await admin.query('GRANT INSERT ON public.emseepea_event_sources,public.emseepea_event_intents TO emseepea_capture_runtime');
  await run('runtime denied DDL and subscription mutation', async () => {
    await reject(runtime.query('CREATE TABLE public.e174_runtime_denied(id int)'), '42501');
    await reject(runtime.query('ALTER TABLE public.emseepea_event_sources ADD COLUMN denied text'), '42501');
    await reject(runtime.query('DROP TABLE public.emseepea_event_intents'), '42501');
    await reject(runtime.query('DELETE FROM public.emseepea_event_capture_subscriptions'), '42501');
    return { runtimeDDLAndSubscriptionWritesDenied: true, databaseTenantIsolationClaimed: false };
  });
  for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE']) await run(`${isolation} capture commits through restricted runtime role`, async () => {
    const client = await own(runtime); await begin(client, isolation);
    const handle = await api.bindTransaction(client, inv());
    const captured = await api.captureInTransaction(handle, source(), inv());
    assert.equal(captured.deliveryCount, 1); assert.deepEqual(await counts(), { sources: 0, intents: 0 });
    await client.query('COMMIT');
    assert.deepEqual(await counts(), { sources: 1, intents: 1 });
    const recipients = (await admin.query('SELECT subscription_id,generation,event_id FROM public.emseepea_event_intents')).rows;
    assert.deepEqual(recipients, [{ subscription_id: 'sub:1', generation: 'g:1', event_id: captured.eventId }]);
    await begin(client); const second = await api.bindTransaction(client, inv());
    const replay = await api.captureInTransaction(second, source(), inv());
    assert.deepEqual(replay, { ...captured, outcome: 'replayed' }); return { restrictedRoleCommit: true, exactReplay: true };
  });
  await run('autocommit and READ COMMITTED cannot bind capture work', async () => {
    const autocommit = await own(runtime);
    await reject(api.bindTransaction(autocommit, inv()), 'UNSUPPORTED_TRANSACTION_POLICY');
    const readCommitted = await own(runtime); await readCommitted.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await reject(api.bindTransaction(readCommitted, inv()), 'UNSUPPORTED_TRANSACTION_POLICY');
    await readCommitted.query('ROLLBACK');
    return { autocommitRejected: true, readCommittedRejected: true };
  });
  await run('capture rejects a transaction identity changed after binding', async () => {
    const client = await own(runtime); await begin(client);
    const handle = await api.bindTransaction(client, inv());
    await client.query('COMMIT'); await begin(client);
    await reject(api.captureInTransaction(handle, source(), inv()), 'TRANSACTION_CHANGED');
    await client.query('ROLLBACK');
    return { changedTransactionRejected: true };
  });
  await run('later committed subscription remains outside the earlier capture snapshot', async () => {
    await admin.query('DELETE FROM public.emseepea_event_capture_subscriptions');
    const client = await own(runtime); await begin(client);
    const handle = await api.bindTransaction(client, inv());
    await admin.query(`INSERT INTO public.emseepea_event_capture_subscriptions VALUES
      ('synthetic','later','g:1','owner:1','synthetic.reply','{"threadId":"thread:1"}',true,now()+interval '1 hour')`);
    const captured = await api.captureInTransaction(handle, source(), inv());
    assert.equal(captured.deliveryCount, 0); await client.query('COMMIT');
    assert.deepEqual(await counts(), { sources: 1, intents: 0 });
    return { laterCommitExcluded: true };
  });
  await run('inactive and expired generations are excluded from capture', async () => {
    await admin.query('DELETE FROM public.emseepea_event_capture_subscriptions');
    await admin.query(`INSERT INTO public.emseepea_event_capture_subscriptions VALUES
      ('synthetic','active','g:1','owner:1','synthetic.reply','{"threadId":"thread:1"}',true,now()+interval '1 hour'),
      ('synthetic','inactive','g:1','owner:1','synthetic.reply','{"threadId":"thread:1"}',false,now()+interval '1 hour'),
      ('synthetic','expired','g:1','owner:1','synthetic.reply','{"threadId":"thread:1"}',true,now()-interval '1 second')`);
    const client = await own(runtime); await begin(client); const handle = await api.bindTransaction(client, inv());
    const captured = await api.captureInTransaction(handle, source(), inv());
    assert.equal(captured.deliveryCount, 1); await client.query('COMMIT');
    const recipients = (await admin.query('SELECT subscription_id,generation FROM public.emseepea_event_intents')).rows;
    assert.deepEqual(recipients, [{ subscription_id: 'active', generation: 'g:1' }]);
    return { inactiveExcluded: true, expiredExcluded: true };
  });
  await run('1001 eligible generations are captured without truncation', async () => {
    await admin.query('DELETE FROM public.emseepea_event_capture_subscriptions');
    await admin.query(`INSERT INTO public.emseepea_event_capture_subscriptions
      SELECT 'synthetic','sub:'||lpad(i::text,4,'0'),'g:1','owner:1','synthetic.reply',
      '{"threadId":"thread:1"}',true,now()+interval '1 hour' FROM generate_series(1,1001) i`);
    const client = await own(runtime); await begin(client); const handle = await api.bindTransaction(client, inv());
    const captured = await api.captureInTransaction(handle, source(), inv());
    assert.equal(captured.deliveryCount, 1001); await client.query('COMMIT');
    const recorded = (await admin.query(`SELECT recipient_count,
      (SELECT count(*)::int FROM public.emseepea_event_intents) AS intent_count,
      (SELECT count(DISTINCT (subscription_id,generation))::int FROM public.emseepea_event_intents) AS identity_count
      FROM public.emseepea_event_sources`)).rows[0];
    assert.deepEqual(recorded, { recipient_count: 1001, intent_count: 1001, identity_count: 1001 });
    const bounds = (await admin.query(`SELECT min(subscription_id) AS first,max(subscription_id) AS last
      FROM public.emseepea_event_intents`)).rows[0];
    assert.deepEqual(bounds, { first: 'sub:0001', last: 'sub:1001' });
    return { exactRecipientCount: 1001, exactIntentIdentities: 1001 };
  });
  await run('caller-owned rollback leaves no source or intent', async () => {
    const client = await own(runtime); await begin(client); const handle = await api.bindTransaction(client, inv());
    await api.captureInTransaction(handle, source(), inv()); await client.query('ROLLBACK');
    assert.deepEqual(await counts(), { sources: 0, intents: 0 }); return { confirmedRollback: true };
  });
  await run('zero audience never expands on replay after later subscription', async () => {
    await admin.query('DELETE FROM public.emseepea_event_capture_subscriptions');
    const client = await own(runtime); await begin(client); let handle = await api.bindTransaction(client, inv());
    const first = await api.captureInTransaction(handle, source(), inv()); assert.equal(first.deliveryCount, 0); await client.query('COMMIT');
    await admin.query(`INSERT INTO public.emseepea_event_capture_subscriptions VALUES('synthetic','late','g:1','owner:1','synthetic.reply','{"threadId":"thread:1"}',true,now()+interval '1 hour')`);
    await begin(client); handle = await api.bindTransaction(client, inv());
    const replay = await api.captureInTransaction(handle, source(), inv()); assert.deepEqual(replay, { ...first, outcome: 'replayed' });
    assert.deepEqual(await counts(), { sources: 1, intents: 0 }); return { frozenZero: true };
  });
  await run('source conflict does not alter recorded outcome', async () => {
    const client = await own(runtime); await begin(client); let handle = await api.bindTransaction(client, inv());
    await api.captureInTransaction(handle, source(), inv()); await client.query('COMMIT');
    await begin(client); handle = await api.bindTransaction(client, inv());
    await reject(api.captureInTransaction(handle, source({ sourceVersion: '2' }), inv()), 'PUBLICATION_CONFLICT');
    await client.query('ROLLBACK'); assert.deepEqual(await counts(), { sources: 1, intents: 1 }); return { noAdditionalWrites: true };
  });
  await run('incompatible version is rejected without mutation', async () => {
    await admin.query('UPDATE public.emseepea_event_capture_migrations SET version=99');
    try {
      await reject(migratePostgresEventCapture(migration, inv()), 'INCOMPATIBLE_SCHEMA');
      assert.equal((await admin.query('SELECT version FROM public.emseepea_event_capture_migrations')).rows[0].version, 99);
    } finally { await admin.query('UPDATE public.emseepea_event_capture_migrations SET version=1'); }
    return { incompatibleVersionRetained: true };
  });
  await run('concurrent migration lock has finite failure and explicit subsequent success', async () => {
    const blocker = await own(admin); await blocker.query('BEGIN'); await blocker.query('SELECT pg_advisory_xact_lock(1740125,1)');
    await reject(migratePostgresEventCapture(migration, inv()), 'UNAVAILABLE'); await blocker.query('ROLLBACK');
    await migratePostgresEventCapture(migration, inv()); return { initialLockFailurePreserved: true, explicitSubsequentMigration: true };
  });
  await run('caller search path and temporary text type cannot shadow capture resolution', async () => {
    await admin.query('CREATE SCHEMA e174_shadow');
    await admin.query('CREATE DOMAIN e174_shadow.text AS pg_catalog.text CHECK(false)');
    await admin.query('CREATE FUNCTION e174_shadow.equal_text(pg_catalog.text,pg_catalog.text) RETURNS boolean LANGUAGE SQL IMMUTABLE AS $$ SELECT false $$');
    await admin.query('CREATE OPERATOR e174_shadow.= (FUNCTION=e174_shadow.equal_text,LEFTARG=pg_catalog.text,RIGHTARG=pg_catalog.text)');
    await admin.query('GRANT USAGE ON SCHEMA e174_shadow TO emseepea_capture_runtime');
    const client = await own(admin);
    // Fixture owner establishes a temporary shadow before restricting this session.
    await client.query('CREATE TEMP TABLE e174_temp_marker(id integer)');
    await client.query("CREATE TYPE pg_temp.text AS ENUM ('synthetic-never')");
    await begin(client); await client.query('SET LOCAL ROLE emseepea_capture_runtime');
    await client.query('SET LOCAL search_path=e174_shadow,pg_catalog,public');
    const originalPath = (await client.query('SHOW search_path')).rows[0].search_path;
    const handle = await api.bindTransaction(client, inv());
    const captured = await api.captureInTransaction(handle, source(), inv());
    assert.equal(captured.deliveryCount, 1);
    assert.equal((await client.query('SHOW search_path')).rows[0].search_path, originalPath);
    await client.query('COMMIT');
    assert.deepEqual(await counts(), {sources:1,intents:1});
    return { operatorAndTypeShadowHadNoEffect: true, callerSettingsNotChangedByCapture: true };
  });
  await run('parsed schema output is the only payload fingerprint and matching snapshot', async () => {
    const parsedDefinition = { ...definition, payloadSchema: z.object({ threadId: z.string(), messageId: z.string() })
      .transform((value) => ({ ...value, messageId: 'normalized:'+value.messageId })) };
    const parsedApi = createPostgresEventCapture({ namespace: 'synthetic', sourceKind: 'reply', definitions: [parsedDefinition] });
    const client = await own(runtime); await begin(client); const handle = await parsedApi.bindTransaction(client, inv());
    const input = source({ data: { threadId: 'thread:1', messageId: 'message:1', ignored: 'synthetic-not-retained' } });
    const result = await parsedApi.captureInTransaction(handle, input, inv()); await client.query('COMMIT');
    assert.equal(result.deliveryCount, 1);
    const saved = (await admin.query('SELECT payload FROM public.emseepea_event_sources')).rows[0].payload;
    assert.deepEqual(saved, { threadId: 'thread:1', messageId: 'normalized:message:1' });
    return { parsedOnlyPayload: true, strippedMaterialAbsent: true };
  });
  await run('matcher cannot mutate the shared canonical payload', async () => {
    const badDefinition = { ...definition, matches(_args,data) { data.threadId='changed'; return true; } };
    const guarded = createPostgresEventCapture({ namespace: 'synthetic', sourceKind: 'reply', definitions: [badDefinition] });
    const client = await own(runtime); await begin(client); const handle = await guarded.bindTransaction(client, inv());
    await reject(guarded.captureInTransaction(handle, source(), inv()), 'UNAVAILABLE');
    const visible = (await client.query('SELECT count(*)::int AS n FROM public.emseepea_event_sources')).rows[0].n;
    assert.equal(visible,0); await client.query('ROLLBACK'); assert.deepEqual(await counts(),{sources:0,intents:0});
    return { mutationRejectedBeforeWrite: true };
  });
  await run('drifted intent default cannot silently mark new work completed', async () => {
    await migration.query("ALTER TABLE public.emseepea_event_intents ALTER COLUMN state SET DEFAULT 'completed'");
    try { await reject(migratePostgresEventCapture(migration, inv()), 'INCOMPATIBLE_SCHEMA'); }
    finally { await migration.query("ALTER TABLE public.emseepea_event_intents ALTER COLUMN state SET DEFAULT 'pending'"); }
    return { alteredPendingDefaultRejected: true };
  });
  await run('drifted migration singleton default is rejected', async () => {
    await migration.query('ALTER TABLE public.emseepea_event_capture_migrations ALTER COLUMN singleton SET DEFAULT false');
    try { await reject(migratePostgresEventCapture(migration, inv()), 'INCOMPATIBLE_SCHEMA'); }
    finally { await migration.query('ALTER TABLE public.emseepea_event_capture_migrations ALTER COLUMN singleton SET DEFAULT true'); }
    return { alteredSingletonDefaultRejected: true };
  });
  await run('weakened check expression is rejected despite retaining expected substring', async () => {
    await migration.query('ALTER TABLE public.emseepea_event_sources DROP CONSTRAINT emseepea_event_sources_recipient_count_check');
    await migration.query('ALTER TABLE public.emseepea_event_sources ADD CONSTRAINT emseepea_event_sources_recipient_count_check CHECK(recipient_count>=0 OR true)');
    try { await reject(migratePostgresEventCapture(migration, inv()), 'INCOMPATIBLE_SCHEMA'); }
    finally {
      await migration.query('ALTER TABLE public.emseepea_event_sources DROP CONSTRAINT emseepea_event_sources_recipient_count_check');
      await migration.query('ALTER TABLE public.emseepea_event_sources ADD CONSTRAINT emseepea_event_sources_recipient_count_check CHECK(recipient_count>=0)');
    }
    return { weakerConstraintRejected: true };
  });
  await run('unvalidated required constraint is rejected', async () => {
    await migration.query('ALTER TABLE public.emseepea_event_sources DROP CONSTRAINT emseepea_event_sources_recipient_count_check');
    await migration.query('ALTER TABLE public.emseepea_event_sources ADD CONSTRAINT emseepea_event_sources_recipient_count_check CHECK(recipient_count>=0) NOT VALID');
    try { await reject(migratePostgresEventCapture(migration, inv()), 'INCOMPATIBLE_SCHEMA'); }
    finally { await migration.query('ALTER TABLE public.emseepea_event_sources VALIDATE CONSTRAINT emseepea_event_sources_recipient_count_check'); }
    return { unvalidatedConstraintRejected: true };
  });
  await run('equally named index on wrong table is rejected', async () => {
    await migration.query('CREATE TABLE public.e174_wrong_index_target(namespace text,subscription_id text,active boolean)');
    await migration.query('DROP INDEX public.emseepea_event_capture_active_generation');
    await migration.query('CREATE UNIQUE INDEX emseepea_event_capture_active_generation ON public.e174_wrong_index_target(namespace,subscription_id) WHERE active');
    try { await reject(migratePostgresEventCapture(migration, inv()), 'INCOMPATIBLE_SCHEMA'); }
    finally {
      await migration.query('DROP INDEX public.emseepea_event_capture_active_generation');
      await migration.query('CREATE UNIQUE INDEX emseepea_event_capture_active_generation ON public.emseepea_event_capture_subscriptions(namespace,subscription_id) WHERE active');
      await migration.query('DROP TABLE public.e174_wrong_index_target');
    }
    return { wrongTargetIndexRejected: true };
  });
  await run('simulated lost migration COMMIT acknowledgement preserves unknown until fresh catalog verification', async () => {
    const wrappedPool = { async connect() {
      const client = await migration.connect();
      return { async query(sql, values) {
        const result = await client.query(sql, values);
        if (sql === 'COMMIT') throw new Error('SYNTHETIC_LOST_ACKNOWLEDGEMENT');
        return result;
      }, release(error) { client.release(error); } };
    } };
    await reject(migratePostgresEventCapture(wrappedPool, inv()), 'OUTCOME_UNKNOWN');
    await migratePostgresEventCapture(migration, inv());
    return { unknownPreserved: true, freshVerificationSucceeded: true, actualWireFailureTested: false };
  });
  report.status = report.cases.every((value) => value.status === 'PASS') ? 'PASS_POSTGRES_CAPTURE_FOUNDATION' : 'FAIL_POSTGRES_CAPTURE_FOUNDATION';
} catch (error) {
  report.status = 'FAIL_POSTGRES_CAPTURE_FOUNDATION';
  report.failureCategory = /^[A-Z0-9_]{1,60}$/.test(error?.code ?? '') ? error.code : 'FIXTURE_OR_MIGRATION_PREREQUISITE_FAILED';
} finally {
  let incomplete = false;
  for (const client of [...owned]) {
    // Forced disposal is only for these fixture-owned clients, never caller production work.
    try { client.release(new Error('OWNED_FIXTURE_TEARDOWN')); owned.delete(client); } catch { incomplete = true; }
  }
  for (const value of pools) {
    let timeout;
    try { await Promise.race([value.end(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('CLEANUP_DEADLINE')), 2000); })]); }
    catch { incomplete = true; }
    finally { clearTimeout(timeout); }
  }
  report.connectionsClosed = !incomplete;
  if (incomplete) report.status = 'FAIL_POSTGRES_CAPTURE_FOUNDATION'; else clearTimeout(hard);
  process.stdout.write(JSON.stringify(report, null, 2)+'\n');
  if (incomplete) process.exit(1);
  process.exitCode = report.status === 'PASS_POSTGRES_CAPTURE_FOUNDATION' ? 0 : 1;
}
