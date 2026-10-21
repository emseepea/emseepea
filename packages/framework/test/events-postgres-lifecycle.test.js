import assert from 'node:assert/strict';
import test from 'node:test';
import { createOwnedEventOperations } from '../dist/events-postgres-owned.js';
import { createPostgresEventLifecycleMigrator } from '../dist/events-postgres-lifecycle-migrations.js';
import { createPostgresEventLifecycle } from '../dist/events-postgres-lifecycle.js';
import { mcpEventSubscriptionIdentity } from '../dist/events.js';
import { ExternalMcpEventError } from '../dist/events-external.js';
const inv=(ms=4000)=>({signal:new AbortController().signal,deadlineMs:Date.now()+ms});
const reject=(promise,code)=>assert.rejects(promise,error=>error?.code===code);
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
test('invalid identity and accessors reject without pool acquisition',async()=>{
  let acquisitions=0,getters=0;const pool={async connect(){acquisitions++;throw new Error('No acquisition expected');}};
  const lifecycle=createPostgresEventLifecycle({namespace:'synthetic',observationPool:pool,mutationPool:pool});
  const input={id:'forged',ownerKey:'owner:1',name:'synthetic.reply',url:'https://callback.example/events',arguments:{}};
  await reject(lifecycle.observe(input,inv()),'INVALID_INPUT');
  const getter=Object.defineProperty({},'id',{enumerable:true,get(){getters++;return 'forged';}});
  await reject(lifecycle.revoke(getter,inv()),'INVALID_INPUT');
  assert.equal(acquisitions,0);assert.equal(getters,0);assert.equal(await lifecycle.settle(inv()),true);
});
test('pre-aborted operation acquires no connection',async()=>{
  const owned=createOwnedEventOperations();let calls=0;
  await reject(owned.run({async connect(){calls++;}},{signal:AbortSignal.abort(),deadlineMs:Date.now()+1000},async()=>{}),'ABORTED');
  assert.equal(calls,0);assert.equal(await owned.settle(inv()),true);
});
test('late acquisition is discarded exactly once and remains tracked until disposal',async()=>{
  const owned=createOwnedEventOperations(),acquired=deferred();let releases=0,queries=0;
  const operation=owned.run({connect:()=>acquired.promise},inv(),async()=>{});
  const rejected=reject(operation,'DEADLINE');
  await rejected;
  assert.equal(await owned.settle(inv(10)),false);
  acquired.resolve({async query(){queries++;return {rows:[],rowCount:0};},release(error){assert.ok(error);releases++;}});
  assert.equal(await owned.settle(inv()),true);assert.equal(releases,1);assert.equal(queries,0);
});
test('query abort is unknown and raw work is tracked after method completion',async()=>{
  const owned=createOwnedEventOperations(),blocked=deferred(),entered=deferred();const controller=new AbortController();let releases=0;
  const pool={async connect(){return {async query(sql){if(sql==='SELECT synthetic_block'){entered.resolve();return blocked.promise;}return {rows:[],rowCount:0};},release(error){assert.ok(error);releases++;}};}};
  const operation=owned.run(pool,{signal:controller.signal,deadlineMs:Date.now()+4000},async run=>{await run('SELECT synthetic_block');});
  const rejected=reject(operation,'OUTCOME_UNKNOWN');await entered.promise;controller.abort();await rejected;
  assert.equal(releases,1);assert.equal(await owned.settle(inv(10)),false);
  blocked.resolve({rows:[],rowCount:0});assert.equal(await owned.settle(inv()),true);
});
test('confirmed conflict rolls back and preserves the conflict without poisoning connection',async()=>{
  const owned=createOwnedEventOperations(),commands=[];let releaseError='not called';
  const pool={async connect(){return {async query(sql){commands.push(sql);return {rows:[],rowCount:0};},release(error){releaseError=error;}};}};
  await reject(owned.run(pool,inv(),async()=>{throw new ExternalMcpEventError('SUBSCRIPTION_CHANGED');}),'SUBSCRIPTION_CHANGED');
  assert.ok(commands.includes('ROLLBACK'));assert.equal(releaseError,undefined);assert.equal(await owned.settle(inv()),true);
});
test('simulated lost COMMIT acknowledgement stays unknown and does not retry',async()=>{
  const owned=createOwnedEventOperations();let commits=0,mutations=0,discarded=0;
  const pool={async connect(){return {async query(sql){if(sql==='COMMIT'){commits++;throw Object.assign(new Error('Synthetic lost acknowledgement'),{code:'08006'});}if(sql==='SELECT synthetic_write')mutations++;return {rows:[],rowCount:0};},release(error){assert.ok(error);discarded++;}};}};
  await reject(owned.run(pool,inv(),async run=>{await run('SELECT synthetic_write');}),'OUTCOME_UNKNOWN');
  assert.equal(commits,1);assert.equal(mutations,1);assert.equal(discarded,1);assert.equal(await owned.settle(inv()),true);
});

test('invalid Unicode keys and negative zero reject before acquisition',async()=>{
  let acquisitions=0;const pool={async connect(){acquisitions++;throw new Error('Unexpected');}};
  const lifecycle=createPostgresEventLifecycle({namespace:'synthetic',observationPool:pool,mutationPool:pool});
  for(const args of [{value:-0},{['bad\\u0000key'.replace('\\u0000','\u0000')]:1},{['\ud800']:1}]) {
    const input={ownerKey:'owner',name:'synthetic.reply',url:'https://callback.example/events',arguments:args};
    await reject(lifecycle.observe({...input,id:mcpEventSubscriptionIdentity(input.ownerKey,input.name,args,input.url)},inv()),'INVALID_INPUT');
  }
  assert.equal(acquisitions,0);
});
test('acquisition rejection cannot expose raw driver error text',async()=>{
  const owned=createOwnedEventOperations();
  const pool={async connect(){throw new Error('SYNTHETIC_SENSITIVE_DRIVER_DETAIL');}};
  await assert.rejects(owned.run(pool,inv(),async()=>{}),error=>error.code==='UNAVAILABLE'&&!error.message.includes('SYNTHETIC_SENSITIVE'));
  assert.equal(await owned.settle(inv()),true);
});

test('migrator tracks late prerequisite acquisition and reports disposal failure',async()=>{
  const acquired=deferred(),entered=deferred(),controller=new AbortController();let queries=0,releases=0;
  const migrator=createPostgresEventLifecycleMigrator({connect(){entered.resolve();return acquired.promise;}});
  const operation=migrator.migrate({signal:controller.signal,deadlineMs:Date.now()+4000});
  const rejected=reject(operation,'UNAVAILABLE');await entered.promise;controller.abort();await rejected;
  assert.equal(await migrator.settle(inv(10)),false);
  acquired.resolve({async query(){queries++;return {rows:[],rowCount:0};},release(){releases++;throw new Error('SYNTHETIC_DISPOSAL_FAILURE');}});
  assert.equal(await migrator.settle(inv()),false);assert.equal(queries,0);assert.equal(releases,1);
});
test('migrator tracks a prerequisite query after it reports unknown',async()=>{
  const blocked=deferred(),entered=deferred(),controller=new AbortController();let releases=0;
  const migrator=createPostgresEventLifecycleMigrator({async connect(){return {
    async query(){entered.resolve();return blocked.promise;},release(error){assert.ok(error);releases++;}
  };}});
  const operation=migrator.migrate({signal:controller.signal,deadlineMs:Date.now()+4000});
  const rejected=reject(operation,'OUTCOME_UNKNOWN');await entered.promise;controller.abort();await rejected;
  assert.equal(await migrator.settle(inv(10)),false);assert.equal(releases,0);
  blocked.resolve({rows:[],rowCount:0});assert.equal(await migrator.settle(inv()),true);assert.equal(releases,1);
});
test('non-array Array.prototype inheritance rejects before acquisition',async()=>{
  let acquisitions=0;const pool={async connect(){acquisitions++;throw new Error('Unexpected');}};
  const lifecycle=createPostgresEventLifecycle({namespace:'synthetic',observationPool:pool,mutationPool:pool});
  const args=Object.create(Array.prototype),ownerKey='owner',name='synthetic.reply',url='https://callback.example/events';
  await reject(lifecycle.observe({id:mcpEventSubscriptionIdentity(ownerKey,name,args,url),ownerKey,name,url,arguments:args},inv()),'INVALID_INPUT');
  assert.equal(acquisitions,0);
});
