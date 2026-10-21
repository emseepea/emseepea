import { createCloudTasksRestTransportRuntime } from '../dist/events-cloud-tasks-transport.js';
declare const configuration:Parameters<typeof createCloudTasksRestTransportRuntime>[0];
const transport=createCloudTasksRestTransportRuntime(configuration);
const invocation={signal:new AbortController().signal,deadlineMs:Date.now()+3000};
void transport.queue(invocation);void transport.inspect({deliveryId:'delivery:1',taskId:'emseepea-'+'a'.repeat(64)},invocation);
void transport.settle(invocation);
// @ts-expect-error Caller cannot select namespace, callback or service identity in task invocation.
void transport.create({deliveryId:'delivery:1',taskId:'emseepea-'+'a'.repeat(64),namespace:'other'},invocation);
