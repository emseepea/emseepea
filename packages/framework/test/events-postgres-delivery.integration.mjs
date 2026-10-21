// Uses an owned synthetic PostgreSQL 17.11 fixture. It does not call a real
// callback, provider, or native client.
// env -i PATH="$PATH" node FILE PROJECT_ROOT PORT
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {isAbsolute,join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
import {createPostgresEventCapture} from '../dist/events-postgres.js';
import {createPostgresEventCaptureMigrator} from '../dist/events-postgres-migrations.js';
import {createPostgresEventLifecycle} from '../dist/events-postgres-lifecycle.js';
import {createPostgresEventLifecycleMigrator} from '../dist/events-postgres-lifecycle-migrations.js';
import {createPostgresEventDeliveryMigrator,createPostgresEventDeliveryRuntime} from '../dist/events-postgres-delivery.js';
import {createDeliverySessionOwner} from '../dist/events-postgres-delivery-owned.js';
import {createExternalMcpEventRuntime} from '../dist/events-external.js';
import {mcpEventSubscriptionIdentity} from '../dist/events.js';
import {signWebhook} from '../dist/events-webhook.js';
const [project,textPort,mode,requestedId]=process.argv.slice(2),port=Number(textPort);
if(!isAbsolute(project??'')||!Number.isInteger(port)||port<1024||port>65535)process.exit(2);
const require=createRequire(join(project,'package.json')),{Pool}=require('pg');assert.equal(require('pg/package.json').version,'8.23.0');
const pools=[],owners=[],clients=new Set();
const hard=setTimeout(()=>{process.stderr.write('WHOLE_PROCESS_DEADLINE\n');process.exit(1);},90000);
const config=(user,database='postgres')=>({host:'127.0.0.1',port,database,user,password:'synthetic-fixture-not-a-secret',ssl:false,
 application_name:'emseepea_delivery_fixture',connectionTimeoutMillis:500,query_timeout:1000,statement_timeout:750,lock_timeout:250,idle_in_transaction_session_timeout:1500,max:3,idleTimeoutMillis:1000,pipeline:false});
const pool=(user,database='postgres')=>{const p=new Pool(config(user,database));pools.push(p);return p;};
const inv=(ms=25000)=>({signal:new AbortController().signal,deadlineMs:Date.now()+ms});
const definition={name:'synthetic.reply',description:'Synthetic reply reference.',inputSchema:z.strictObject({threadId:z.string()}),payloadSchema:z.strictObject({threadId:z.string(),messageId:z.string()}),matches:(args,data)=>args.threadId===data.threadId};
const secret=byte=>`whsec_${Buffer.alloc(32,byte).toString('base64')}`;
function worker(p,authorize=()=>true,send=async()=>({status:200,body:Buffer.alloc(0)})) {
 const value=createPostgresEventDeliveryRuntime({namespace:'synthetic',pool:p,definitions:[definition],authorize},send);owners.push(value);return value;
}
if(mode==='--once') {
 let sends=0;const p=pool('e174_worker'),w=worker(p,()=>true,async()=>{sends++;return {status:200,body:Buffer.alloc(0)};});
 try{const outcome=await w.deliver(requestedId,inv());process.stdout.write(JSON.stringify({outcome,sends})+'\n');}
 finally {let incomplete=false;for(const owner of owners)if(!await owner.settle(inv(1000)))incomplete=true;for(const p of pools)await p.end();clearTimeout(hard);if(incomplete)process.exitCode=1;}
} else {
 const report={scope:'DORMANT_POSTGRES_DELIVERY_WORKER',node:process.version,platform:`${process.platform}/${process.arch}`,pgVersion:'8.23.0',plannedCases:19,cases:[]};
 let admin,migration,observe,mutate,capturePool,workerPool,lifecycle,native;
 const reject=(promise,code)=>assert.rejects(promise,error=>error?.code===code);
 const kWhere='namespace=$1 AND source_kind=$2 AND source_id=$3 AND subscription_id=$4 AND generation=$5';
 const keyValues=v=>[v.namespace,v.source_kind,v.source_id,v.subscription_id,v.generation];
 async function run(name,fn){const started=performance.now();try{const facts=await fn();report.cases.push({name,status:'PASS',...facts,elapsedMs:Math.round(performance.now()-started)});}catch(error){report.cases.push({name,status:'FAIL',category:/^[A-Z0-9_]{1,60}$/.test(error?.code??'')?error.code:'ASSERTION_OR_FIXTURE_FAILED',elapsedMs:Math.round(performance.now()-started)});}}
 async function migrationFailure(name,role,database,prepare,wanted){
  await run(name,async()=>{
   const adminDatabase=pool('postgres',database),rolePool=pool(role,database);
   await prepare(adminDatabase,rolePool);
   const migrator=createPostgresEventDeliveryMigrator(rolePool);owners.push(migrator);
   let failure;try{await migrator.migrate(inv(10000));}catch(error){failure=error;}
   assert.ok(failure);assert.equal(failure.code,wanted.code);assert.equal(failure.phase,wanted.phase);
   assert.equal(failure.captureCommitted,wanted.captureCommitted);assert.equal(failure.lifecycleCommitted,wanted.lifecycleCommitted);
   return {phase:failure.phase,captureCommitted:failure.captureCommitted,lifecycleCommitted:failure.lifecycleCommitted};
  });
 }
 async function prepare(thread){
  const args={threadId:thread},url='https://callback.example/events',identity={ownerKey:'owner:1',name:definition.name,arguments:args,url};identity.id=mcpEventSubscriptionIdentity(identity.ownerKey,identity.name,args,url);
  await native.subscribe('owner:1',{name:definition.name,arguments:args,ttlMs:60000,delivery:{mode:'webhook',url,secret:secret(7)}});
  const api=createPostgresEventCapture({namespace:'synthetic',sourceKind:'reply',definitions:[definition]}),c=await capturePool.connect();clients.add(c);
  const sourceId=`${thread}:reply:1`;
  try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');const tx=await api.bindTransaction(c,inv(5000));const captured=await api.captureInTransaction(tx,{sourceEventId:sourceId,sourceVersion:'1',eventName:definition.name,ownerKey:'owner:1',occurredAt:'2026-10-16T00:00:00.000Z',data:{threadId:thread,messageId:`${thread}:message:1`}},inv(5000));assert.equal(captured.deliveryCount,1);await c.query('COMMIT');}
  catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();clients.delete(c);}
  const row=(await admin.query('SELECT * FROM public.emseepea_event_intents WHERE namespace=$1 AND source_kind=$2 AND source_id=$3',['synthetic','reply',sourceId])).rows[0];return {identity,row,id:row.delivery_id};
 }
 async function state(value){return (await admin.query(`SELECT reservations,lease_id,terminal,EXTRACT(epoch FROM due_at)*1000 AS due FROM public.emseepea_event_delivery_state WHERE ${kWhere}`,keyValues(value.row))).rows[0];}
 const faultPool=(number)=>{let commits=0;return {async connect(){const client=await workerPool.connect();return {async query(sql,values){const result=await client.query(sql,values);if(sql==='COMMIT'&&++commits===number)throw new Error('SIMULATED_LOST_COMMIT_ACK');return result;},release:error=>client.release(error)};}};};
 try{
  admin=pool('postgres');assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num,'170011');report.serverVersionNum='170011';
  for(const role of ['e174_capture_failure','e174_lifecycle_failure','e174_delivery_failure','e174_worker_migrate','e174_worker_observe','e174_worker_mutate','e174_worker_capture','e174_worker'])await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD 'synthetic-fixture-not-a-secret'`);
  for(const database of ['e174_capture_failure','e174_lifecycle_failure','e174_delivery_failure'])await admin.query(`CREATE DATABASE ${database}`);
  await migrationFailure('capture migration failure reports no committed prerequisite phase','e174_capture_failure','e174_capture_failure',async()=>{},
   {code:'UNAVAILABLE',phase:'capture',captureCommitted:false,lifecycleCommitted:false});
  await migrationFailure('lifecycle migration failure reports committed capture phase','e174_lifecycle_failure','e174_lifecycle_failure',async(adminDatabase,rolePool)=>{
   await adminDatabase.query('GRANT USAGE,CREATE ON SCHEMA public TO e174_lifecycle_failure');
   const capture=createPostgresEventCaptureMigrator(rolePool);owners.push(capture);await capture.migrate(inv(10000));
   await adminDatabase.query("INSERT INTO public.emseepea_event_capture_subscriptions(namespace,subscription_id,generation,owner_key,event_name,arguments,active,expires_at) VALUES('synthetic','subscription:partial','generation:1','owner:1','synthetic.reply','{}',true,now()+interval '1 hour')");
  },{code:'INCOMPATIBLE_SCHEMA',phase:'lifecycle',captureCommitted:true,lifecycleCommitted:false});
  await migrationFailure('delivery migration failure reports both committed prerequisite phases','e174_delivery_failure','e174_delivery_failure',async(adminDatabase,rolePool)=>{
   await adminDatabase.query('GRANT USAGE,CREATE ON SCHEMA public TO e174_delivery_failure');
   const lifecyclePrerequisite=createPostgresEventLifecycleMigrator(rolePool);owners.push(lifecyclePrerequisite);await lifecyclePrerequisite.migrate(inv(10000));
   await adminDatabase.query('CREATE TABLE public.emseepea_event_delivery_state(drift pg_catalog.int4)');
  },{code:'INCOMPATIBLE_SCHEMA',phase:'delivery',captureCommitted:true,lifecycleCommitted:true});
  await admin.query('GRANT USAGE,CREATE ON SCHEMA public TO e174_worker_migrate');
  await admin.query('GRANT USAGE ON SCHEMA public TO e174_worker_observe,e174_worker_mutate,e174_worker_capture,e174_worker');
  migration=pool('e174_worker_migrate');observe=pool('e174_worker_observe');mutate=pool('e174_worker_mutate');capturePool=pool('e174_worker_capture');workerPool=pool('e174_worker');
  await run('explicit worker migration fresh and exact repeat with unchanged prerequisite markers',async()=>{
   const migrator=createPostgresEventDeliveryMigrator(migration);owners.push(migrator);await migrator.migrate(inv(10000));await migrator.migrate(inv(10000));
   assert.deepEqual((await admin.query('SELECT version,revision FROM public.emseepea_event_delivery_migrations')).rows,[{version:1,revision:'delivery-v1'}]);
   assert.equal((await admin.query('SELECT revision FROM public.emseepea_event_capture_migrations')).rows[0].revision,'capture-v1');return {repeatSafe:true,captureMarkerUnchanged:true};
  });
  if(report.cases.at(-1)?.status!=='PASS')throw new Error('MIGRATION_PREREQUISITE_FAILED');
  await admin.query('GRANT SELECT ON public.emseepea_event_heads,public.emseepea_event_capture_subscriptions TO e174_worker_observe');
  await admin.query('GRANT SELECT,INSERT,UPDATE ON public.emseepea_event_heads,public.emseepea_event_keys,public.emseepea_event_capture_subscriptions TO e174_worker_mutate');
  await admin.query('GRANT DELETE ON public.emseepea_event_keys TO e174_worker_mutate');
  await admin.query('GRANT SELECT(namespace,subscription_id,state),UPDATE(state) ON public.emseepea_event_intents TO e174_worker_mutate');
  await admin.query('GRANT SELECT ON public.emseepea_event_capture_subscriptions,public.emseepea_event_sources,public.emseepea_event_intents TO e174_worker_capture');
  await admin.query('GRANT INSERT ON public.emseepea_event_sources,public.emseepea_event_intents TO e174_worker_capture');
  await admin.query('GRANT SELECT ON public.emseepea_event_heads,public.emseepea_event_capture_subscriptions,public.emseepea_event_sources,public.emseepea_event_intents,public.emseepea_event_keys,public.emseepea_event_delivery_state,public.emseepea_event_delivery_attempts TO e174_worker');
  await admin.query('GRANT UPDATE(revision) ON public.emseepea_event_heads TO e174_worker');
  await admin.query('GRANT UPDATE(state) ON public.emseepea_event_intents TO e174_worker');
  await admin.query('GRANT INSERT,UPDATE ON public.emseepea_event_delivery_state TO e174_worker');
  await admin.query('GRANT INSERT,UPDATE(outcome,status) ON public.emseepea_event_delivery_attempts TO e174_worker');
  lifecycle=createPostgresEventLifecycle({namespace:'synthetic',observationPool:observe,mutationPool:mutate});owners.push(lifecycle);
  native=createExternalMcpEventRuntime({mode:'external',lifecycle,definitions:[definition],ownerKey:()=> 'owner:1',authorize:()=>true,health:()=>true},async(_url,body)=>({status:200,body:Buffer.from(JSON.stringify({challenge:JSON.parse(body).challenge}))}));owners.push(native);
  await run('worker role has narrow locking privilege but cannot mutate callback identity source or keys',async()=>{
   await reject(workerPool.query("UPDATE public.emseepea_event_heads SET url='https://wrong.example/events'"),'42501');await reject(workerPool.query('DELETE FROM public.emseepea_event_sources'),'42501');await reject(workerPool.query("UPDATE public.emseepea_event_keys SET secret='bad'"),'42501');
   for(const p of [observe,capturePool])await reject(p.query('SELECT secret FROM public.emseepea_event_keys'),'42501');return {narrowRoles:true,observationSigningReadDenied:true};
  });
  await run('one connection delivers frozen captured event and retains an accepted dedup receipt',async()=>{
   const v=await prepare('accepted');let acquired=0;const inspected={async connect(){acquired++;return workerPool.connect();}},sent=[];
   const w=worker(inspected,()=>true,async(_url,bytes,headers)=>{sent.push({body:bytes.toString(),headers});return {status:200,body:Buffer.alloc(0)};});
   assert.deepEqual(await w.deliver(v.id,inv()),{outcome:'terminal',reason:'callback_accepted'});assert.equal(acquired,1);assert.equal(sent.length,1);const body=JSON.parse(sent[0].body);assert.equal(body.eventId,v.row.event_id);assert.equal(sent[0].headers['webhook-id'],v.row.event_id);assert.notEqual(v.id,v.row.event_id);
   await lifecycle.revoke(v.identity,inv(5000));assert.deepEqual(await w.deliver(v.id,inv()),{outcome:'terminal',reason:'callback_accepted'});assert.equal(sent.length,1);
   assert.equal((await state(v)).terminal,'accepted');return {singleAcquisition:true,stableAuthoritativeEventId:true,acceptedReceiptRetained:true,checkedTransportMocked:true};
  });
  await run('four known HTTP failures consume exactly four reservations with durable backoff and no fifth send',async()=>{
   const v=await prepare('four'),sent=[];const w=worker(workerPool,()=>true,async(_url,bytes)=>{sent.push(bytes.toString());return {status:503,body:Buffer.alloc(0)};});
   for(let n=1;n<=4;n++){const result=await w.deliver(v.id,inv());assert.equal((await state(v)).reservations,n);if(n<4){assert.equal(result.reason,'callback_failed');const left=Number((await state(v)).due)-Date.now();assert.ok(Math.abs(left-[1000,5000,25000][n-1])<2000);await admin.query(`UPDATE public.emseepea_event_delivery_state SET due_at=clock_timestamp()-interval '1 second' WHERE ${kWhere}`,keyValues(v.row));}else assert.equal(result.reason,'attempts_exhausted');}
   assert.equal((await w.deliver(v.id,inv())).reason,'attempts_exhausted');assert.equal(sent.length,4);assert.ok(sent.every(body=>body===sent[0]));
   assert.equal((await admin.query(`SELECT count(*)::int AS n FROM public.emseepea_event_delivery_attempts WHERE ${kWhere}`,keyValues(v.row))).rows[0].n,4);return {reservations:4,callbacks:4,stableBody:true,noFifth:true};
  });
  await run('live fourth callback owner survives concurrent recovery in another process',async()=>{
   const v=await prepare('fourth-live');await admin.query(`INSERT INTO public.emseepea_event_delivery_state(namespace,source_kind,source_id,subscription_id,generation,reservations) VALUES($1,$2,$3,$4,$5,3)`,keyValues(v.row));
   for(let n=1;n<=3;n++)await admin.query(`INSERT INTO public.emseepea_event_delivery_attempts(namespace,source_kind,source_id,subscription_id,generation,attempt,reservation_id,lease_id,reserved_at,outcome,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()-interval '1 minute','failed',503)`,[...keyValues(v.row),n,randomUUID(),randomUUID()]);
   let sends=0,childResult;const w=worker(workerPool,()=>true,async()=>{sends++;const result=await promisify(execFile)(process.execPath,[import.meta.filename,project,textPort,'--once',v.id],{env:{PATH:process.env.PATH},timeout:6000,maxBuffer:8192});childResult=JSON.parse(result.stdout);assert.equal(childResult.outcome.reason,'leased');assert.equal(childResult.sends,0);return {status:200,body:Buffer.alloc(0)};});
   assert.equal((await w.deliver(v.id,inv())).reason,'callback_accepted');assert.equal(sends,1);assert.equal((await state(v)).reservations,4);assert.equal(childResult.sends,0);return {overlapAtAdmittedCallback:true,independentRecoveryProcess:true,fourthOwnerSentOnce:true};
  });
  await run('policy denial uses lease-fenced suppression without a reservation',async()=>{
   const v=await prepare('denied');let sends=0;const w=worker(workerPool,()=>false,async()=>{sends++;return {status:200,body:Buffer.alloc(0)};});
   assert.equal((await w.deliver(v.id,inv())).reason,'suppressed');assert.equal(sends,0);assert.equal((await state(v)).reservations,0);return {noReservation:true,noHTTP:true};
  });
  await run('unsubscribe after claim blocks final reservation and removes callback credentials',async()=>{
   const v=await prepare('revoked-before-reserve');let sends=0;const w=worker(workerPool,async()=>{await lifecycle.revoke(v.identity,inv(5000));return true;},async()=>{sends++;return {status:200,body:Buffer.alloc(0)};});
   assert.equal((await w.deliver(v.id,inv())).reason,'suppressed');assert.equal(sends,0);assert.equal((await state(v)).reservations,0);return {freshRevocationCheck:true,noHTTP:true};
  });
  await run('rotation after claim uses fresh current and prior signatures from reservation',async()=>{
   const v=await prepare('rotate');let sent;const rotated=secret(8);
   const w=worker(workerPool,async()=>{await native.subscribe('owner:1',{name:definition.name,arguments:v.identity.arguments,ttlMs:60000,delivery:{mode:'webhook',url:v.identity.url,secret:rotated}});return true;},async(_url,bytes,headers)=>{sent={bytes,headers};return {status:200,body:Buffer.alloc(0)};});
   assert.equal((await w.deliver(v.id,inv())).reason,'callback_accepted');const timestamp=Number(sent.headers['webhook-timestamp']);assert.equal(sent.headers['webhook-signature'],signWebhook(rotated,v.row.event_id,timestamp,sent.bytes)+' '+signWebhook(secret(7),v.row.event_id,timestamp,sent.bytes));return {freshCurrentKey:true,immediatePriorKey:true};
  });
  await run('revocation during admitted callback cannot be resurrected by stale completion',async()=>{
   const v=await prepare('revoked-during-send');const w=worker(workerPool,()=>true,async()=>{await lifecycle.revoke(v.identity,inv(5000));return {status:200,body:Buffer.alloc(0)};});
   assert.equal((await w.deliver(v.id,inv())).reason,'suppressed');assert.equal((await admin.query('SELECT state FROM public.emseepea_event_intents WHERE delivery_id=$1',[v.id])).rows[0].state,'revoked');assert.equal((await state(v)).reservations,1);return {admittedCallbackMayFinish:true,noResurrection:true};
  });
  for(const [phase,number] of [['claim',1],['reservation',2],['completion',3]])await run(`simulated lost ${phase} COMMIT acknowledgment preserves unknown and correct send boundary`,async()=>{
   const v=await prepare(`unknown-${phase}`);let sends=0;const w=worker(faultPool(number),()=>true,async()=>{sends++;return {status:200,body:Buffer.alloc(0)};});
   assert.equal((await w.deliver(v.id,inv())).reason,'unknown_outcome');assert.equal(sends,phase==='completion'?1:0);
   const durable=await state(v);assert.equal(durable.reservations,phase==='claim'?0:1);if(phase==='completion')assert.equal(durable.terminal,'accepted');
   return {phase,simulatedAcknowledgmentLoss:true,actualWireFault:false,sends,reservations:durable.reservations};
  });
  await run('ambiguous send consumes its reservation and a later lease owner uses a new attempt',async()=>{
   const v=await prepare('unknown-send');let sends=0;const w=worker(workerPool,()=>true,async()=>{sends++;if(sends===1)throw new Error('SYNTHETIC_AMBIGUOUS_SEND');return {status:200,body:Buffer.alloc(0)};});
   assert.equal((await w.deliver(v.id,inv())).reason,'unknown_outcome');assert.equal((await state(v)).reservations,1);
   await admin.query(`UPDATE public.emseepea_event_delivery_state SET lease_until=clock_timestamp()-interval '1 second' WHERE ${kWhere}`,keyValues(v.row));
   assert.equal((await w.deliver(v.id,inv())).reason,'callback_accepted');assert.equal((await state(v)).reservations,2);assert.equal(sends,2);return {firstUnknownRetained:true,newReservationNotReuse:true,syntheticLeaseExpiry:true};
  });
  await run('composite namespace binding and restrictive FK prevent silent dedup deletion',async()=>{
   const v=await prepare('retained');const w=worker(workerPool);await w.deliver(v.id,inv());
   const wrong=[...keyValues(v.row)];wrong[0]='wrong-namespace';await reject(admin.query('INSERT INTO public.emseepea_event_delivery_state(namespace,source_kind,source_id,subscription_id,generation) VALUES($1,$2,$3,$4,$5)',wrong),'23503');
   await reject(admin.query('DELETE FROM public.emseepea_event_sources WHERE namespace=$1 AND source_kind=$2 AND source_id=$3',keyValues(v.row).slice(0,3)),'23503');assert.equal((await state(v)).terminal,'accepted');return {namespaceFKEnforced:true,physicalDeletionBlocked:true,ordinarySourceErasureNotImplemented:true};
  });
  await run('actual cumulative SQL group timeout leaves no open transaction',async()=>{
   const owner=createDeliverySessionOwner(workerPool);owners.push(owner);
   await assert.rejects(owner.run(inv(),session=>session.transaction(async run=>{await run('SELECT pg_catalog.pg_sleep(0.6)');await run('SELECT pg_catalog.pg_sleep(0.6)');})),error=>['UNAVAILABLE','OUTCOME_UNKNOWN'].includes(error.code));
   assert.equal(await owner.settle(inv(1000)),true);
   const activity=(await admin.query("SELECT state FROM pg_catalog.pg_stat_activity WHERE application_name='emseepea_delivery_fixture' AND pid<>pg_backend_pid()")).rows;assert.ok(activity.every(row=>row.state==='idle'));return {groupNotResetPerQuery:true,independentNoOpenTransaction:true,cancellationNotInferred:true};
  });
  await run('worker schema drift is rejected without deleting the drifted column',async()=>{
   const c=await migration.connect();try{await c.query('ALTER TABLE public.emseepea_event_delivery_state ADD COLUMN drift pg_catalog.int4');}finally{c.release();}
   const m=createPostgresEventDeliveryMigrator(migration);owners.push(m);await reject(m.migrate(inv(10000)),'INCOMPATIBLE_SCHEMA');assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_catalog.pg_attribute WHERE attrelid='public.emseepea_event_delivery_state'::pg_catalog.regclass AND attname='drift' AND NOT attisdropped")).rows[0].n,1);return {driftRetained:true};
  });
  report.status=report.cases.every(c=>c.status==='PASS')?'PASS_DORMANT_POSTGRES_DELIVERY_WORKER':'FAIL_DORMANT_POSTGRES_DELIVERY_WORKER';
 }catch(error){report.status='FAIL_DORMANT_POSTGRES_DELIVERY_WORKER';report.failureCategory=/^[A-Z0-9_]{1,60}$/.test(error?.code??'')?error.code:'FIXTURE_OR_MIGRATION_PREREQUISITE_FAILED';}
 finally{
  let incomplete=false;for(const c of clients)try{c.release(new Error('OWNED_FIXTURE_CLEANUP'));}catch{incomplete=true;}
  for(const owner of owners)try{if(!await owner.settle(inv(1000)))incomplete=true;}catch{incomplete=true;}
  for(const p of pools){let timer;try{await Promise.race([p.end(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('CLEANUP_DEADLINE')),2000);})]);}catch{incomplete=true;}finally{clearTimeout(timer);}}
  report.connectionsClosed=!incomplete;report.passed=report.cases.filter(c=>c.status==='PASS').length;report.failed=report.cases.filter(c=>c.status==='FAIL').length;report.unrun=report.plannedCases-report.cases.length;
  if(incomplete)report.status='FAIL_DORMANT_POSTGRES_DELIVERY_WORKER';else clearTimeout(hard);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');process.exitCode=report.status==='PASS_DORMANT_POSTGRES_DELIVERY_WORKER'?0:1;if(incomplete)process.exit(1);
 }
}
