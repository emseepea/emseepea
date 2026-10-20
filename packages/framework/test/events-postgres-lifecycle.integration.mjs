// Synthetic disposable PG17.11 only; no inherited credentials or live callback.
// env -i PATH="$PATH" node --experimental-test-module-mocks FILE PROJECT_ROOT PORT
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { isAbsolute,join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { mock } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import * as webhook from '../dist/events-webhook.js';
const moduleMockExports=Number(process.versions.node.split('.')[0])>=24?'exports':'namedExports';
let challenges=0;
mock.module('../dist/events-webhook.js',{[moduleMockExports]:{...webhook,async postCheckedWebhook(_url,body){
  challenges++;return {status:200,body:Buffer.from(JSON.stringify({challenge:JSON.parse(body).challenge}))};
}}});
const {createPostgresEventLifecycle,createPostgresEventLifecycleMigrator}=await import('../dist/events-postgres-lifecycle.js');
const {createPostgresEventCapture}=await import('../dist/events-postgres.js');
const {mcpEventSubscriptionIdentity}=await import('../dist/events.js');
const {createOwnedEventOperations}=await import('../dist/events-postgres-owned.js');
const {createEmseepea,serveEmseepea}=await import('../dist/index.js');
const [project,textPort,mode,encoded]=process.argv.slice(2),port=Number(textPort);
if(!isAbsolute(project??'')||!Number.isInteger(port)||port<1024||port>65535)process.exit(2);
const require=createRequire(join(project,'package.json')),{Pool}=require('pg');
assert.equal(require('pg/package.json').version,'8.23.0');
const pools=[],lifecycles=[],migrators=[];
const config=user=>({host:'127.0.0.1',port,database:'postgres',user,password:'synthetic-fixture-not-a-secret',ssl:false,
 application_name:'emseepea_lifecycle_fixture',connectionTimeoutMillis:500,query_timeout:1000,statement_timeout:750,lock_timeout:250,
 idle_in_transaction_session_timeout:1500,max:1,idleTimeoutMillis:1000,pipeline:false});
const pool=user=>{const p=new Pool(config(user));pools.push(p);return p;};
const inv=(ms=5000)=>({signal:new AbortController().signal,deadlineMs:Date.now()+ms});
const definition={name:'synthetic.reply',description:'Synthetic reply reference.',inputSchema:z.strictObject({threadId:z.string()}),payloadSchema:z.strictObject({threadId:z.string(),messageId:z.string()}),matches:(args,data)=>args.threadId===data.threadId};
const identity=(thread='thread:1',namespaceOwner='owner:1')=>{const value={ownerKey:namespaceOwner,name:definition.name,arguments:{threadId:thread},url:'https://callback.example/events'};return {...value,id:mcpEventSubscriptionIdentity(value.ownerKey,value.name,value.arguments,value.url)};};
const secret=byte=>`whsec_${Buffer.alloc(32,byte).toString('base64')}`;
const activation=(i,expectedRevision=null,patch={})=>({...i,expectedRevision,intent:'new',secret:secret(7),ttlMs:60000,...patch});
const make=(read,write,namespace='synthetic')=>{const v=createPostgresEventLifecycle({namespace,observationPool:read,mutationPool:write});lifecycles.push(v);return v;};
const reject=(promise,code)=>assert.rejects(promise,error=>error?.code===code);
const hard=setTimeout(()=>{process.stderr.write('WHOLE_PROCESS_DEADLINE\n');process.exit(1);},90000);
if(mode==='--race'||mode==='--observe') {
  const lifecycle=make(pool('e174_observe'),pool('e174_mutate'));
  try {const result=mode==='--observe'?await lifecycle.observe(JSON.parse(encoded),inv()):await lifecycle.activate(JSON.parse(encoded),inv());process.stdout.write(JSON.stringify({status:mode==='--observe'?'OBSERVED':'WIN',generation:result.generation})+'\n');}
  catch(error){process.stdout.write(JSON.stringify({status:error?.code==='SUBSCRIPTION_CHANGED'?'CONFLICT':'FAILED'})+'\n');}
  finally {let incomplete=false;for(const l of lifecycles)if(!await l.settle(inv()))incomplete=true;for(const p of pools)await p.end();clearTimeout(hard);if(incomplete)process.exitCode=1;}
} else {
 const report={scope:'UNCOMMITTED_DURABLE_LIFECYCLE_ONLY',node:process.version,platform:`${process.platform}/${process.arch}`,pgVersion:'8.23.0',plannedCases:16,cases:[]};
 let admin,migration,reader,writer,captureRole,server;
 async function run(name,fn) {
  const started=performance.now();try{const facts=await fn();report.cases.push({name,status:'PASS',...facts,elapsedMs:Math.round(performance.now()-started)});}
  catch(error){report.cases.push({name,status:'FAIL',category:/^[A-Z0-9_]{1,60}$/.test(error?.code??'')?error.code:'ASSERTION_OR_FIXTURE_FAILED',elapsedMs:Math.round(performance.now()-started)});}
 }
 const migrate=async()=>{const m=createPostgresEventLifecycleMigrator(migration);migrators.push(m);await m.migrate(inv());return m;};
 try {
  admin=pool('postgres');assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num,'170011');report.serverVersionNum='170011';
  for(const role of ['e174_migrate','e174_observe','e174_mutate','e174_capture'])await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD 'synthetic-fixture-not-a-secret'`);
  await admin.query('GRANT USAGE,CREATE ON SCHEMA public TO e174_migrate');
  await admin.query('GRANT USAGE ON SCHEMA public TO e174_observe,e174_mutate,e174_capture');
  migration=pool('e174_migrate');reader=pool('e174_observe');writer=pool('e174_mutate');captureRole=pool('e174_capture');
  await run('dirty migration session cannot shadow built-in capture or lifecycle text type',async()=>{
   const c=await migration.connect();try{await c.query('CREATE TEMP TABLE fixture_temp_init(id pg_catalog.int4)');await c.query('CREATE DOMAIN pg_temp.text AS pg_catalog.int4');}finally{c.release();}
   await migrate();await migrate();
   const types=(await admin.query("SELECT c.relname,a.atttypid FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND a.attname='namespace' AND c.relname IN ('emseepea_event_heads','emseepea_event_keys','emseepea_event_capture_subscriptions')")).rows;
   assert.equal(types.length,3);assert.ok(types.every(row=>row.atttypid===25));return {builtInTypes:true,repeatSafe:true};
  });
  if(report.cases[0]?.status!=='PASS')throw new Error('MIGRATION_PREREQUISITE_FAILED');
  await admin.query('GRANT SELECT ON public.emseepea_event_heads,public.emseepea_event_capture_subscriptions TO e174_observe');
  await admin.query('GRANT SELECT,INSERT,UPDATE ON public.emseepea_event_heads,public.emseepea_event_keys,public.emseepea_event_capture_subscriptions TO e174_mutate');
  await admin.query('GRANT DELETE ON public.emseepea_event_keys TO e174_mutate');
  await admin.query('GRANT SELECT(namespace,subscription_id,state),UPDATE(state) ON public.emseepea_event_intents TO e174_mutate');
  await admin.query('GRANT SELECT ON public.emseepea_event_capture_subscriptions,public.emseepea_event_sources,public.emseepea_event_intents TO e174_capture');
  await admin.query('GRANT INSERT ON public.emseepea_event_sources,public.emseepea_event_intents TO e174_capture');
  const lifecycle=make(reader,writer),i=identity();
  await run('observation and capture roles cannot read signing credentials or mutate schema',async()=>{
   for(const p of [reader,captureRole])await reject(p.query('SELECT * FROM public.emseepea_event_keys'),'42501');
   await reject(writer.query('ALTER TABLE public.emseepea_event_heads ADD COLUMN denied int'),'42501');
   return {signingReadDenied:true,runtimeDDLDenied:true};
  });
  await run('absent observation then absent revoke fences stale activation',async()=>{
   const v=identity('absent');const observed=await lifecycle.observe(v,inv());assert.equal(observed.revision,null);
   await lifecycle.revoke(v,inv());await reject(lifecycle.activate(activation(v),inv()),'SUBSCRIPTION_CHANGED');
   const tombstone=await lifecycle.observe(v,inv());assert.ok(tombstone.revision);assert.equal(tombstone.active,false);assert.equal(tombstone.subscription,null);
   return {persistentTombstone:true,staleActivationRejected:true};
  });
  await run('authenticated protocol subscription is captured under the same committed generation',async()=>{
   const resourceServerUrl=new URL('https://api.example/mcp');
   const app=createEmseepea({name:'synthetic-lifecycle',version:'0.0.0',authentication:{verifier:{async verifyAccessToken(token){return {token,clientId:'synthetic',scopes:['events:read'],expiresAt:Math.floor(Date.now()/1000)+60,resource:resourceServerUrl};}},metadata:{resourceServerUrl,oauthMetadata:{issuer:'https://auth.example',authorization_endpoint:'https://auth.example/authorize',token_endpoint:'https://auth.example/token',response_types_supported:['code']}}},
    events:{mode:'external',lifecycle:make(reader,writer),definitions:[definition],ownerKey:()=>i.ownerKey,authorize:()=>true,health:()=>true}});
   server=await serveEmseepea(app,{port:0});
   const meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientInfo':{name:'synthetic-pg',version:'0.0.0'},'io.modelcontextprotocol/clientCapabilities':{}};
   const beforeChallenges=challenges;
   const response=await fetch(server.url,{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json',accept:'application/json, text/event-stream','MCP-Protocol-Version':'2026-07-28','Mcp-Method':'events/subscribe'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'events/subscribe',params:{name:i.name,arguments:i.arguments,ttlMs:60000,delivery:{mode:'webhook',url:i.url,secret:secret(7)},_meta:meta}})});
   assert.equal(response.status,200);assert.equal(challenges,beforeChallenges+1);const wire=await response.json();assert.ok(wire.result);assert.equal(wire.result.id,i.id);assert.ok(!JSON.stringify(wire).includes('whsec_'));
   const before=await lifecycle.observe(i,inv());assert.equal(before.active,true);
   const api=createPostgresEventCapture({namespace:'synthetic',sourceKind:'reply',definitions:[definition]}),c=await captureRole.connect();
   try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');const handle=await api.bindTransaction(c,inv());const outcome=await api.captureInTransaction(handle,{sourceEventId:'reply:1:version:1',sourceVersion:'1',eventName:i.name,ownerKey:i.ownerKey,occurredAt:new Date().toISOString(),data:{threadId:'thread:1',messageId:'message:1'}},inv());assert.equal(outcome.deliveryCount,1);await c.query('COMMIT');}
   catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
   assert.equal((await admin.query('SELECT generation FROM public.emseepea_event_intents WHERE subscription_id=$1',[i.id])).rows[0].generation,before.generation);
   await server.close();server=undefined;
   return {checkedChallengeSeam:true,realAuthenticatedRPC:true,committedMatchingGeneration:true,nativeChatGPTTested:false};
  });
  await run('new independent process observes committed subscription and fresh instance renews same generation',async()=>{
   const restarted=make(reader,writer),old=await restarted.observe(i,inv());
   const output=await promisify(execFile)(process.execPath,['--experimental-test-module-mocks',import.meta.filename,project,textPort,'--observe',JSON.stringify(i)],{env:{PATH:process.env.PATH},timeout:6000,maxBuffer:8192});
   const observed=JSON.parse(output.stdout);assert.equal(observed.status,'OBSERVED');assert.equal(observed.generation,old.generation);
   const renewed=await restarted.activate(activation(i,old.revision,{intent:'renew'}),inv());assert.equal(renewed.generation,old.generation);
   return {generationPreserved:true,independentProcessObserved:true};
  });
  await run('unchanged renewal does not extend previous key overlap and second rotation replaces older key',async()=>{
   let before=await lifecycle.observe(i,inv());await lifecycle.activate(activation(i,before.revision,{intent:'renew',secret:secret(8)}),inv());
   const old=(await admin.query('SELECT previous_secret,previous_until FROM public.emseepea_event_keys WHERE subscription_id=$1',[i.id])).rows[0];assert.equal(old.previous_secret,secret(7));
   before=await lifecycle.observe(i,inv());await lifecycle.activate(activation(i,before.revision,{intent:'renew',secret:secret(8)}),inv());
   const same=(await admin.query('SELECT previous_until FROM public.emseepea_event_keys WHERE subscription_id=$1',[i.id])).rows[0];assert.equal(same.previous_until.getTime(),old.previous_until.getTime());
   before=await lifecycle.observe(i,inv());await lifecycle.activate(activation(i,before.revision,{intent:'renew',secret:secret(9)}),inv());
   const rotated=(await admin.query('SELECT previous_secret,previous_until FROM public.emseepea_event_keys WHERE subscription_id=$1',[i.id])).rows[0];assert.equal(rotated.previous_secret,secret(8));assert.ok(rotated.previous_until.getTime()<=Date.now()+300000);
   return {onlyImmediatePriorKey:true,unchangedOverlapNotExtended:true};
  });
  await run('expired active generation cannot renew and is deactivated before new generation',async()=>{
   const before=await lifecycle.observe(i,inv());await admin.query("UPDATE public.emseepea_event_capture_subscriptions SET expires_at=now()-interval '1 second' WHERE subscription_id=$1",[i.id]);
   await reject(lifecycle.activate(activation(i,before.revision,{intent:'renew'}),inv()),'SUBSCRIPTION_CHANGED');
   const after=await lifecycle.activate(activation(i,before.revision),inv());assert.notEqual(after.generation,before.generation);
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM public.emseepea_event_capture_subscriptions WHERE subscription_id=$1 AND active',[i.id])).rows[0].n,1);
   return {expiredRenewRejected:true,newGeneration:true};
  });
  await run('unsubscribe erases credentials and callback URL while preserving completed dedup records',async()=>{
   const api=createPostgresEventCapture({namespace:'synthetic',sourceKind:'reply',definitions:[definition]}),c=await captureRole.connect();
   try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');const handle=await api.bindTransaction(c,inv());await api.captureInTransaction(handle,{sourceEventId:'reply:2:version:1',sourceVersion:'1',eventName:i.name,ownerKey:i.ownerKey,occurredAt:new Date().toISOString(),data:{threadId:'thread:1',messageId:'message:2'}},inv());await c.query('COMMIT');}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
   await admin.query("UPDATE public.emseepea_event_intents SET state='completed' WHERE subscription_id=$1 AND source_id='reply:1:version:1'",[i.id]);
   await lifecycle.revoke(i,inv());
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM public.emseepea_event_keys WHERE subscription_id=$1',[i.id])).rows[0].n,0);
   assert.equal((await admin.query('SELECT url FROM public.emseepea_event_heads WHERE subscription_id=$1',[i.id])).rows[0].url,null);
   assert.equal((await admin.query("SELECT count(*)::int AS n FROM public.emseepea_event_intents WHERE subscription_id=$1 AND state='completed'",[i.id])).rows[0].n,1);
   assert.equal((await admin.query("SELECT count(*)::int AS n FROM public.emseepea_event_intents WHERE subscription_id=$1 AND state='revoked'",[i.id])).rows[0].n,1);
   return {credentialsRemoved:true,callbackRemoved:true,completedDedupRetained:true,pendingRevoked:true};
  });
  await run('two independent processes race exact revision with one durable winner',async()=>{
   const v=identity('race'),initial=await lifecycle.observe(v,inv()),request=activation(v,initial.revision);
   const execute=promisify(execFile),args=['--experimental-test-module-mocks',import.meta.filename,project,textPort,'--race',JSON.stringify(request)];
   const joined=await Promise.allSettled([execute(process.execPath,args,{env:{PATH:process.env.PATH},timeout:6000,maxBuffer:8192}),execute(process.execPath,args,{env:{PATH:process.env.PATH},timeout:6000,maxBuffer:8192})]);
   assert.ok(joined.every(result=>result.status==='fulfilled'));
   const outcomes=joined.map(result=>JSON.parse(result.value.stdout));assert.deepEqual(outcomes.map(v=>v.status).sort(),['CONFLICT','WIN']);
   const durable=await lifecycle.observe(v,inv());assert.equal(durable.generation,outcomes.find(v=>v.status==='WIN').generation);
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM public.emseepea_event_capture_subscriptions WHERE subscription_id=$1',[v.id])).rows[0].n,1);
   return {independentProcesses:2,oneWinner:true,durableWinnerMatched:true,operationOverlapProven:false};
  });
  await run('head corruption cannot be promoted into an active subscription',async()=>{
   const v=identity('corrupt');await lifecycle.revoke(v,inv());await admin.query('UPDATE public.emseepea_event_heads SET url=$2 WHERE subscription_id=$1',[v.id,v.url]);
   const revision=(await admin.query('SELECT revision FROM public.emseepea_event_heads WHERE subscription_id=$1',[v.id])).rows[0].revision;
   await reject(lifecycle.activate(activation(v,revision),inv()),'UNAVAILABLE');
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM public.emseepea_event_capture_subscriptions WHERE subscription_id=$1',[v.id])).rows[0].n,0);
   await admin.query('UPDATE public.emseepea_event_heads SET url=NULL WHERE subscription_id=$1',[v.id]);return {noPromotion:true};
  });
  await run('wrong owner cannot select an existing head by supplied identity',async()=>{
   await reject(lifecycle.revoke({...i,ownerKey:'wrong-owner'},inv()),'INVALID_INPUT');return {canonicalIdentityEnforced:true};
  });
  await run('schema drift rejects without changing the drifted column',async()=>{
   const c=await migration.connect();try{await c.query('ALTER TABLE public.emseepea_event_heads ADD COLUMN drift pg_catalog.int4');}finally{c.release();}
   const m=createPostgresEventLifecycleMigrator(migration);migrators.push(m);await reject(m.migrate(inv()),'INCOMPATIBLE_SCHEMA');
   assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_catalog.pg_attribute WHERE attrelid='public.emseepea_event_heads'::pg_catalog.regclass AND attname='drift' AND NOT attisdropped")).rows[0].n,1);
   const c2=await migration.connect();try{await c2.query('ALTER TABLE public.emseepea_event_heads DROP COLUMN drift');}finally{c2.release();}
   return {driftRejectedWithoutRepair:true};
  });
  await run('held head lock fails finitely and explicit fresh invocation succeeds',async()=>{
   const v=identity('race'),before=await lifecycle.observe(v,inv()),holder=await admin.connect();
   let observedCode;
   const inspected={async connect(){const c=await writer.connect();return {async query(sql,values){try{return await c.query(sql,values);}catch(error){observedCode=error.code;throw error;}},release:error=>c.release(error)};}};
   const blocked=make(reader,inspected);
   try{await holder.query('BEGIN');await holder.query('SELECT revision FROM public.emseepea_event_heads WHERE namespace=$1 AND subscription_id=$2 FOR UPDATE',['synthetic',v.id]);
    await reject(blocked.activate(activation(v,before.revision,{intent:'renew'}),inv()),'UNAVAILABLE');assert.equal(observedCode,'55P03');
   }finally{await holder.query('ROLLBACK');holder.release();}
   const again=await lifecycle.activate(activation(v,before.revision,{intent:'renew'}),inv());assert.equal(again.generation,before.generation);
   return {initialSQLState:'55P03',explicitFreshInvocation:true,hiddenRetry:false};
  });
  await run('server statement timeout terminates owned synthetic work and leaves no transaction',async()=>{
   const owned=createOwnedEventOperations();let observedCode;
   const inspected={async connect(){const c=await writer.connect();return {async query(sql,values){try{return await c.query(sql,values);}catch(error){observedCode=error.code;throw error;}},release:error=>c.release(error)};}};
   await reject(owned.run(inspected,inv(),async run=>{await run('SELECT pg_catalog.pg_sleep(2)');}),'UNAVAILABLE');
   assert.equal(observedCode,'57014');assert.equal(await owned.settle(inv()),true);
   const states=(await admin.query("SELECT state FROM pg_catalog.pg_stat_activity WHERE application_name='emseepea_lifecycle_fixture' AND pid<>pg_backend_pid()")).rows;
   assert.ok(states.every(row=>row.state==='idle'));return {serverSQLState:'57014',independentNoOpenTransaction:true,cancellationNotInferred:true};
  });
  await run('partial lifecycle schema rejects without recreating the missing table',async()=>{
   const c=await migration.connect();try{await c.query('ALTER TABLE public.emseepea_event_keys RENAME TO fixture_hidden_keys');}finally{c.release();}
   const m=createPostgresEventLifecycleMigrator(migration);migrators.push(m);await reject(m.migrate(inv()),'INCOMPATIBLE_SCHEMA');
   assert.equal((await admin.query("SELECT pg_catalog.to_regclass('public.emseepea_event_keys') AS relation")).rows[0].relation,null);
   const c2=await migration.connect();try{await c2.query('ALTER TABLE public.fixture_hidden_keys RENAME TO emseepea_event_keys');}finally{c2.release();}
   return {partialRejected:true,noRecreation:true};
  });
  await run('populated capture-only schema is rejected rather than promoted with fabricated verification',async()=>{
   const before=(await admin.query('SELECT count(*)::int AS n FROM public.emseepea_event_capture_subscriptions')).rows[0].n;assert.ok(before>0);
   const c=await migration.connect();try{await c.query('DROP TABLE public.emseepea_event_keys,public.emseepea_event_heads,public.emseepea_event_lifecycle_migrations');}finally{c.release();}
   const m=createPostgresEventLifecycleMigrator(migration);migrators.push(m);await reject(m.migrate(inv()),'INCOMPATIBLE_SCHEMA');
   assert.equal((await admin.query("SELECT pg_catalog.to_regclass('public.emseepea_event_heads') AS relation")).rows[0].relation,null);
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM public.emseepea_event_capture_subscriptions')).rows[0].n,before);
   return {populatedRowsRetained:true,noFabricatedVerification:true};
  });
  report.challenges=challenges;
  report.status=report.cases.every(c=>c.status==='PASS')?'PASS_UNCOMMITTED_LIFECYCLE_ONLY':'FAIL_UNCOMMITTED_LIFECYCLE_ONLY';
 } catch(error){report.status='FAIL_UNCOMMITTED_LIFECYCLE_ONLY';report.failureCategory=/^[A-Z0-9_]{1,60}$/.test(error?.code??'')?error.code:'FIXTURE_OR_MIGRATION_PREREQUISITE_FAILED';}
 finally {
  let incomplete=false;
  if(server)try{await server.close();}catch{incomplete=true;}
  for(const owner of [...lifecycles,...migrators])try{if(!await owner.settle(inv(1000)))incomplete=true;}catch{incomplete=true;}
  for(const p of pools){let timer;try{await Promise.race([p.end(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('CLEANUP_DEADLINE')),2000);})]);}catch{incomplete=true;}finally{clearTimeout(timer);}}
  report.connectionsClosed=!incomplete;report.passed=report.cases.filter(c=>c.status==='PASS').length;report.failed=report.cases.filter(c=>c.status==='FAIL').length;report.unrun=report.plannedCases-report.cases.length;
  if(incomplete)report.status='FAIL_UNCOMMITTED_LIFECYCLE_ONLY';else clearTimeout(hard);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');process.exitCode=report.status==='PASS_UNCOMMITTED_LIFECYCLE_ONLY'?0:1;
  if(incomplete)process.exit(1);
 }
}
