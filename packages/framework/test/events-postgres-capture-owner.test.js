import assert from 'node:assert/strict';
import test from 'node:test';
import {createPostgresEventCaptureMigrator} from '../dist/events-postgres-migrations.js';
const inv=(ms=4000)=>({signal:new AbortController().signal,deadlineMs:Date.now()+ms});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const rejects=(promise,code)=>assert.rejects(promise,error=>error?.code===code);
const empty={rows:[],rowCount:0};

test('capture owner pre-abort and expired invocation acquire nothing',async()=>{
 let calls=0;const owner=createPostgresEventCaptureMigrator({async connect(){calls++;throw new Error('unexpected');}});
 await rejects(owner.migrate({signal:AbortSignal.abort(),deadlineMs:Date.now()+1000}),'ABORTED');
 await rejects(owner.migrate(inv(-1)),'DEADLINE');assert.equal(calls,0);assert.equal(await owner.settle(inv()),true);
});
test('capture owner retains late acquisition and reports actual disposal failure',async()=>{
 const acquired=deferred(),entered=deferred(),controller=new AbortController();let calls=0,releases=0;
 const owner=createPostgresEventCaptureMigrator({connect(){entered.resolve();return acquired.promise;}});
 const operation=rejects(owner.migrate({signal:controller.signal,deadlineMs:Date.now()+4000}),'ABORTED');
 await entered.promise;controller.abort();await operation;assert.equal(await owner.settle(inv(10)),false);
 acquired.resolve({async query(){calls++;return empty;},release(error){assert.ok(error);releases++;throw new Error('private');}});
 assert.equal(await owner.settle(inv()),false);assert.equal(calls,0);assert.equal(releases,1);
});
test('capture owner defers physical release until raw query settles after unknown',async()=>{
 const blocked=deferred(),entered=deferred(),controller=new AbortController();let releases=0;const commands=[];
 const owner=createPostgresEventCaptureMigrator({async connect(){return {async query(sql){commands.push(sql);entered.resolve();return blocked.promise;},release(error){assert.ok(error);releases++;}};}});
 const operation=rejects(owner.migrate({signal:controller.signal,deadlineMs:Date.now()+4000}),'OUTCOME_UNKNOWN');
 await entered.promise;controller.abort();await operation;
 assert.equal(releases,0);assert.equal(await owner.settle(inv(10)),false);assert.deepEqual(commands,['BEGIN']);
 blocked.resolve(empty);assert.equal(await owner.settle(inv()),true);assert.equal(releases,1);assert.deepEqual(commands,['BEGIN']);
});
test('capture owner retains deferred release failure independently of query outcome',async()=>{
 const blocked=deferred(),entered=deferred(),controller=new AbortController();let releases=0;
 const owner=createPostgresEventCaptureMigrator({async connect(){return {async query(){entered.resolve();return blocked.promise;},release(){releases++;throw new Error('private');}};}});
 const operation=rejects(owner.migrate({signal:controller.signal,deadlineMs:Date.now()+4000}),'OUTCOME_UNKNOWN');
 await entered.promise;controller.abort();await operation;assert.equal(releases,0);
 blocked.resolve(empty);assert.equal(await owner.settle(inv()),false);assert.equal(await owner.settle(inv()),false);assert.equal(releases,1);
});
test('capture owner reserved view partial or retained family never triggers fresh DDL',async()=>{
 for(const relname of ['emseepea_event_capture_migrations','emseepea_event_capture_subscriptions','emseepea_event_dispatches']){
  const commands=[];let released=0;
  const owner=createPostgresEventCaptureMigrator({async connect(){return {async query(sql){commands.push(sql);return sql.includes('pg_catalog.starts_with')?{rows:[{relname,relkind:'v'}],rowCount:1}:empty;},release(error){assert.equal(error,undefined);released++;}};}});
  await rejects(owner.migrate(inv()),'INCOMPATIBLE_SCHEMA');assert.ok(commands.includes('ROLLBACK'));assert.equal(commands.some(sql=>sql.startsWith('CREATE')),false);
  assert.equal(await owner.settle(inv()),true);assert.equal(released,1);
 }
});
test('capture owner confirmed SQL rejection rolls back and exposes no driver details',async()=>{
 const commands=[];
 const owner=createPostgresEventCaptureMigrator({async connect(){return {async query(sql){commands.push(sql);if(sql.includes('pg_advisory'))throw Object.assign(new Error('private detail'),{code:'42501'});return empty;},release(error){assert.equal(error,undefined);}};}});
 await assert.rejects(owner.migrate(inv()),error=>error.code==='UNAVAILABLE'&&error.message==='UNAVAILABLE');
 assert.ok(commands.includes('ROLLBACK'));assert.equal(await owner.settle(inv()),true);
});
test('capture owner settlement closes admission synchronously without ending caller pool',async()=>{
 let calls=0,ended=0;const owner=createPostgresEventCaptureMigrator({async connect(){calls++;throw new Error('unexpected');},end(){ended++;}});
 const settled=owner.settle(inv());await rejects(owner.migrate(inv()),'UNAVAILABLE');assert.equal(await settled,true);assert.equal(calls,0);assert.equal(ended,0);
});
test('capture owner acquisition errors remain categorical and settled',async()=>{
 const owner=createPostgresEventCaptureMigrator({async connect(){throw new Error('private driver text');}});
 await assert.rejects(owner.migrate(inv()),error=>error.code==='UNAVAILABLE'&&error.message==='UNAVAILABLE');assert.equal(await owner.settle(inv()),true);
});
