import assert from 'node:assert/strict';
import test,{mock} from 'node:test';
const key=Number(process.versions.node.split('.')[0])>=24?'exports':'namedExports';
let constructors=0,fetches=0;
const placeholder=()=>{};
class GoogleAuth{constructor(){constructors++;}}
class AuthClient{}
AuthClient.log=placeholder;
await mock.module('google-auth-library',{[key]:{GoogleAuth,AuthClient}});
await mock.module('google-logging-utils',{[key]:{placeholder,log:()=>placeholder}});
globalThis.fetch=async()=>{fetches++;throw new Error('FORBIDDEN_IMPORT_FETCH');};
test('importing the private transport is inert',async()=>{
 const module=await import('../dist/events-cloud-tasks-transport.js');
 assert.equal(typeof module.createCloudTasksRestTransportRuntime,'function');
 assert.equal(constructors,0);
 assert.equal(fetches,0);
});
