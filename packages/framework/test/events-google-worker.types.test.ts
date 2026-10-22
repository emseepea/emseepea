import {createGoogleEventDeliveryWorker,type GoogleEventDeliveryWorkerOptions,type GoogleEventDeliveryWorker} from '../dist/events-google-worker.js';
import type {FastifyInstance} from 'fastify';
declare const options:GoogleEventDeliveryWorkerOptions;
declare const app:FastifyInstance;
const worker:GoogleEventDeliveryWorker=createGoogleEventDeliveryWorker(options);
app.post('/tasks',{bodyLimit:1024},worker.handle);
const result:Promise<boolean>=worker.settle({signal:new AbortController().signal,deadlineMs:Date.now()+25000});
// @ts-expect-error No public verifier injection.
createGoogleEventDeliveryWorker({...options,verify:()=>true});
// @ts-expect-error No request namespace selector or caller-supplied delivery implementation.
createGoogleEventDeliveryWorker({...options,delivery:{}});
void result;
