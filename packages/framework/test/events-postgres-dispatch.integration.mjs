// Synthetic SQL/transport fixture only: provider methods are inert, no HTTP/native/hosted calls.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join,isAbsolute} from 'node:path';
import {performance} from 'node:perf_hooks';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay,setImmediate as tick} from 'node:timers/promises';
import {createPostgresEventDispatchRuntime} from '../dist/events-postgres-dispatch.js';
import {createPostgresEventDispatchMigrator} from '../dist/events-postgres-dispatch-migrations.js';
const [project,textPort,mode,childNamespace,childId]=process.argv.slice(2),port=Number(textPort);
if(!isAbsolute(project??'')||!Number.isInteger(port)||port<1024||port>65535)process.exit(2);
const require=createRequire(join(project,'package.json')),{Pool}=require('pg');assert.equal(require('pg/package.json').version,'8.23.0');
const pools=[],owners=[];const hard=setTimeout(()=>{process.stderr.write('WHOLE_PROCESS_DEADLINE\n');process.exit(1);},90000);
const config=user=>({host:'127.0.0.1',port,database:'postgres',user,password:'synthetic-fixture-not-a-secret',ssl:false,
 application_name:'emseepea_dispatch_fixture',connectionTimeoutMillis:500,query_timeout:1000,statement_timeout:750,lock_timeout:250,idle_in_transaction_session_timeout:1500,max:3,idleTimeoutMillis:1000,pipeline:false});
const pool=user=>{const value=new Pool(config(user));pools.push(value);return value;};
const inv=(ms=25000)=>({signal:new AbortController().signal,deadlineMs:Date.now()+ms});
const fingerprint='a'.repeat(64);
function dispatch(namespace,p,control={}) {
 const calls={queue:0,inspect:0,create:[],acquire:0};
 const tracked={async connect(){calls.acquire++;return p.connect();}};
 const transport={fingerprint:control.fingerprint??fingerprint,async queue(){calls.queue++;return control.queue??'present';},
  async inspect(_task){calls.inspect++;return control.inspect??'matching';},async create(task){calls.create.push(task);return control.createWork?control.createWork(task):control.create??'created';}};
 const value=createPostgresEventDispatchRuntime({namespace,pool:tracked,transport,isPaused:()=>control.paused??false});owners.push(value);return {value,calls,control};
}
const cleanupFailures=[];
async function cleanup(){
 const settled=await Promise.allSettled(owners.map(owner=>Promise.resolve().then(()=>owner.settle(inv(1000)))));
 for(const value of settled)if(value.status!=='fulfilled'||value.value!==true)cleanupFailures.push('OWNER_UNSETTLED');
 const ended=await Promise.allSettled(pools.map(async p=>{let timer;try{
  await Promise.race([p.end(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('POOL_END_DEADLINE')),1000);})]);
 }finally{if(timer)clearTimeout(timer);}}));
 for(const value of ended)if(value.status!=='fulfilled')cleanupFailures.push('POOL_END_INCOMPLETE');
 if(cleanupFailures.length===0)clearTimeout(hard); // Keep the owned hard stop on incomplete closure.
 return cleanupFailures.length===0;
}
if(mode==='--once'){
 const p=pool('e174_dispatch_runtime'),d=dispatch(childNamespace,p,{createWork:async()=>{await delay(150);return 'created';}});
 try{const result=await d.value.dispatch(childId,inv());process.stdout.write(JSON.stringify({result,creates:d.calls.create.length})+'\n');}
 finally{if(!await cleanup())process.exitCode=1;}
}else{
 const report={scope:'UNCOMMITTED_DISPATCH_ONLY_INERT_PROVIDER_SYNTHETIC_SQL_ROWS',node:process.version,platform:`${process.platform}/${process.arch}`,pgVersion:'8.23.0',plannedCases:18,cases:[]};
 let admin,migration,runtime;
 async function run(name,fn){const start=performance.now();try{const facts=await fn();report.cases.push({name,status:'PASS',...facts,elapsedMs:Math.round(performance.now()-start)});}catch(error){report.cases.push({name,status:'FAIL',category:/^[A-Z0-9_]{1,60}$/.test(error?.code??'')?error.code:'ASSERTION_OR_FIXTURE_FAILED',elapsedMs:Math.round(performance.now()-start)});}}
 async function prepare(ns,n=1){
  await admin.query("INSERT INTO public.emseepea_event_heads VALUES($1,'sub:1','owner:1','https://callback.example/events','revision:1','generation:1')",[ns]);
  await admin.query("INSERT INTO public.emseepea_event_capture_subscriptions VALUES($1,'sub:1','generation:1','owner:1','synthetic.reply','{}',true,pg_catalog.clock_timestamp()+interval '1 hour')",[ns]);
  await admin.query(`INSERT INTO public.emseepea_event_sources SELECT $1,'reply','source:'||g::pg_catalog.text,'1','synthetic','event:'||$1||':'||g::pg_catalog.text,
   'owner:1','synthetic.reply',pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp(),1,'{}'::pg_catalog.jsonb FROM pg_catalog.generate_series(1,$2) g`,[ns,n]);
  await admin.query(`INSERT INTO public.emseepea_event_intents SELECT namespace,source_kind,source_id,'sub:1','generation:1','delivery:'||namespace||':'||source_id,event_id,'pending'
   FROM public.emseepea_event_sources WHERE namespace=$1`,[ns]);
  return `delivery:${ns}:source:1`;
 }
 const row=async ns=>(await admin.query('SELECT * FROM public.emseepea_event_dispatch_state WHERE namespace=$1 ORDER BY source_id',[ns])).rows;
 const due=async ns=>admin.query("UPDATE public.emseepea_event_dispatch_state SET due_at=pg_catalog.clock_timestamp()-interval '1 second',lease_id=NULL,lease_until=NULL WHERE namespace=$1",[ns]);
 const invoke=async(d,id)=>{await tick();return d.value.dispatch(id,inv());};
 const faultPool=number=>{let commits=0;return {async connect(){const c=await runtime.connect();return {async query(sql,values){const result=await c.query(sql,values);if(sql==='COMMIT'&&++commits===number)throw new Error('SIMULATED_COMMIT_ACK_LOSS');return result;},release:error=>c.release(error)};}};};
 try{
  admin=pool('postgres');assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num,'170011');report.serverVersionNum='170011';
  await admin.query("CREATE ROLE e174_dispatch_migrate LOGIN PASSWORD 'synthetic-fixture-not-a-secret'");await admin.query("CREATE ROLE e174_dispatch_runtime LOGIN PASSWORD 'synthetic-fixture-not-a-secret'");
  await admin.query('GRANT USAGE,CREATE ON SCHEMA public TO e174_dispatch_migrate');await admin.query('GRANT USAGE ON SCHEMA public TO e174_dispatch_runtime');migration=pool('e174_dispatch_migrate');runtime=pool('e174_dispatch_runtime');
  await run('explicit fresh and repeat dispatch migration preserves prerequisite markers',async()=>{
   const m=createPostgresEventDispatchMigrator(migration);owners.push(m);await m.migrate(inv(15000));await m.migrate(inv(15000));
   assert.deepEqual((await admin.query('SELECT version,revision FROM public.emseepea_event_dispatch_migrations')).rows,[{version:1,revision:'dispatch-v1'}]);
   assert.equal((await admin.query('SELECT revision FROM public.emseepea_event_delivery_migrations')).rows[0].revision,'delivery-v1');return {repeatSafe:true,prerequisiteUnchanged:true};
  });
  if(report.cases[0]?.status!=='PASS')throw new Error('MIGRATION_PREREQUISITE_FAILED');
  await admin.query('GRANT SELECT ON public.emseepea_event_heads,public.emseepea_event_capture_subscriptions,public.emseepea_event_sources,public.emseepea_event_intents,public.emseepea_event_delivery_state TO e174_dispatch_runtime');
  await admin.query('GRANT SELECT,INSERT,UPDATE ON public.emseepea_event_dispatch_state TO e174_dispatch_runtime');
  await run('restricted dispatch role cannot read keys mutate source or perform DDL',async()=>{
   for(const query of ['SELECT * FROM public.emseepea_event_keys',"UPDATE public.emseepea_event_sources SET payload='{}'",'CREATE TABLE public.forbidden_dispatch(id integer)'])await assert.rejects(runtime.query(query),error=>error.code==='42501');return {restrictedRole:true};
  });
  await run('first generation is committed before inert create and SQL connection released',async()=>{
   const id=await prepare('first'),d=dispatch('first',runtime,{createWork:async task=>{const saved=(await row('first'))[0];assert.equal(saved.transport_generation,1);assert.equal(saved.task_id,task.taskId);assert.equal(runtime.totalCount,runtime.idleCount);return 'created';}});
   const r=await invoke(d,id);assert.equal(r.created,1);assert.equal((await row('first'))[0].category,'present');return {generationCommittedBeforeCreate:true,inertProviderOnly:true};
  });
  await run('matching existing task preserves generation and does not create',async()=>{
   const id='delivery:first:source:1';await due('first');const d=dispatch('first',runtime);const r=await invoke(d,id);assert.equal(r.observed,1);assert.equal(d.calls.create.length,0);assert.equal((await row('first'))[0].transport_generation,1);return {generationRetained:true};
  });
  await run('missing exact task plus confirmed queue advances generation',async()=>{
   await due('first');const d=dispatch('first',runtime,{inspect:'missing'}),r=await invoke(d,'delivery:first:source:1');assert.equal(r.created,1);assert.equal(d.calls.queue,2);assert.equal((await row('first'))[0].transport_generation,2);return {confirmedQueue:true,laterGeneration:true};
  });
  await run('existing task configuration conflict does not rotate or overwrite fingerprint',async()=>{
   await due('first');const d=dispatch('first',runtime,{inspect:'conflict'}),r=await invoke(d,'delivery:first:source:1');assert.equal(r.conflicts,1);assert.equal(d.calls.create.length,0);assert.equal((await row('first'))[0].transport_generation,2);return {noReplacement:true};
  });
  await run('ALREADY_EXISTS is unknown and recovers through same generation inspection',async()=>{
   const id=await prepare('exists'),d=dispatch('exists',runtime,{create:'exists'});assert.equal((await invoke(d,id)).unknown,1);const saved=(await row('exists'))[0];assert.equal(saved.category,'unknown');await due('exists');
   const next=dispatch('exists',runtime);assert.equal((await invoke(next,id)).observed,1);assert.equal((await row('exists'))[0].task_id,saved.task_id);return {sameGenerationInspection:true};
  });
  await run('queue unavailable and pause perform no SQL',async()=>{
   const d=dispatch('noqueue',runtime,{queue:'unavailable'});await d.value.reconcile(inv());assert.equal(d.calls.acquire,0);const p=dispatch('paused',runtime,{paused:true});await p.value.reconcile(inv());assert.equal(p.calls.queue,0);assert.equal(p.calls.acquire,0);return {zeroSQL:true};
  });
  await run('250 pending rows seed beyond 100 and persistent early create failures permit later progress',async()=>{
   await prepare('backlog',250);const statements=[];
   const observed={async connect(){const c=await runtime.connect();return {query(sql,values){if(sql.startsWith('INSERT INTO public.emseepea_event_dispatch_state')||sql.startsWith('SELECT d.*'))statements.push({sql,values});return c.query(sql,values);},release:error=>c.release(error)};}};
   const d=dispatch('backlog',observed,{create:'unavailable'});let total=0,iterations=0;const backlogEnd=performance.now()+45000;
   while(iterations<16&&performance.now()<backlogEnd-18000){await tick();const r=await d.value.reconcile(inv(Math.min(25000,backlogEnd-performance.now())));assert.ok(r.selected<=100);total+=r.selected;iterations++;
    if((await row('backlog')).length===250&&new Set(d.calls.create.map(task=>task.deliveryId)).size===250)break;
   }
   const rows=await row('backlog');assert.equal(rows.length,250);const ids=new Set(d.calls.create.map(task=>task.deliveryId));assert.equal(ids.size,250);assert.ok(total>=250);
   for(const prefix of ['INSERT INTO public.emseepea_event_dispatch_state','SELECT d.*']){const statement=statements.find(value=>value.sql.startsWith(prefix));assert.ok(statement);
    const plan=(await runtime.query('EXPLAIN(FORMAT JSON) '+statement.sql,statement.values)).rows;assert.ok(plan.length===1&&plan[0]['QUERY PLAN'][0].Plan);
   }
   return {seeded:250,distinctAttempted:ids.size,iterations,persistentFailures:true,actualSeedAndClaimPlansObserved:true,queryExecutionCostQualified:false,productionScaleQualified:false};
  });
  for(const [phase,number] of [['claim',2],['reservation',3],['completion',4]])await run(`simulated ${phase} COMMIT acknowledgment loss preserves external boundary`,async()=>{
   const ns=`lost-${phase}`,id=await prepare(ns),d=dispatch(ns,faultPool(number));const r=await invoke(d,id);assert.equal(r.status,'retry_pending');assert.equal(d.calls.create.length,phase==='completion'?1:0);
   const saved=(await row(ns))[0];assert.equal(saved.transport_generation,phase==='claim'?0:1);return {phase,simulatedAfterRealCOMMIT:true,actualWireFault:false,creates:d.calls.create.length};
  });
  await run('config fingerprint mismatch never changes stored task authority',async()=>{
   await due('first');const d=dispatch('first',runtime,{fingerprint:'b'.repeat(64)}),r=await invoke(d,'delivery:first:source:1');assert.equal(r.conflicts,1);assert.equal(d.calls.inspect,0);assert.equal((await row('first'))[0].config_hash,fingerprint);return {storedAuthorityPreserved:true};
  });
  await run('live dispatch lease is excluded without repeatedly consuming selection bound',async()=>{
   await admin.query("UPDATE public.emseepea_event_dispatch_state SET due_at=pg_catalog.clock_timestamp()-interval '1 second',lease_id='other',lease_until=pg_catalog.clock_timestamp()+interval '1 minute' WHERE namespace='first'");
   const d=dispatch('first',runtime),r=await invoke(d,'delivery:first:source:1');assert.equal(r.selected,0);assert.equal(d.calls.inspect,0);return {liveLeaseExcluded:true};
  });
  await run('revocation after committed task suppresses new transport without deleting receipts',async()=>{
   await due('first');await admin.query("UPDATE public.emseepea_event_intents SET state='revoked' WHERE namespace='first'");const d=dispatch('first',runtime);await invoke(d,'delivery:first:source:1');assert.equal(d.calls.inspect,0);assert.equal((await row('first'))[0].terminal,true);return {receiptRetained:true,noProviderAdmission:true};
  });
  await run('two independent processes target one delivery with one task creation',async()=>{
   const id=await prepare('process'),command=promisify(execFile),args=[new URL(import.meta.url).pathname,project,String(port),'--once','process',id];
   const results=await Promise.allSettled([command(process.execPath,args,{timeout:10000,maxBuffer:4096,env:{PATH:process.env.PATH}}),command(process.execPath,args,{timeout:10000,maxBuffer:4096,env:{PATH:process.env.PATH}})]);
   for(const result of results)assert.equal(result.status,'fulfilled');const values=results.map(value=>JSON.parse(value.value.stdout));assert.equal(values.reduce((sum,value)=>sum+value.creates,0),1);return {independentProcesses:2,creates:1,operationOverlapProven:false};
  });
  await run('restrictive natural-key foreign key preserves dispatch receipt on physical source deletion',async()=>{
   await assert.rejects(admin.query("DELETE FROM public.emseepea_event_sources WHERE namespace='first'"),error=>error.code==='23503');assert.equal((await row('first')).length,1);return {physicalDeletionBlocked:true,ordinarySourceErasureImplemented:false};
  });
  await run('schema drift rejects without repairing the changed default',async()=>{
   await migration.query('ALTER TABLE public.emseepea_event_dispatch_state ALTER terminal SET DEFAULT true');const m=createPostgresEventDispatchMigrator(migration);owners.push(m);await assert.rejects(m.migrate(inv(15000)),error=>error.code==='INCOMPATIBLE_SCHEMA');
   const saved=(await admin.query(`SELECT pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS value FROM pg_catalog.pg_attrdef d JOIN pg_catalog.pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE d.adrelid='public.emseepea_event_dispatch_state'::pg_catalog.regclass AND a.attname='terminal'`)).rows;
   assert.deepEqual(saved,[{value:'true'}]);return {driftRetained:true};
  });
 }catch{report.failureCategory='FIXTURE_OR_MIGRATION_PREREQUISITE_FAILED';}
 finally{
  report.connectionsClosed=await cleanup();report.cleanupFailures=cleanupFailures;report.passed=report.cases.filter(v=>v.status==='PASS').length;report.failed=report.cases.filter(v=>v.status==='FAIL').length;report.unrun=report.plannedCases-report.cases.length;
  report.status=report.failed||report.unrun||report.failureCategory||!report.connectionsClosed?'FAIL_UNCOMMITTED_DISPATCH_ONLY':'PASS_UNCOMMITTED_DISPATCH_ONLY';
  process.stdout.write(JSON.stringify(report)+'\n');if(report.status.startsWith('FAIL'))process.exitCode=1;
 }
}
