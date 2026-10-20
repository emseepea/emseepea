import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { z } from 'zod';
import { createExternalMcpEventRuntime, ExternalMcpEventError } from '../dist/events-external.js';
const definition = { name:'synthetic.reply',description:'A synthetic reply reference.',
  inputSchema:z.strictObject({threadId:z.string()}),payloadSchema:z.strictObject({threadId:z.string()}),matches:()=>true };
const secret = `whsec_${Buffer.alloc(32,7).toString('base64')}`;
const params = () => ({name:definition.name,arguments:{threadId:'thread:1'},ttlMs:10000,
  delivery:{mode:'webhook',url:'https://callback.example/events',secret}});
const reject = (promise,code) => assert.rejects(promise,(error)=>error?.code===code);
function fixture({callbackTimeoutMs=5000}={}) {
  const records = new Map(); const calls={observe:0,activate:0,revoke:0,challenges:0,writes:0,authorizations:[]};
  const control={allow:true,now:Date.now(),challenge:undefined,beforeActivate:undefined,afterActivate:undefined};
  let revision=0,generation=0;
  const lifecycle={
    async observe(identity) {
      calls.observe++;
      const row=records.get(identity.id);
      return structuredClone(row ? {...row,observedAt:control.now,active:row.active&&row.subscription.expiresAt>control.now} :
        {id:identity.id,ownerKey:identity.ownerKey,revision:null,generation:null,active:false,observedAt:control.now,subscription:null});
    },
    async activate(request,invocation) {
      calls.activate++; await control.beforeActivate?.(request,invocation);
      const prior=records.get(request.id);
      if ((prior?.revision??null)!==request.expectedRevision || request.intent==='renew' && (!prior?.active || prior.subscription.expiresAt<=control.now)) throw new ExternalMcpEventError('SUBSCRIPTION_CHANGED');
      const nextGeneration=request.intent==='renew'?prior.generation:`g:${++generation}`;
      const value={id:request.id,ownerKey:request.ownerKey,revision:`r:${++revision}`,generation:nextGeneration,
        active:true,observedAt:control.now,subscription:{id:request.id,ownerKey:request.ownerKey,name:request.name,arguments:structuredClone(request.arguments),url:request.url,expiresAt:control.now+request.ttlMs}};
      records.set(request.id,value);calls.writes++;
      await control.afterActivate?.(request,invocation);
      return {id:request.id,revision:value.revision,generation:nextGeneration,observedAt:control.now,expiresAt:value.subscription.expiresAt};
    },
    async revoke(identity) {
      calls.revoke++;const prior=records.get(identity.id);
      records.set(identity.id,{id:identity.id,ownerKey:identity.ownerKey,revision:`r:${++revision}`,generation:prior?.generation??null,active:false,observedAt:control.now,subscription:null});
    },
  };
  const options={mode:'external',callbackTimeoutMs,definitions:[definition],ownerKey:()=> 'owner:1',authorize:({phase})=>{calls.authorizations.push(phase);return control.allow;},health:()=>true,lifecycle};
  const runtime=createExternalMcpEventRuntime(options,async(_url,body)=>{
    calls.challenges++;await control.challenge?.();
    return {status:200,body:Buffer.from(JSON.stringify({challenge:JSON.parse(body).challenge}))};
  });
  return {runtime,records,calls,control,options};
}
test('external renewal always verifies afresh and keeps native responses free of ledger state',async()=>{
  const f=fixture();const first=await f.runtime.subscribe('owner:1',params());
  const generation=f.records.get(first.id).generation;
  const again=await f.runtime.subscribe('owner:1',params());
  assert.equal(f.calls.challenges,2);assert.equal(f.records.get(first.id).generation,generation);
  assert.deepEqual(f.calls.authorizations,['subscribe','subscribe','refresh','refresh']);
  assert.deepEqual(Object.keys(again).sort(),['cursor','id','refreshBefore','truncated']);
  assert.equal('drain' in f.runtime,false);
});
test('denied authorization sends no challenge and persists nothing',async()=>{
  const f=fixture();f.control.allow=false;
  await assert.rejects(f.runtime.subscribe('owner:1',params()),error=>error.reason==='capability_not_found');
  assert.equal(f.calls.challenges,0);assert.equal(f.calls.activate,0);assert.equal(f.calls.writes,0);
});
test('authorization revoked during challenge prevents activation',async()=>{
  const f=fixture();f.control.challenge=()=>{f.control.allow=false;};
  await assert.rejects(f.runtime.subscribe('owner:1',params()),error=>error.reason==='capability_not_found');
  assert.equal(f.calls.challenges,1);assert.equal(f.calls.activate,0);assert.equal(f.calls.writes,0);
});
test('failed challenge persists nothing',async()=>{
  const f=fixture();f.control.challenge=()=>{throw new Error('synthetic transport failure');};
  await assert.rejects(f.runtime.subscribe('owner:1',params()),error=>error.reason==='challenge_failed');
  assert.equal(f.calls.activate,0);assert.equal(f.calls.writes,0);
});
test('unsubscribe fences a pending activation that observed no identity',async()=>{
  const f=fixture();f.control.challenge=async()=>{await f.runtime.unsubscribe('owner:1',params());};
  await reject(f.runtime.subscribe('owner:1',params()),'SUBSCRIPTION_CHANGED');
  assert.equal(f.calls.observe,1);assert.equal(f.calls.activate,1);assert.equal(f.calls.writes,0);
  assert.equal([...f.records.values()].filter(row=>row.active).length,0);
});
test('stale renewal cannot recreate a revoked generation; later request must reauthorize',async()=>{
  const f=fixture();const first=await f.runtime.subscribe('owner:1',params());const old=f.records.get(first.id).generation;
  f.control.challenge=async()=>{await f.runtime.unsubscribe('owner:1',params());};
  await reject(f.runtime.subscribe('owner:1',params()),'SUBSCRIPTION_CHANGED');
  assert.equal(f.calls.writes,1);
  f.control.challenge=undefined;await f.runtime.subscribe('owner:1',params());
  assert.notEqual(f.records.get(first.id).generation,old);assert.deepEqual(f.calls.authorizations.slice(-2),['subscribe','subscribe']);
});
test('renewal crossing expiry rejects instead of creating a new generation under refresh authority',async()=>{
  const f=fixture();await f.runtime.subscribe('owner:1',params());
  f.control.challenge=()=>{f.control.now+=20000;};
  await reject(f.runtime.subscribe('owner:1',params()),'SUBSCRIPTION_CHANGED');
  assert.equal(f.calls.writes,1);assert.equal(f.calls.observe,2);assert.equal(f.calls.activate,2);
});
test('secret rotation before expiry verifies and preserves generation',async()=>{
  const f=fixture();const first=await f.runtime.subscribe('owner:1',params());const generation=f.records.get(first.id).generation;
  const rotated=params();rotated.delivery.secret=`whsec_${Buffer.alloc(32,8).toString('base64')}`;
  await f.runtime.subscribe('owner:1',rotated);
  assert.equal(f.calls.challenges,2);assert.equal(f.records.get(first.id).generation,generation);
});
test('cross-owner unsubscribe cannot revoke another identity',async()=>{
  const f=fixture();const first=await f.runtime.subscribe('owner:1',params());
  await f.runtime.unsubscribe('owner:2',params());assert.equal(f.records.get(first.id).active,true);
});
test('mixed configuration and invalid callbacks reject before lifecycle/challenge',async()=>{
  const f=fixture();assert.throws(()=>createExternalMcpEventRuntime({...f.options,store:{}}));
  for (const url of ['http://127.0.0.1/private','https://localhost/private','https://127.0.0.1/private']) {
    const invalid=params();invalid.delivery.url=url;await assert.rejects(f.runtime.subscribe('owner:1',invalid));
  }
  assert.equal(f.calls.observe,0);assert.equal(f.calls.activate,0);assert.equal(f.calls.challenges,0);
});
test('unsupported legacy publication fails before ledger effects',async()=>{
  const f=fixture();await reject(f.runtime.publish(definition.name,{threadId:'thread:1'}),'EXTERNAL_PUBLICATION_REQUIRES_CAPTURE');
  assert.equal(f.calls.observe+f.calls.activate+f.calls.revoke,0);
});
test('activation abort after write is unknown, not a zero-persistence claim',async()=>{
  const f=fixture();const controller=new AbortController();
  f.control.afterActivate=()=>{controller.abort();};
  const runtime=f.runtime.forInvocation({signal:controller.signal,deadlineMs:Date.now()+4000});
  await reject(runtime.subscribe('owner:1',params()),'OUTCOME_UNKNOWN');
  assert.equal(f.calls.writes,1);assert.equal(f.calls.activate,1);
});
test('pre-aborted invocation admits no lifecycle work',async()=>{
  const f=fixture();assert.throws(()=>f.runtime.forInvocation({signal:AbortSignal.abort(),deadlineMs:Date.now()+4000}),error=>error.code==='ABORTED');
  assert.equal(f.calls.observe+f.calls.activate+f.calls.revoke,0);
});

test('malformed observation rejects before outbound verification',async()=>{
  const f=fixture();f.options.lifecycle.observe=async(identity)=>({id:identity.id,ownerKey:'wrong-owner',revision:null,generation:null,active:false,observedAt:Date.now(),subscription:null});
  await reject(f.runtime.subscribe('owner:1',params()),'UNAVAILABLE');assert.equal(f.calls.challenges,0);assert.equal(f.calls.activate,0);
});
test('inactive unexpired observation rejects before outbound verification',async()=>{
  const f=fixture();const observedAt=Date.now();
  f.options.lifecycle.observe=async(identity)=>({
    id:identity.id,ownerKey:identity.ownerKey,revision:'r:live',generation:'g:live',active:false,observedAt,
    subscription:{id:identity.id,ownerKey:identity.ownerKey,name:identity.name,arguments:structuredClone(identity.arguments),url:identity.url,expiresAt:observedAt+10000},
  });
  await reject(f.runtime.subscribe('owner:1',params()),'UNAVAILABLE');
  assert.equal(f.calls.challenges,0);assert.equal(f.calls.activate,0);assert.equal(f.calls.writes,0);
});
test('snapshot mutation during challenge cannot change the originally observed revision',async()=>{
  const f=fixture();let raw;
  f.options.lifecycle.observe=async(identity)=>{raw={id:identity.id,ownerKey:identity.ownerKey,revision:null,generation:null,active:false,observedAt:f.control.now,subscription:null};return raw;};
  f.control.challenge=()=>{raw.revision='mutated';raw.ownerKey='wrong-owner';};
  f.control.beforeActivate=(request)=>{assert.equal(request.expectedRevision,null);assert.equal(request.ownerKey,'owner:1');};
  await f.runtime.subscribe('owner:1',params());assert.equal(f.calls.writes,1);
});
test('shutdown joins admitted work and prevents further lifecycle admission',async()=>{
  const f=fixture();const controller=new AbortController();let enter,finish;
  const entered=new Promise(resolve=>{enter=resolve;});const pending=new Promise(resolve=>{finish=resolve;});
  f.control.challenge=async()=>{enter();await pending;};
  const operation=f.runtime.forInvocation({signal:controller.signal,deadlineMs:Date.now()+4000}).subscribe('owner:1',params());
  const rejected=reject(operation,'ABORTED');await entered;controller.abort();await rejected;
  const closing=f.runtime.settle();finish();assert.equal(await closing,true);
  assert.equal(f.calls.activate,0);await reject(f.runtime.subscribe('owner:1',params()),'ABORTED');
});

test('lifecycle receives the stage deadline and late activation remains unknown',async()=>{
  const f=fixture();const controller=new AbortController();
  f.control.beforeActivate=(_request,invocation)=>{
    const remaining=invocation.deadlineMs-Date.now();
    assert.ok(remaining>0&&remaining<=5000);
    assert.equal(invocation.signal.aborted,false);
  };
  f.control.afterActivate=()=>{controller.abort();};
  await reject(f.runtime.forInvocation({signal:controller.signal,deadlineMs:Date.now()+25000}).subscribe('owner:1',params()),'OUTCOME_UNKNOWN');
  assert.equal(f.calls.writes,1);
});
test('backwards activation time is unknown after the lifecycle write',async()=>{
  const f=fixture();f.control.afterActivate=()=>{f.control.now-=1;};
  await reject(f.runtime.subscribe('owner:1',params()),'OUTCOME_UNKNOWN');
  assert.equal(f.calls.writes,1);
});
test('unfinished challenge is tracked after abort and late completion cannot activate',async()=>{
  const f=fixture();const controller=new AbortController();let enter,finish;
  const entered=new Promise(resolve=>{enter=resolve;});const pending=new Promise(resolve=>{finish=resolve;});
  f.control.challenge=async()=>{enter();await pending;};
  const operation=f.runtime.forInvocation({signal:controller.signal,deadlineMs:Date.now()+4000}).subscribe('owner:1',params());
  const rejected=reject(operation,'ABORTED');await entered;controller.abort();await rejected;
  try {
    mock.timers.enable({apis:['setTimeout']});
    const closing=f.runtime.settle();mock.timers.tick(10000);
    assert.equal(await closing,false);
    finish();assert.equal(await f.runtime.settle(),true);
    assert.deepEqual(f.calls.authorizations,['subscribe']);assert.equal(f.calls.activate,0);
  } finally { finish();mock.timers.reset();await f.runtime.settle(); }
});

test('effect completed synchronously after stage deadline is unknown before timer dispatch',async()=>{
  const f=fixture({callbackTimeoutMs:5});let stageSignal;
  f.control.afterActivate=(_request,invocation)=>{
    stageSignal=invocation.signal;
    const end=performance.now()+15;
    while(performance.now()<end) { /* Deliberately prevent the timer from dispatching. */ }
  };
  await reject(f.runtime.subscribe('owner:1',params()),'OUTCOME_UNKNOWN');
  assert.equal(f.calls.writes,1);assert.equal(stageSignal.aborted,true);
});

test('adapter raw work settlement is called even with no core operation pending under one cap',async()=>{
  const f=fixture();let context,finish;
  const raw=new Promise(resolve=>{finish=resolve;});
  f.options.lifecycle.settle=async invocation=>{context=invocation;await raw;return true;};
  try {
    mock.timers.enable({apis:['setTimeout']});
    const closing=f.runtime.settle();await Promise.resolve();
    assert.ok(context.deadlineMs-Date.now()<=10000);assert.equal(context.signal.aborted,false);
    mock.timers.tick(10000);assert.equal(await closing,false);assert.equal(context.signal.aborted,true);
    finish();assert.equal(await f.runtime.settle(),true);
  } finally {finish();mock.timers.reset();await f.runtime.settle();}
});

test('external shutdown respects a supplied cleanup deadline and abort without claiming raw cancellation',async()=>{
 const f=fixture(),controller=new AbortController();let context,finish,enter,joined=false;
 const entered=new Promise(resolve=>{enter=resolve;}),raw=new Promise(resolve=>{finish=resolve;});
 f.options.lifecycle.settle=async invocation=>{context=invocation;enter();await raw;joined=true;return true;};
 const deadlineMs=Date.now()+500,closing=f.runtime.settle({signal:controller.signal,deadlineMs});
 try{await entered;assert.equal(context.signal.aborted,false);assert.ok(context.deadlineMs<=deadlineMs);controller.abort();assert.equal(await closing,false);assert.equal(joined,false);assert.equal(context.signal.aborted,true);finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(joined,true);}
 finally{finish();await closing;}
});
test('expired external cleanup budget still attempts adapter shutdown once',async()=>{
 const f=fixture();let calls=0,signal;
 f.options.lifecycle.settle=async invocation=>{calls++;signal=invocation.signal;return true;};
 assert.equal(await f.runtime.settle({signal:new AbortController().signal,deadlineMs:Date.now()-1}),false);
 assert.equal(calls,1);assert.equal(signal.aborted,true);
});

test('synchronous lifecycle shutdown overrun is false before timer dispatch',async()=>{const f=fixture();let signal;f.options.lifecycle.settle=async input=>{signal=input.signal;const end=performance.now()+15;while(performance.now()<end){}return true;};assert.equal(await f.runtime.settle({signal:new AbortController().signal,deadlineMs:Date.now()+5}),false);assert.equal(signal.aborted,true);});

test('an incomplete external adapter ends its cleanup window without claiming raw cancellation',async()=>{const f=fixture();let input;f.options.lifecycle.settle=async value=>{input=value;return false;};assert.equal(await f.runtime.settle({signal:new AbortController().signal,deadlineMs:Date.now()+500}),false);assert.equal(input.signal.aborted,true);});

