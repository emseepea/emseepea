// Owned, credential-free subprocess. Public SDK methods are blocked before any product invocation.
import assert from 'node:assert/strict';
import {GoogleAuth} from 'google-auth-library';
import {setBackend,getStructuredBackend} from 'google-logging-utils';
import {createCloudTasksRestTransportRuntime} from '../dist/events-cloud-tasks-transport.js';
const mode=process.argv[2];
const expected={safe:'constructed',enabled:'UNSAFE_SDK_LOGGING',cached:'UNSAFE_SDK_LOGGING','prior-auth':'UNSAFE_SDK_LOGGING',after:'unavailable','debug-auth':'UNSAFE_SDK_LOGGING'};
assert.ok(Object.hasOwn(expected,mode));
let credentialCalls=0,fetchCalls=0;
GoogleAuth.prototype.getClient=async()=>{credentialCalls++;throw new Error('FORBIDDEN_FIXTURE_ADC');};
globalThis.fetch=async()=>{fetchCalls++;throw new Error('FORBIDDEN_FIXTURE_FETCH');};
const configuration={namespace:'synthetic',projectId:'synthetic-test',location:'australia-southeast1',queueId:'feedback',workerURL:'https://worker.example/tasks',audience:'https://worker.example/',serviceAccountEmail:'worker@synthetic-test.iam.gserviceaccount.com',serviceAccountUid:'123456789'};
let transport,outcome='FIXTURE_FAILED';
try{
 if(mode==='cached')setBackend(getStructuredBackend());
 if(mode==='prior-auth')setBackend(null);
 try{
  transport=createCloudTasksRestTransportRuntime(configuration);outcome='constructed';
  if(mode==='after'){setBackend(getStructuredBackend());outcome=await transport.queue({signal:new AbortController().signal,deadlineMs:Date.now()+3000});}
 }catch(error){outcome=error?.code==='UNSAFE_SDK_LOGGING'?error.code:'UNEXPECTED_SETUP_CATEGORY';}
 assert.equal(outcome,expected[mode]);assert.equal(credentialCalls,0);assert.equal(fetchCalls,0);
 if(transport)assert.equal(await transport.settle({signal:new AbortController().signal,deadlineMs:Date.now()+1000}),true);
 process.stdout.write(JSON.stringify({mode,outcome,credentialCalls,fetchCalls,scope:'OFFLINE_PUBLIC_SDK_LOGGING_GUARD_ONLY'})+'\n');
}catch{process.stdout.write(JSON.stringify({mode,outcome:'FIXTURE_ASSERTION_FAILED',credentialCalls,fetchCalls})+'\n');process.exitCode=1;}
