import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPostgresEventDispatchMigrator,
  PostgresEventDispatchMigrationError,
} from '../dist/events-postgres-dispatch-migrations.js';

test('dispatch migration requires a usable owned pool', () => {
  assert.throws(
    () => createPostgresEventDispatchMigrator({}),
    (error) => error instanceof PostgresEventDispatchMigrationError
      && error.code === 'UNAVAILABLE'
      && error.phase === 'lifecycle'
      && error.captureCommitted === false
      && error.lifecycleCommitted === false
      && error.deliveryCommitted === false,
  );
});

test('dispatch migration errors expose committed prerequisite facts', () => {
  const error = new PostgresEventDispatchMigrationError(
    'INCOMPATIBLE_SCHEMA',
    'dispatch',
    true,
    true,
    true,
  );
  assert.equal(error.phase, 'dispatch');
  assert.equal(error.captureCommitted, true);
  assert.equal(error.lifecycleCommitted, true);
  assert.equal(error.deliveryCommitted, true);
});
