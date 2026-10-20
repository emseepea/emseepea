import assert from 'node:assert/strict';
import test from 'node:test';
import {createCloudTasksRestTransportRuntime,GoogleEventTransportSetupError} from '../dist/events-cloud-tasks-transport.js';
const config={namespace:'synthetic',projectId:'synthetic-test',location:'australia-southeast1',queueId:'feedback',workerURL:'https://worker.example/tasks',audience:'https://worker.example/',serviceAccountEmail:'worker@synthetic-test.iam.gserviceaccount.com',serviceAccountUid:'123456789'};
const task={deliveryId:'delivery:synthetic:1',taskId:'emseepea-'+'f'.repeat(64)};
const queue='projects/synthetic-test/locations/australia-southeast1/queues/feedback';
const inv=(ms=3000)=>({signal:new AbortController().signal,deadlineMs:Date.now()+ms});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function descriptor(){return {name:`${queue}/tasks/${task.taskId}`,httpRequest:{httpMethod:'POST',url:config.workerURL,headers:{'Content-Type':'application/json'},body:Buffer.from(JSON.stringify({deliveryId:task.deliveryId})).toString('base64'),oidcToken:{serviceAccountEmail:config.serviceAccountEmail,audience:config.audience}},dispatchDeadline:'28s'};}
function fixture(options={}) {
 const calls={construct:0,clients:0,headers:0,fetches:[]},control={logging:true,graph:true,client:null,headers:null,fetch:null,...options};
 const credentials={async getRequestHeaders(){calls.headers++;return control.headers?control.headers():new Headers({Authorization:'Bearer synthetic-token-not-a-credential','x-goog-user-project':'not-forwarded'});}};
 const runtime={graphSafe:()=>control.graph,loggingSafe:()=>control.logging,createAuth(){calls.construct++;return {async getClient(){calls.clients++;return control.client?control.client(credentials):credentials;}};},async fetch(url,init){calls.fetches.push({url,init});return control.fetch?control.fetch(url,init):response({name:queue,state:'RUNNING'});}};
 const transport=createCloudTasksRestTransportRuntime(config,runtime);return {transport,calls,control,runtime};
}
test('queue uses fixed HTTPS origin, authorization only and manual redirects',async()=>{
 const f=fixture();assert.equal(await f.transport.queue(inv()),'present');const call=f.calls.fetches[0];assert.equal(call.url,`https://cloudtasks.googleapis.com/v2/${queue}`);assert.equal(call.init.redirect,'manual');assert.equal(call.init.method,'GET');assert.deepEqual(Object.keys(call.init.headers),['Authorization']);assert.equal(await f.transport.settle(inv()),true);
});
test('queue-level task authority overrides are rejected',async()=>{
 const f=fixture({fetch:async()=>response({name:queue,state:'RUNNING',httpTarget:{uriOverride:{host:'other.example'}}})});assert.equal(await f.transport.queue(inv()),'unavailable');await f.transport.settle(inv());
});
test('create emits delivery-only body, fixed OIDC authority and exact duration',async()=>{
 const f=fixture({fetch:async()=>response({name:descriptor().name})});assert.equal(await f.transport.create(task,inv()),'created');const call=f.calls.fetches[0];assert.equal(call.url,`https://cloudtasks.googleapis.com/v2/${queue}/tasks`);assert.equal(call.init.method,'POST');assert.deepEqual(JSON.parse(call.init.body),{task:descriptor(),responseView:'BASIC'});await f.transport.settle(inv());
});
test('worst valid delivery identity stays inside task and request byte ceilings',async()=>{
 const deliveryId='\\'.repeat(240),taskId='emseepea-'+'e'.repeat(64);let request;
 const f=fixture({fetch:async(_url,init)=>{request=Buffer.from(init.body);return response({name:`${queue}/tasks/${taskId}`});}});
 assert.equal(await f.transport.create({deliveryId,taskId},inv()),'created');
 const parsed=JSON.parse(request);const taskBytes=Buffer.from(parsed.task.httpRequest.body,'base64');
 assert.ok(taskBytes.length<=1024);assert.ok(request.length<=8192);assert.deepEqual(JSON.parse(taskBytes),{deliveryId});
 await f.transport.settle(inv());
});
test('FULL inspection requires exact saved body and task configuration',async()=>{
 const f=fixture({fetch:async()=>response(descriptor())});assert.equal(await f.transport.inspect(task,inv()),'matching');assert.ok(f.calls.fetches[0].url.endsWith('?responseView=FULL'));await f.transport.settle(inv());
});
test('unexpected authentication and extra body fields conflict',async()=>{
 for(const edit of [value=>{value.httpRequest.oauthToken={serviceAccountEmail:'other'};},value=>{value.httpRequest.body=Buffer.from(JSON.stringify({deliveryId:task.deliveryId,namespace:'other'})).toString('base64');},value=>{value.httpRequest.headers.Authorization='Bearer forbidden';}]){
  const value=descriptor();edit(value);const f=fixture({fetch:async()=>response(value)});assert.equal(await f.transport.inspect(task,inv()),'conflict');await f.transport.settle(inv());
 }
});
test('FULL-view denial is unavailable and exact 404 is missing',async()=>{
 for(const [status,wanted] of [[403,'unavailable'],[404,'missing']]){const f=fixture({fetch:async()=>response({error:{code:status}},status)});assert.equal(await f.transport.inspect(task,inv()),wanted);assert.equal(f.calls.fetches.length,1);await f.transport.settle(inv());}
});
test('ALREADY_EXISTS is transport occupancy without inspection or retry',async()=>{
 const f=fixture({fetch:async()=>response({error:{code:409,status:'ALREADY_EXISTS'}},409)});assert.equal(await f.transport.create(task,inv()),'exists');assert.equal(f.calls.fetches.length,1);await f.transport.settle(inv());
});
test('401, 429 and 503 do not trigger API or authorization retries',async()=>{
 for(const status of [401,429,503]){const f=fixture({fetch:async()=>response({error:{code:status}},status)});assert.equal(await f.transport.create(task,inv()),'unavailable');assert.equal(f.calls.fetches.length,1);assert.equal(f.calls.headers,1);await f.transport.settle(inv());}
});
test('redirect response is never followed',async()=>{
 const f=fixture({fetch:async()=>new Response(null,{status:302,headers:{Location:'https://other.example'}})});assert.equal(await f.transport.queue(inv()),'unavailable');assert.equal(f.calls.fetches.length,1);await f.transport.settle(inv());
});
test('invalid task identities reject before credential acquisition',async()=>{
 const f=fixture();for(const deliveryId of ['bad\ud800','bad\n','x'.repeat(241)])assert.equal(await f.transport.create({...task,deliveryId},inv()),'unavailable');assert.equal(f.calls.clients,0);assert.equal(f.calls.fetches.length,0);await f.transport.settle(inv());
});
test('unsupported module graph and unsafe logging reject before auth construction',()=>{
 const f=fixture();f.control.graph=false;assert.throws(()=>createCloudTasksRestTransportRuntime(config,f.runtime),error=>error instanceof GoogleEventTransportSetupError&&error.code==='UNSUPPORTED_DEPENDENCY_GRAPH');assert.equal(f.calls.construct,1);
 f.control.graph=true;f.control.logging=false;assert.throws(()=>createCloudTasksRestTransportRuntime(config,f.runtime),error=>error.code==='UNSAFE_SDK_LOGGING');assert.equal(f.calls.construct,1);
});
test('logging enabled after construction prevents credential lookup',async()=>{
 const f=fixture();f.control.logging=false;assert.equal(await f.transport.queue(inv()),'unavailable');assert.equal(f.calls.clients,0);await f.transport.settle(inv());
});
test('oversized authorization is rejected before fetch',async()=>{
 const f=fixture({headers:()=>new Headers({Authorization:'Bearer '+ 'a'.repeat(8192)})});assert.equal(await f.transport.queue(inv()),'unavailable');assert.equal(f.calls.fetches.length,0);await f.transport.settle(inv());
});
test('late credentials retain two slots and never issue fetch after abort',async()=>{
 const entered=deferred(),blocked=deferred();let n=0;const f=fixture({client:async credentials=>{if(++n===2)entered.resolve();await blocked.promise;return credentials;}}),a=new AbortController(),b=new AbortController();
 const first=f.transport.queue({signal:a.signal,deadlineMs:Date.now()+3000}),second=f.transport.queue({signal:b.signal,deadlineMs:Date.now()+3000});await entered.promise;a.abort();b.abort();assert.deepEqual(await Promise.all([first,second]),['unavailable','unavailable']);
 assert.equal(await f.transport.queue(inv()),'unavailable');assert.equal(f.calls.clients,2);assert.equal(await f.transport.settle(inv(10)),false);blocked.resolve();assert.equal(await f.transport.settle(inv()),true);assert.equal(f.calls.fetches.length,0);
});
test('credential deadline is not reset before fetch',async()=>{
 const entered=deferred(),blocked=deferred(),f=fixture({client:async credentials=>{entered.resolve();await blocked.promise;return credentials;}});
 const operation=f.transport.queue(inv(20));await entered.promise;assert.equal(await operation,'unavailable');blocked.resolve();assert.equal(await f.transport.settle(inv()),true);assert.equal(f.calls.fetches.length,0);
});
test('oversized stream cancellation remains tracked after visible abort',async()=>{
 const entered=deferred(),blocked=deferred(),controller=new AbortController();
 const f=fixture({fetch:async()=>new Response(new ReadableStream({start(stream){stream.enqueue(new Uint8Array(16385));},cancel(){entered.resolve();return blocked.promise;}}))});
 const operation=f.transport.queue({signal:controller.signal,deadlineMs:Date.now()+3000});await entered.promise;controller.abort();assert.equal(await operation,'unavailable');assert.equal(await f.transport.settle(inv(10)),false);blocked.resolve();assert.equal(await f.transport.settle(inv()),true);
});
test('malformed UTF8 and oversized JSON produce no raw result',async()=>{
 for(const value of [new Uint8Array([255]),Buffer.from(JSON.stringify({data:'x'.repeat(17000)}))]){const f=fixture({fetch:async()=>new Response(value)});assert.equal(await f.transport.queue(inv()),'unavailable');await f.transport.settle(inv());}
});
test('rejected stream cancellation still releases reader and reports incomplete cleanup',async()=>{
 const stream=new ReadableStream({start(value){value.enqueue(new Uint8Array(16385));},cancel(){return Promise.reject(new Error('SYNTHETIC_CANCEL_FAILED'));}});
 const f=fixture({fetch:async()=>new Response(stream)});assert.equal(await f.transport.queue(inv()),'unavailable');assert.equal(stream.locked,false);assert.equal(await f.transport.settle(inv()),false);
});
test('immutable configuration fingerprint includes intended service-account UID',async()=>{
 const f=fixture(),other=createCloudTasksRestTransportRuntime({...config,serviceAccountUid:'999'},f.runtime);assert.notEqual(f.transport.fingerprint,other.fingerprint);await f.transport.settle(inv());await other.settle(inv());
});
test('SDK credential errors containing sensitive markers are categorical',async()=>{
 const f=fixture({client:async()=>{throw new Error('SYNTHETIC_SENSITIVE_MARKER');}});const result=await f.transport.queue(inv());assert.equal(result,'unavailable');assert.equal(f.calls.fetches.length,0);await f.transport.settle(inv());
});
test('invalid trusted configuration rejects before auth construction or fetch',()=>{
 const calls={construct:0,fetch:0};
 const runtime={graphSafe:()=>true,loggingSafe:()=>true,createAuth(){calls.construct++;return {getClient:async()=>({getRequestHeaders:async()=>new Headers({Authorization:'Bearer synthetic'})})};},async fetch(){calls.fetch++;return response({});}};
 const invalid=[
  {namespace:'bad\n'},
  {projectId:'BAD'},
  {location:'bad/location'},
  {queueId:'bad queue'},
  {workerURL:'http://worker.example/tasks'},
  {workerURL:'https://user@worker.example/tasks'},
  {workerURL:'https://worker.example/tasks?query=1'},
  {workerURL:'https://worker.example/tasks#fragment'},
  {workerURL:'https://worker.example:8443/tasks'},
  {audience:'http://worker.example/'},
  {audience:'https://user@worker.example/'},
  {audience:'https://worker.example/?query=1'},
  {audience:'https://worker.example/#fragment'},
  {audience:'https://worker.example:8443/'},
  {serviceAccountEmail:'not-an-identity@example.com'},
  {serviceAccountUid:'uid-not-numeric'},
 ];
 for(const patch of invalid)assert.throws(()=>createCloudTasksRestTransportRuntime({...config,...patch},runtime),error=>error instanceof GoogleEventTransportSetupError&&error.code==='INVALID_CONFIGURATION');
 assert.deepEqual(calls,{construct:0,fetch:0});
});
test('FULL inspection conflicts on every task-defining field',async()=>{
 const edits=[
  value=>{value.name+='-other';},
  value=>{value.httpRequest.httpMethod='GET';},
  value=>{value.httpRequest.url='https://other.example/tasks';},
  value=>{value.httpRequest.headers={'Content-Type':'text/plain'};},
  value=>{value.httpRequest.body=Buffer.from(JSON.stringify({deliveryId:'other'})).toString('base64');},
  value=>{value.httpRequest.oidcToken.serviceAccountEmail='other@synthetic-test.iam.gserviceaccount.com';},
  value=>{value.httpRequest.oidcToken.audience='https://other.example/';},
  value=>{value.dispatchDeadline='29s';},
 ];
 for(const edit of edits){const value=descriptor();edit(value);const f=fixture({fetch:async()=>response(value)});assert.equal(await f.transport.inspect(task,inv()),'conflict');await f.transport.settle(inv());}
});
test('queue inspection rejects wrong identity, state, authority and unknown fields',async()=>{
 const values=[
  {name:queue+'-other',state:'RUNNING'},
  {name:queue,state:'PAUSED'},
  {name:queue,state:'RUNNING',httpTarget:{uriOverride:{host:'other.example'}}},
  {name:queue,state:'RUNNING',appEngineRoutingOverride:{service:'other'}},
  {name:queue,state:'RUNNING',unexpected:true},
 ];
 for(const value of values){const f=fixture({fetch:async()=>response(value)});assert.equal(await f.transport.queue(inv()),'unavailable');await f.transport.settle(inv());}
});
test('configuration fingerprint is stable and sensitive to every authority field',async()=>{
 const f=fixture(),same=createCloudTasksRestTransportRuntime({...config},f.runtime);
 assert.equal(f.transport.fingerprint,same.fingerprint);
 const alternatives={namespace:'other',projectId:'synthetic-other',location:'us-central1',queueId:'other',workerURL:'https://other.example/tasks',audience:'https://other.example/',serviceAccountEmail:'other@synthetic-test.iam.gserviceaccount.com',serviceAccountUid:'987654321'};
 for(const [name,value] of Object.entries(alternatives)){
  const other=createCloudTasksRestTransportRuntime({...config,[name]:value},f.runtime);
  assert.notEqual(other.fingerprint,f.transport.fingerprint,name);
  await other.settle(inv());
 }
 await same.settle(inv());await f.transport.settle(inv());
});
test('ambiguous fetch failure is unavailable and never retried',async()=>{
 const f=fixture({fetch:async()=>{throw new Error('SYNTHETIC_AMBIGUOUS_PROVIDER_FAILURE');}});
 assert.equal(await f.transport.create(task,inv()),'unavailable');
 assert.equal(f.calls.fetches.length,1);
 assert.equal(await f.transport.settle(inv()),true);
});
for(const phase of ['client','headers','fetch','body-read'])test(`blocked ${phase} retains both slots until raw work joins`,async()=>{
 const entered=deferred(),release=deferred();let count=0;
 const options={};
 if(phase==='client')options.client=async credentials=>{if(++count===2)entered.resolve();await release.promise;return credentials;};
 if(phase==='headers')options.headers=async()=>{if(++count===2)entered.resolve();await release.promise;return new Headers({Authorization:'Bearer synthetic-token'});};
 if(phase==='fetch')options.fetch=async()=>{if(++count===2)entered.resolve();await release.promise;return response({name:queue,state:'RUNNING'});};
 if(phase==='body-read')options.fetch=async()=>new Response(new ReadableStream({pull(controller){if(++count===2)entered.resolve();release.promise.then(()=>{controller.enqueue(Buffer.from(JSON.stringify({name:queue,state:'RUNNING'})));controller.close();});}},{highWaterMark:0}));
 const f=fixture(options),a=new AbortController(),b=new AbortController();
 const first=f.transport.queue({signal:a.signal,deadlineMs:Date.now()+3000}),second=f.transport.queue({signal:b.signal,deadlineMs:Date.now()+3000});
 await entered.promise;a.abort();b.abort();assert.deepEqual(await Promise.all([first,second]),['unavailable','unavailable']);
 assert.equal(await f.transport.queue(inv()),'unavailable');
 assert.equal(await f.transport.settle(inv(10)),false);
 release.resolve();assert.equal(await f.transport.settle(inv()),true);
});
test('settled transport starts no new credential or network work',async()=>{
 const f=fixture();assert.equal(await f.transport.settle(inv()),true);assert.equal(await f.transport.queue(inv()),'unavailable');assert.equal(f.calls.clients,0);assert.equal(f.calls.fetches.length,0);
});
