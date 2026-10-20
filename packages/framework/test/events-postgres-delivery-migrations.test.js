import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPostgresEventDeliveryMigrator,
  PostgresEventDeliveryMigrationError,
} from '../dist/events-postgres-delivery-migrations.js';

test('delivery migration requires a usable owned pool', () => {
  assert.throws(
    () => createPostgresEventDeliveryMigrator({}),
    (error) => error instanceof PostgresEventDeliveryMigrationError
      && error.code === 'UNAVAILABLE'
      && error.phase === 'lifecycle'
      && error.captureCommitted === false
      && error.lifecycleCommitted === false,
  );
});

test('delivery migration errors expose committed prerequisite facts', () => {
  const error = new PostgresEventDeliveryMigrationError(
    'INCOMPATIBLE_SCHEMA',
    'delivery',
    true,
    true,
  );
  assert.equal(error.phase, 'delivery');
  assert.equal(error.captureCommitted, true);
  assert.equal(error.lifecycleCommitted, true);
});
