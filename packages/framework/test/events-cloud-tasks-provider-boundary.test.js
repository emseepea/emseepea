import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const here=path=>fileURLToPath(new URL(path,import.meta.url));
test('existing public entry points load without optional Google peers',()=>{
 const result=spawnSync(process.execPath,['--experimental-loader',here('./events-google-forbidden-loader.mjs'),here('./events-google-public-import-child.mjs')],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH}});
 assert.equal(result.error,undefined);
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 assert.equal(result.stdout,'PUBLIC_IMPORTS_GOOGLE_FREE\n');
});
test('private transport import performs no authentication, fetch or task work',()=>{
 const result=spawnSync(process.execPath,['--experimental-test-module-mocks','--test',here('./events-google-import-only-child.mjs')],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH}});
 assert.equal(result.error,undefined);
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});
