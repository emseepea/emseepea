import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import {
  createPostgresEventCapture,
  createPostgresEventDelivery,
  PostgresEventDeliveryMigrationError,
  postgresEventCaptureMigrations,
} from '../dist/events-postgres.js';
const definition = { name: 'synthetic.reply', description: 'Synthetic reply reference.',
  inputSchema: z.strictObject({ threadId: z.string() }),
  payloadSchema: z.strictObject({ threadId: z.string(), messageId: z.string() }),
  matches: (args, data) => args.threadId === data.threadId };
const create = () => createPostgresEventCapture({ namespace: 'synthetic', sourceKind: 'reply', definitions: [definition] });
const invocation = () => ({ signal: new AbortController().signal, deadlineMs: Date.now()+4000 });
const publication = () => ({ sourceEventId: 'reply:123:version:1', sourceVersion: '1', eventName: definition.name,
  ownerKey: 'owner:1', occurredAt: '2026-10-16T00:00:00.000Z', data: { threadId: 'thread:1', messageId: 'message:1' } });
const identity = { backend: '1', xid: '100', isolation: 'repeatable read', statement_ms: '1500', lock_ms: '500' };
const rejectsCode = (promise, code) => assert.rejects(promise, (error) => error?.code === code);
test('postgres public boundary exposes explicit delivery composition', () => {
  assert.equal(typeof createPostgresEventDelivery, 'function');
  assert.equal(typeof PostgresEventDeliveryMigrationError, 'function');
});
test('capture-only boundary cannot advertise native Events or start delivery', () => {
  const api = create();
  assert.deepEqual(Object.keys(api).sort(), ['bindTransaction', 'captureInTransaction']);
  assert.equal('store' in api, false);
  assert.equal('drain' in api, false);
  assert.equal('subscribe' in api, false);
});
test('invalid composition fails without a SQL connection', () => {
  for (const namespace of ['', 'bad\u0000id', 'x'.repeat(241)]) {
    assert.throws(() => createPostgresEventCapture({ namespace, sourceKind: 'reply', definitions: [definition] }), (error) => error.code === 'INVALID_INPUT');
  }
});
test('pre-aborted and expired binding invoke no SQL', async () => {
  let calls = 0;
  const client = { async query() { calls++; throw new Error('UNEXPECTED_SQL'); } };
  await rejectsCode(create().bindTransaction(client, { signal: AbortSignal.abort(), deadlineMs: Date.now()+4000 }), 'ABORTED');
  await rejectsCode(create().bindTransaction(client, { signal: new AbortController().signal, deadlineMs: Date.now()-1 }), 'DEADLINE');
  assert.equal(calls, 0);
});
test('opaque handle belongs to one composition', async () => {
  let calls = 0;
  const client = { async query() { calls++; return { rows: [identity], rowCount: 1 }; } };
  const handle = await create().bindTransaction(client, invocation());
  const before = calls;
  await rejectsCode(create().captureInTransaction(handle, publication(), invocation()), 'TRANSACTION_NOT_BOUND');
  assert.equal(calls, before);
});
test('invalid publication is rejected before capture SQL without invoking accessors', async () => {
  let calls = 0, getters = 0;
  const client = { async query() { calls++; return { rows: [identity], rowCount: 1 }; } };
  const malformed = publication();
  Object.defineProperty(malformed.data, 'messageId', { enumerable: true, get() { getters++; return 'unsafe'; } });
  const api = create(); const handle = await api.bindTransaction(client, invocation()); const before = calls;
  await rejectsCode(api.captureInTransaction(handle, malformed, invocation()), 'INVALID_INPUT');
  assert.equal(calls, before); assert.equal(getters, 0);
});
test('migration descriptors are immutable and separate from construction', () => {
  const descriptor = postgresEventCaptureMigrations[0];
  assert.equal(descriptor.version, 1);
  assert.ok(Object.isFrozen(postgresEventCaptureMigrations));
  assert.ok(Object.isFrozen(descriptor));
  assert.ok(Object.isFrozen(descriptor.statements));
});
test('migration acquisition failure exposes only a categorical error', async () => {
  const { migratePostgresEventCapture } = await import('../dist/events-postgres.js');
  await rejectsCode(migratePostgresEventCapture({ connect() { throw new Error('synthetic raw driver diagnostic'); } }, invocation()), 'UNAVAILABLE');
});
test('abandoned migration acquisition disposes its late owned connection', async () => {
  const { migratePostgresEventCapture } = await import('../dist/events-postgres.js');
  const controller = new AbortController(); let arrive; let releases = 0;
  const pending = new Promise((resolve) => { arrive = resolve; });
  const operation = migratePostgresEventCapture({ connect: () => pending }, { signal: controller.signal, deadlineMs: Date.now()+4000 });
  const rejection = rejectsCode(operation, 'UNAVAILABLE'); controller.abort(); await rejection;
  arrive({ release(error) { assert.ok(error instanceof Error); releases++; }, query() { throw new Error('UNEXPECTED_SQL'); } });
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(releases, 1);
});
test('abort during owned migration query discards the connection without claiming cancellation', async () => {
  const { migratePostgresEventCapture } = await import('../dist/events-postgres.js');
  const controller = new AbortController(); let entered; const ready = new Promise((resolve) => { entered = resolve; });
  let releases = 0, queries = 0;
  const client = { query() { queries++; entered(); return new Promise(() => {}); }, release(error) { assert.ok(error instanceof Error); releases++; } };
  const operation = migratePostgresEventCapture({ connect: async () => client }, { signal: controller.signal, deadlineMs: Date.now()+4000 });
  const rejected = rejectsCode(operation, 'OUTCOME_UNKNOWN'); await ready; controller.abort(); await rejected;
  assert.equal(queries, 1); assert.equal(releases, 1);
});
test('failed owned rollback is unknown and never returns the connection for reuse', async () => {
  const { migratePostgresEventCapture } = await import('../dist/events-postgres.js');
  let queries = 0, discarded = 0;
  const client = { async query() { queries++; if (queries === 1) return { rows: [], rowCount: null };
    if (queries === 2) throw Object.assign(new Error('synthetic permission error'), { code: '42501' });
    throw new Error('synthetic rollback transport failure'); }, release(error) { if (error) discarded++; } };
  await rejectsCode(migratePostgresEventCapture({ connect: async () => client }, invocation()), 'OUTCOME_UNKNOWN');
  assert.equal(queries, 3); assert.equal(discarded, 1);
});
