import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeliverySessionOwner } from '../dist/events-postgres-delivery-owned.js';

test('delivery session rejects an invalid invocation before acquiring a connection', async () => {
  let acquired = false;
  const owner = createDeliverySessionOwner({ async connect() { acquired = true; throw new Error('not expected'); } });
  await assert.rejects(owner.run({}, async () => undefined), (error) => error?.code === 'INVALID_INPUT');
  assert.equal(acquired, false);
});
