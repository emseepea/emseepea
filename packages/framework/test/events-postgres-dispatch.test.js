import assert from 'node:assert/strict';
import test from 'node:test';
import {createPostgresEventDispatchRuntime} from '../dist/events-postgres-dispatch.js';
import {createDeliverySessionOwner} from '../dist/events-postgres-delivery-owned.js';
const inv=(ms=25000)=>({signal:new AbortController().signal,deadlineMs:Date.now()+ms});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
// Control-flow double only. SQL, fairness and durability require the separate real PostgreSQL fixture.
function fixture(patch={}) {
 const state={namespace:'synthetic',source_kind:'reply',source_id:'reply:1',subscription_id:'sub:1',generation:'gen:1',
  delivery_id:'delivery:1',config_hash:'a'.repeat(64),transport_generation:0,task_id:null,recovery_count:0,...patch};
 const calls={connect:0,release:0,discard:0,queue:0,inspect:0,create:0,commits:0,commands:[]};
 const control={claimed:false,paused:false,queue:'present',inspect:'matching',create:'created',faultCommit:0,releaseFails:false,queueWork:null,createWork:null,workerUntil:null};
 const pool={async connect(){calls.connect++;return {async query(sql,values=[]){
  calls.commands.push(sql);
  if(sql==='COMMIT'&&++calls.commits===control.faultCommit)throw new Error('SIMULATED_COMMIT_ACK_LOSS');
  if(sql.startsWith('SELECT d.*')){if(control.claimed)return {rows:[]};control.claimed=true;return {rows:[{...state}]};}
  if(sql.startsWith('SELECT i.state='))return {rows:[{eligible:true,now:Date.now(),worker_lease_until:control.workerUntil,worker_due_at:null}]};
  if(sql.startsWith('UPDATE public.emseepea_event_dispatch_state d SET lease_id='))state.lease_id=values[5];
  if(sql.startsWith('UPDATE public.emseepea_event_dispatch_state d SET transport_generation=')){
   state.transport_generation=values[7];state.task_id=values[8];return {rows:[{namespace:state.namespace}]};
  }
  if(sql.startsWith('UPDATE public.emseepea_event_dispatch_state d\n')){state.category=values[7];state.deferredUntil=values[11];return {rows:[{namespace:state.namespace}]};}
  return {rows:[]};
 },release(error){calls.release++;if(error)calls.discard++;if(control.releaseFails)throw new Error('DISPOSAL_FAILED');}};}};
 const transport={fingerprint:'a'.repeat(64),async queue(value){calls.queue++;return control.queueWork?control.queueWork(value):control.queue;},
  async inspect(){calls.inspect++;return control.inspect;},async create(value,invocation){calls.create++;return control.createWork?control.createWork(value,invocation):control.create;}};
 const dispatcher=createPostgresEventDispatchRuntime({namespace:'synthetic',pool,transport,isPaused:()=>control.paused});
 return {dispatcher,state,calls,control,pool};
}
test('scripted first task generation reserves before create and releases SQL before provider',async()=>{
 const f=fixture();f.control.createWork=async task=>{assert.equal(f.calls.release,f.calls.connect);assert.equal(f.state.transport_generation,1);assert.match(task.taskId,/^emseepea-[a-f0-9]{64}$/);assert.equal(task.deliveryId,'delivery:1');return 'created';};
 const result=await f.dispatcher.dispatch('delivery:1',inv());assert.equal(result.created,1);assert.equal(f.state.category,'present');assert.equal(f.calls.inspect,0);assert.equal(await f.dispatcher.settle(inv()),true);
});
test('same-generation matching inspection never creates a replacement',async()=>{
 const f=fixture({transport_generation:7,task_id:'emseepea-'+'b'.repeat(64)});
 const result=await f.dispatcher.dispatch('delivery:1',inv());assert.equal(result.observed,1);assert.equal(f.calls.create,0);assert.equal(f.state.transport_generation,7);await f.dispatcher.settle(inv());
});
test('exact task mismatch fails closed without generation rewrite',async()=>{
 const f=fixture({transport_generation:1,task_id:'emseepea-'+'b'.repeat(64)});f.control.inspect='conflict';
 const result=await f.dispatcher.dispatch('delivery:1',inv());assert.equal(result.conflicts,1);assert.equal(f.calls.create,0);assert.equal(f.state.transport_generation,1);await f.dispatcher.settle(inv());
});
test('confirmed missing task checks queue again then reserves the next generation',async()=>{
 const f=fixture({transport_generation:2,task_id:'emseepea-'+'b'.repeat(64)});f.control.inspect='missing';
 const result=await f.dispatcher.dispatch('delivery:1',inv());assert.equal(result.created,1);assert.equal(f.calls.queue,2);assert.equal(f.state.transport_generation,3);await f.dispatcher.settle(inv());
});
test('ALREADY_EXISTS remains unknown until later same-generation inspection',async()=>{
 const f=fixture();f.control.create='exists';const result=await f.dispatcher.dispatch('delivery:1',inv());
 assert.equal(result.created,0);assert.equal(result.unknown,1);assert.equal(f.state.category,'unknown');await f.dispatcher.settle(inv());
});
test('live worker lease defers to its timestamp without inspecting or creating',async()=>{
 const f=fixture();f.control.workerUntil=Date.now()+60000;
 const result=await f.dispatcher.dispatch('delivery:1',inv());assert.equal(result.deferred,1);assert.equal(f.state.deferredUntil,f.control.workerUntil);
 assert.equal(f.calls.inspect,0);assert.equal(f.calls.create,0);await f.dispatcher.settle(inv());
});
test('unknown reservation COMMIT issues no provider create',async()=>{
 const f=fixture();f.control.faultCommit=3;const result=await f.dispatcher.dispatch('delivery:1',inv());
 assert.equal(result.status,'retry_pending');assert.equal(f.calls.create,0);assert.equal(f.state.transport_generation,1);assert.equal(f.calls.discard,1);await f.dispatcher.settle(inv());
});
test('queue unavailable and pause admit no SQL',async()=>{
 const f=fixture();f.control.queue='unavailable';assert.equal((await f.dispatcher.reconcile(inv())).status,'retry_pending');assert.equal(f.calls.connect,0);await f.dispatcher.settle(inv());
 const p=fixture();p.control.paused=true;assert.equal((await p.dispatcher.reconcile(inv())).status,'paused');assert.equal(p.calls.queue,0);assert.equal(p.calls.connect,0);await p.dispatcher.settle(inv());
});
test('malformed Unicode namespace and target reject before acquisition',async()=>{
 const f=fixture();
 for(const value of ['bad\ud800','bad\udc00']){
  assert.throws(()=>createPostgresEventDispatchRuntime({namespace:value,pool:f.pool,transport:{fingerprint:'a'.repeat(64),queue:async()=> 'present',inspect:async()=> 'missing',create:async()=> 'created'},isPaused:()=>false}),error=>error.code==='INVALID_INPUT');
  await assert.rejects(f.dispatcher.dispatch(value,inv()),error=>error.code==='INVALID_INPUT');
 }
 assert.equal(f.calls.connect,0);assert.equal(f.calls.queue,0);await f.dispatcher.settle(inv());
});
test('aborted unresolved provider call keeps global busy gate until raw work joins',async()=>{
 const f=fixture(),entered=deferred(),blocked=deferred(),controller=new AbortController();
 f.control.queueWork=async()=>{entered.resolve();return blocked.promise;};
 const running=f.dispatcher.reconcile({signal:controller.signal,deadlineMs:Date.now()+25000});await entered.promise;controller.abort();
 assert.equal((await running).status,'retry_pending');assert.equal((await f.dispatcher.reconcile(inv())).status,'retry_pending');assert.equal(f.calls.queue,1);
 assert.equal(await f.dispatcher.settle(inv(10)),false);blocked.resolve('present');assert.equal(await f.dispatcher.settle(inv()),true);assert.equal(f.calls.connect,0);
});
test('disposal failure keeps dispatcher admission closed',async()=>{
 const f=fixture();f.control.releaseFails=true;await f.dispatcher.dispatch('delivery:1',inv());
 await new Promise(resolve=>setImmediate(resolve));const before=f.calls.queue;assert.equal((await f.dispatcher.reconcile(inv())).status,'retry_pending');assert.equal(f.calls.queue,before);assert.equal(await f.dispatcher.settle(inv()),false);
});
test('quiesce is non-closing and joins late acquisition disposal',async()=>{
 const blocked=deferred();let released=0;const owner=createDeliverySessionOwner({connect:()=>blocked.promise});
 const running=owner.run(inv(5),session=>session.transaction(async()=>{}));await assert.rejects(running);let joined=false;
 const joining=owner.quiesce().then(value=>{joined=true;return value;});await new Promise(resolve=>setImmediate(resolve));assert.equal(joined,false);
 blocked.resolve({query:async()=>({rows:[]}),release(){released++;}});assert.equal(await joining,true);assert.equal(released,1);assert.equal(await owner.settle(inv()),true);
});
test('quiesce joins late SQL and leaves future run admission open',async()=>{
 const blocked=deferred(),entered=deferred();let first=true;
 const owner=createDeliverySessionOwner({async connect(){return {async query(sql){if(first&&sql==='SELECT owned'){first=false;entered.resolve();return blocked.promise;}return {rows:[]};},release(){}};}});
 const running=owner.run(inv(15),session=>session.transaction(run=>run('SELECT owned')));await entered.promise;await assert.rejects(running);
 let joined=false;const joining=owner.quiesce().then(value=>{joined=true;return value;});await new Promise(resolve=>setImmediate(resolve));assert.equal(joined,false);
 blocked.resolve({rows:[]});assert.equal(await joining,true);await owner.run(inv(),session=>session.transaction(async()=>true));assert.equal(await owner.settle(inv()),true);
});
