import assert from 'node:assert/strict';
import test from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const execute=promisify(execFile),file=fileURLToPath(new URL('./events-google-sdk-logging-child.mjs',import.meta.url));
for(const mode of ['safe','enabled','cached','prior-auth','after','debug-auth'])test(`official SDK logging guard rejects unsafe state without ADC: ${mode}`,async()=>{
 const env={PATH:process.env.PATH};
 if(mode==='enabled'||mode==='prior-auth')env.GOOGLE_SDK_NODE_LOGGING='*';
 if(mode==='debug-auth')env.DEBUG_AUTH='1';
 const result=await execute(process.execPath,[file,mode],{env,timeout:10000,maxBuffer:4096});
 const report=JSON.parse(result.stdout);assert.equal(report.credentialCalls,0);assert.equal(report.fetchCalls,0);assert.equal(result.stderr,'');
});
