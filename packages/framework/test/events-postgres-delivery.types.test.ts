import {createPostgresEventDelivery,createPostgresEventDeliveryMigrator,PostgresEventDeliveryMigrationError,type PostgresEventDeliveryOptions,type PostgresEventDelivery,type PostgresEventDeliveryOutcome} from '../dist/events-postgres.js';
declare const options:PostgresEventDeliveryOptions;
const worker:PostgresEventDelivery=createPostgresEventDelivery(options);
const invocation={signal:new AbortController().signal,deadlineMs:Date.now()+25000};
const outcome:Promise<PostgresEventDeliveryOutcome>=worker.deliver('opaque-delivery-id',invocation);
const settled:Promise<boolean>=worker.settle(invocation);
const migrator=createPostgresEventDeliveryMigrator(options.pool);
const migrated:Promise<void>=migrator.migrate(invocation);
declare const migrationError:PostgresEventDeliveryMigrationError;
const migrationPhase:'capture'|'lifecycle'|'delivery'=migrationError.phase;
const captureCommitted:boolean=migrationError.captureCommitted;
const lifecycleCommitted:boolean=migrationError.lifecycleCommitted;
// @ts-expect-error Namespace is deployment configuration, never invocation input.
worker.deliver('opaque-delivery-id',{...invocation,namespace:'untrusted'});
void [outcome,settled,migrated,migrationPhase,captureCommitted,lifecycleCommitted];
