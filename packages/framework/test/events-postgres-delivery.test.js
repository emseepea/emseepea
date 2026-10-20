import assert from 'node:assert/strict';
import test, {mock} from 'node:test';
import {performance} from 'node:perf_hooks';
import {z} from 'zod';
import {createDeliverySessionOwner} from '../dist/events-postgres-delivery-owned.js';
import {createPostgresEventDeliveryRuntime} from '../dist/events-postgres-delivery.js';
import {mcpEventSubscriptionIdentity} from '../dist/events.js';
import {signWebhook} from '../dist/events-webhook.js';
const inv=(ms=25000)=>({signal:new AbortController().signal,deadlineMs:Date.now()+ms});
const deferred=()=>{let resolve;const promise=new Promise(value=>{resolve=value;});return {promise,resolve};};
// Scripted transaction double: control-flow evidence, never SQL/durability proof.
function fixture(patch={}) {
 const args={threadId:'thread:1'},url='https://callback.example/events',name='synthetic.reply',ownerKey='owner:1';
 const key={namespace:'synthetic',source_kind:'reply',source_id:'reply:1',subscription_id:mcpEventSubscriptionIdentity(ownerKey,name,args,url),generation:'generation:1'};
 const state={reservations:0,lease_id:null,lease_until:null,due_at:Date.now(),terminal:null,intent:'pending',reservation:null,...patch};
 const control={now:Date.now(),secret:`whsec_${Buffer.alloc(32,7).toString('base64')}`,allow:true,status:200,commitFaultAt:0,authorize:undefined,send:undefined};
 const calls={acquired:0,released:0,discarded:0,commits:0,reservations:0,sends:[],authorize:0,commands:[]};let saved;
 const pool={async connect(){calls.acquired++;return {async query(sql,values=[]){
  calls.commands.push(sql);
  if(sql==='BEGIN'){saved=structuredClone(state);return {rows:[],rowCount:0};}
  if(sql==='ROLLBACK'){Object.assign(state,saved);return {rows:[],rowCount:0};}
  if(sql==='COMMIT'){saved=undefined;calls.commits++;if(calls.commits===control.commitFaultAt)throw new Error('SIMULATED_LOST_ACK');return {rows:[],rowCount:0};}
  if(sql.startsWith('SELECT namespace,source_kind'))return {rows:[key],rowCount:1};
  if(sql.startsWith('SELECT revision'))return {rows:[{revision:'head:1'}],rowCount:1};
  if(sql.startsWith('SELECT state,event_id'))return {rows:[{state:state.intent,event_id:'event:1'}],rowCount:1};
  if(sql.startsWith('SELECT reservations'))return {rows:[{...state}],rowCount:1};
  if(sql.startsWith('SELECT pg_catalog.floor'))return {rows:[{now:control.now}],rowCount:1};
  if(sql.startsWith('SELECT s.event_id'))return {rows:[{event_id:'event:1',owner_key:ownerKey,event_name:name,payload:{threadId:'thread:1',messageId:'captured:1'},occurred_at:1760000000000,arguments:args,url,now:control.now,secret:control.secret,previous_secret:null,previous_until:null}],rowCount:1};
  if(sql.startsWith('UPDATE public.emseepea_event_delivery_state SET lease_id=$6')){state.lease_id=values[5];state.lease_until=Number(values[6])+60000;}
  if(sql.startsWith('INSERT INTO public.emseepea_event_delivery_attempts')){calls.reservations++;state.reservation=values[6];}
  if(sql.startsWith('UPDATE public.emseepea_event_delivery_state SET reservations'))state.reservations=values[5];
  if(sql.startsWith('SELECT reservation_id'))return {rows:[{reservation_id:state.reservation}],rowCount:1};
  if(sql.startsWith('UPDATE public.emseepea_event_intents SET state=')&&state.intent==='pending')state.intent=values[5];
  if(sql.startsWith('UPDATE public.emseepea_event_delivery_state SET terminal=')&&state.terminal===null){state.terminal=values[5];state.lease_id=null;state.lease_until=null;}
  if(sql.startsWith('UPDATE public.emseepea_event_delivery_state SET lease_id=NULL')){state.lease_id=null;state.lease_until=null;state.due_at=Number(values[5])+Number(values[6]);}
  return {rows:[],rowCount:0};
 },release(error){calls.released++;if(error)calls.discarded++;}};}};
 const definition={name,description:'Synthetic reply reference.',inputSchema:z.strictObject({threadId:z.string()}),payloadSchema:z.strictObject({threadId:z.string(),messageId:z.string()}).overwrite(value=>({...value,messageId:'TRANSFORMED_NOT_CAPTURED'})),matches:()=>true};
 let worker;
 const options={namespace:'synthetic',pool,definitions:[definition],authorize:async request=>{calls.authorize++;await control.authorize?.(request);return control.allow;}};
 worker=createPostgresEventDeliveryRuntime(options,async(callback,bytes,headers)=>{calls.sends.push({callback,body:bytes.toString(),headers});if(control.send)return control.send(worker);return {status:control.status,body:Buffer.alloc(0)};});
 return {worker,control,calls,state,pool,definition,options};
}
test('successful scripted delivery uses one connection and three transactions',async()=>{
 const f=fixture();assert.deepEqual(await f.worker.deliver('delivery:1',inv()),{outcome:'terminal',reason:'callback_accepted'});
 assert.equal(f.calls.acquired,1);assert.equal(f.calls.commits,3);assert.equal(f.calls.released,1);assert.equal(f.calls.discarded,0);assert.equal(f.calls.sends.length,1);
 assert.equal(JSON.parse(f.calls.sends[0].body).data.messageId,'captured:1');assert.equal(f.calls.sends[0].headers['webhook-id'],'event:1');assert.equal(await f.worker.settle(inv()),true);
});
test('simulated unknown reservation COMMIT admits no HTTP and consumes the scripted reservation',async()=>{
 const f=fixture();f.control.commitFaultAt=2;
 assert.deepEqual(await f.worker.deliver('delivery:1',inv()),{outcome:'retry_pending',reason:'unknown_outcome'});
 assert.equal(f.calls.sends.length,0);assert.equal(f.state.reservations,1);assert.equal(f.calls.reservations,1);assert.equal(f.calls.discarded,1);await f.worker.settle(inv());
});
test('denied policy suppresses under lease without allocating any reservation',async()=>{
 const f=fixture();f.control.allow=false;
 assert.deepEqual(await f.worker.deliver('delivery:1',inv()),{outcome:'terminal',reason:'suppressed'});
 assert.equal(f.state.reservations,0);assert.equal(f.calls.reservations,0);assert.equal(f.calls.sends.length,0);assert.equal(f.state.intent,'revoked');await f.worker.settle(inv());
});
test('late HTTP response is unknown and remains tracked after caller abort',async()=>{
 const f=fixture(),entered=deferred(),blocked=deferred(),controller=new AbortController();
 f.control.send=()=>{entered.resolve();return blocked.promise;};
 const operation=f.worker.deliver('delivery:1',{signal:controller.signal,deadlineMs:Date.now()+25000});
 await entered.promise;controller.abort();assert.deepEqual(await operation,{outcome:'retry_pending',reason:'unknown_outcome'});
 assert.equal(f.state.reservations,1);assert.equal(await f.worker.settle(inv(10)),false);
 blocked.resolve({status:200,body:Buffer.alloc(0)});assert.equal(await f.worker.settle(inv()),true);assert.equal(f.calls.commits,2);
});
test('transport rejection remains unknown and does not immediately reuse the admitted reservation',async()=>{
 const f=fixture();f.control.send=()=>{throw new Error('SYNTHETIC_TRANSPORT_UNCERTAINTY');};
 assert.deepEqual(await f.worker.deliver('delivery:1',inv()),{outcome:'retry_pending',reason:'unknown_outcome'});
 assert.deepEqual(await f.worker.deliver('delivery:1',inv()),{outcome:'retry_pending',reason:'leased'});assert.equal(f.calls.sends.length,1);assert.equal(f.state.reservations,1);await f.worker.settle(inv());
});
test('fresh rotation after claim signs with current key rather than claim-time material',async()=>{
 const f=fixture();f.control.authorize=()=>{f.control.secret=`whsec_${Buffer.alloc(32,8).toString('base64')}`;};
 await f.worker.deliver('delivery:1',inv());const sent=f.calls.sends[0];
 assert.equal(sent.headers['webhook-signature'],signWebhook(f.control.secret,'event:1',Number(sent.headers['webhook-timestamp']),Buffer.from(sent.body)));await f.worker.settle(inv());
});
test('fourth live owner sends once, in-process competing admission is bounded, and there is no fifth reservation',async()=>{
 const f=fixture({reservations:3});let competing;
 f.control.send=async worker=>{competing=await worker.deliver('delivery:1',inv());return {status:503,body:Buffer.alloc(0)};};
 assert.deepEqual(await f.worker.deliver('delivery:1',inv()),{outcome:'terminal',reason:'attempts_exhausted'});
 assert.deepEqual(competing,{outcome:'retry_pending',reason:'unavailable'});assert.equal(f.state.reservations,4);assert.equal(f.calls.reservations,1);assert.equal(f.calls.sends.length,1);
 assert.deepEqual(await f.worker.deliver('delivery:1',inv()),{outcome:'terminal',reason:'attempts_exhausted'});assert.equal(f.calls.sends.length,1);await f.worker.settle(inv());
});
test('accepted terminal receipt survives replay after intent revocation',async()=>{
 const f=fixture({terminal:'accepted',intent:'revoked',reservations:1});
 assert.deepEqual(await f.worker.deliver('delivery:1',inv()),{outcome:'terminal',reason:'callback_accepted'});assert.equal(f.calls.sends.length,0);assert.equal(f.calls.authorize,0);assert.equal(f.state.terminal,'accepted');await f.worker.settle(inv());
});
test('insufficient outbound budget allocates no reservation and sends nothing',async()=>{
 const f=fixture();assert.deepEqual(await f.worker.deliver('delivery:1',inv(5000)),{outcome:'retry_pending',reason:'deadline'});
 assert.equal(f.calls.sends.length,0);assert.equal(f.calls.reservations,0);await f.worker.settle(inv());
});
test('a nearly expired lease is rejected before allocating a reservation',async()=>{
 const f=fixture();f.control.authorize=()=>{f.control.now+=50000;};
 assert.deepEqual(await f.worker.deliver('delivery:1',inv()),{outcome:'retry_pending',reason:'deadline'});assert.equal(f.calls.reservations,0);assert.equal(f.calls.sends.length,0);await f.worker.settle(inv());
});
test('known HTTP failure retries with identical canonical capture bytes and stable event ID',async()=>{
 const f=fixture();f.control.status=503;
 assert.deepEqual(await f.worker.deliver('delivery:1',inv()),{outcome:'retry_pending',reason:'callback_failed'});f.control.now+=1001;f.control.status=200;
 assert.deepEqual(await f.worker.deliver('delivery:1',inv()),{outcome:'terminal',reason:'callback_accepted'});
 assert.equal(f.calls.sends.length,2);assert.equal(f.calls.sends[0].body,f.calls.sends[1].body);assert.equal(f.calls.sends[0].headers['webhook-id'],f.calls.sends[1].headers['webhook-id']);assert.equal(f.state.reservations,2);await f.worker.settle(inv());
});
test('async matcher is rejected and tracked rather than treated as truthy eligibility',async()=>{
 const f=fixture(),pending=deferred();f.definition.matches=()=>pending.promise;
 // Normalization captures the matcher: construct a fresh runtime after replacing it.
 const worker=createPostgresEventDeliveryRuntime(f.options,async()=>{throw new Error('No HTTP expected');});
 assert.deepEqual(await worker.deliver('delivery:1',inv()),{outcome:'retry_pending',reason:'unavailable'});assert.equal(f.calls.reservations,0);assert.equal(await worker.settle(inv(10)),false);
 pending.resolve(true);assert.equal(await worker.settle(inv()),true);await f.worker.settle(inv());
});
test('SQL-group budget is cumulative across queries, not reset per statement',async()=>{
 const realNow=performance.now();let clock=realNow,releases=0,commits=0;
 const owner=createDeliverySessionOwner({async connect(){return {async query(sql){if(sql==='synthetic:one'||sql==='synthetic:two')clock+=600;if(sql==='COMMIT')commits++;return {rows:[],rowCount:0};},release(error){assert.ok(error);releases++;}};}});
 const spy=mock.method(performance,'now',()=>clock);
 try {
  await assert.rejects(owner.run(inv(),session=>session.transaction(async run=>{await run('synthetic:one');await run('synthetic:two');})),error=>error.code==='OUTCOME_UNKNOWN');
  assert.equal(commits,0);assert.equal(releases,1);assert.equal(await owner.settle(inv()),true);
 }finally{spy.mock.restore();}
});

test('visible policy abort retains private worker admission until actual policy joins',async()=>{const f=fixture(),entered=deferred(),blocked=deferred(),controller=new AbortController();f.control.authorize=async()=>{entered.resolve();await blocked.promise;};const operation=f.worker.deliver('delivery:1',{signal:controller.signal,deadlineMs:Date.now()+25000});await entered.promise;controller.abort();assert.deepEqual(await operation,{outcome:'retry_pending',reason:'aborted'});const acquired=f.calls.acquired;assert.deepEqual(await f.worker.deliver('delivery:2',inv()),{outcome:'retry_pending',reason:'unavailable'});assert.equal(f.calls.acquired,acquired);blocked.resolve();await new Promise(resolve=>setImmediate(resolve));f.control.authorize=undefined;assert.deepEqual(await f.worker.deliver('delivery:1',inv()),{outcome:'retry_pending',reason:'leased'});assert.equal(f.calls.acquired,acquired+1);assert.equal(await f.worker.settle(inv()),true);});
