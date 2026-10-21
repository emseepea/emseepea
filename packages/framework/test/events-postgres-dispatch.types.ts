import { createPostgresEventDispatchMigrator } from '../dist/events-postgres.js';
import { createPostgresEventDispatchRuntime, type EventDispatchTransport } from '../dist/events-postgres-dispatch.js';
import type { OwnedEventPool } from '../dist/events-postgres-owned.js';
declare const pool:OwnedEventPool;
declare const transport:EventDispatchTransport;
const invocation={signal:new AbortController().signal,deadlineMs:Date.now()+25000};
const migrator=createPostgresEventDispatchMigrator(pool);
void migrator.migrate(invocation);void migrator.settle(invocation);
const dispatcher=createPostgresEventDispatchRuntime({namespace:'synthetic',pool,transport,isPaused:()=>false});
void dispatcher.dispatch('delivery:1',invocation);void dispatcher.reconcile(invocation);void dispatcher.settle(invocation);
// @ts-expect-error No caller-selected namespace, callback URL or service identity in targeted invocation.
void dispatcher.dispatch({deliveryId:'delivery:1',namespace:'other'},invocation);
