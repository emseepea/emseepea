import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPairSync, sign} from 'node:crypto';
import Fastify from 'fastify';
import {OAuth2Client} from 'google-auth-library';
import {z} from 'zod';
import {createGoogleEventDeliveryWorker} from '../dist/events-google-worker.js';
import {createGoogleEventDeliveryWorkerRuntime} from '../dist/events-google-worker-runtime.js';

const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const config={audience:'https://worker.example/tasks',serviceAccountEmail:'worker@synthetic-test.iam.gserviceaccount.com',serviceAccountUid:'123456789'};
const invocation=ms=>({signal:new AbortController().signal,deadlineMs:Date.now()+ms});
function token(changes={},key=keys.privateKey){
 const now=Math.floor(Date.now()/1000);
 const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'synthetic'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({iss:'https://accounts.google.com',aud:config.audience,sub:config.serviceAccountUid,email:config.serviceAccountEmail,email_verified:true,iat:now,exp:now+3600,...changes})).toString('base64url');
 const input=`${header}.${payload}`;
 return `${input}.${sign('RSA-SHA256',Buffer.from(input),key).toString('base64url')}`;
}
function client(){
 const auth=new OAuth2Client();
 auth.certificateCache={synthetic:keys.publicKey.export({type:'spki',format:'pem'})};
 auth.certificateExpiry=new Date(Date.now()+3600000);
 return auth;
}
async function fixture(t,auth=client(),outcome={outcome:'terminal',reason:'callback_accepted'}){
 const calls=[],settlements=[];
 const delivery={async deliver(id,context){calls.push({id,context});return outcome;},async settle(context){settlements.push(context);return true;}};
 const worker=createGoogleEventDeliveryWorkerRuntime(config,delivery,auth);
 const app=Fastify({logger:false});
 let resolveClosed,resolveHandled;
 const closed=new Promise(resolve=>{resolveClosed=resolve;}),handled=new Promise(resolve=>{resolveHandled=resolve;});
 app.post('/tasks',{bodyLimit:1024},async(request,reply)=>{
  reply.raw.once('close',resolveClosed);
  try{await worker.handle(request,reply);}finally{resolveHandled();}
 });
 await app.listen({host:'127.0.0.1',port:0});
 t.after(async()=>{await worker.settle(invocation(5000));await app.close();});
 const url=`http://127.0.0.1:${app.server.address().port}/tasks`;
 const post=(jwt=token(),body={deliveryId:'one'})=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...(jwt?{authorization:`Bearer ${jwt}`}:{})},body:JSON.stringify(body)});
 return {worker,calls,settlements,post,url,closed,handled};
}
test('real HTTP and Google JWT verification admit exactly one delivery ID',async t=>{
 const f=await fixture(t),start=Date.now(),response=await f.post();
 assert.equal(response.status,204);assert.equal(f.calls.length,1);assert.equal(f.calls[0].id,'one');
 assert.ok(f.calls[0].context.deadlineMs>=start&&f.calls[0].context.deadlineMs<=Date.now()+25000);
 assert.equal(f.calls[0].context.signal.aborted,false);
});
for(const [name,changes] of Object.entries({issuer:{iss:'https://attacker.example'},audience:{aud:'https://other.example'},subject:{sub:'987654321'},email:{email:'other@synthetic-test.iam.gserviceaccount.com'},unverified:{email_verified:false},expired:{exp:Math.floor(Date.now()/1000)-600},future:{iat:Math.floor(Date.now()/1000)+600},missingSubject:{sub:undefined}})){
 test(`cryptographic authority rejects ${name} before delivery`,async t=>{
  const f=await fixture(t);assert.equal((await f.post(token(changes))).status,401);assert.equal(f.calls.length,0);
 });
}
test('missing authority and invalid signature never invoke delivery',async t=>{
 const f=await fixture(t),wrong=generateKeyPairSync('rsa',{modulusLength:2048});
 assert.equal((await f.post(null)).status,401);
 assert.equal((await f.post(token({},wrong.privateKey))).status,401);
 assert.equal(f.calls.length,0);
});
for(const body of [{deliveryId:'one',namespace:'another'},{deliveryId:'one',url:'https://attacker.example'},[],null,{}, {deliveryId:''},{deliveryId:'x'.repeat(241)},{deliveryId:'\u0000'}]){
 test(`exact body rejection ${JSON.stringify(body)}`,async t=>{
  const f=await fixture(t);assert.equal((await f.post(token(),body)).status,400);assert.equal(f.calls.length,0);
 });
}
test('pending work requests retry rather than acknowledging success',async t=>{
 const f=await fixture(t,client(),{outcome:'retry_pending',reason:'leased'});
 assert.equal((await f.post()).status,503);assert.equal(f.calls.length,1);
});
test('shutdown rejects new invocations and joins delivery',async t=>{
 const f=await fixture(t);
 assert.equal(await f.worker.settle(invocation(5000)),true);
 assert.equal((await f.post()).status,503);assert.equal(f.calls.length,0);assert.equal(f.settlements.length,1);
});
test('shutdown cannot report settled while raw authentication is unresolved',async t=>{
 let release,started;const entered=new Promise(resolve=>{started=resolve;});
 const auth=client();auth.verifyIdToken=()=>{started();return new Promise(resolve=>{release=resolve;});};
 const f=await fixture(t,auth),response=f.post();await entered;
 assert.equal(await f.worker.settle(invocation(30)),false);
 assert.equal((await response).status,503);assert.equal(f.calls.length,0);
 release({getPayload:()=>({})});
 assert.equal(await f.worker.settle(invocation(5000)),true);
});
test('client cancellation during authentication prevents later delivery',async t=>{
 let release,started;const entered=new Promise(resolve=>{started=resolve;});
 const auth=client();auth.verifyIdToken=()=>{started();return new Promise(resolve=>{release=resolve;});};
 const f=await fixture(t,auth),controller=new AbortController();
 const request=fetch(f.url,{method:'POST',signal:controller.signal,headers:{authorization:`Bearer ${token()}`,'content-type':'application/json'},body:JSON.stringify({deliveryId:'one'})}).catch(()=>null);
 await entered;controller.abort();await request;
 await f.closed;
 release({getPayload:()=>({iss:'https://accounts.google.com',aud:config.audience,sub:config.serviceAccountUid,email:config.serviceAccountEmail,email_verified:true,exp:Math.floor(Date.now()/1000)+3600})});
 await f.handled;assert.equal(f.calls.length,0);
 assert.equal(await f.worker.settle(invocation(5000)),true);
});
test('authentication timeout retains raw work and does not restart the delivery budget',async t=>{
 let release;const auth=client();auth.verifyIdToken=()=>new Promise(resolve=>{release=resolve;});
 const f=await fixture(t,auth);
 assert.equal((await f.post()).status,503);assert.equal(f.calls.length,0);
 assert.equal(await f.worker.settle(invocation(30)),false);
 release({getPayload:()=>({})});assert.equal(await f.worker.settle(invocation(5000)),true);
});
test('time spent in authentication is included in the single invocation deadline',async t=>{
 const auth=client(),verify=auth.verifyIdToken.bind(auth);let entered;
 auth.verifyIdToken=async options=>{entered=Date.now();await new Promise(resolve=>setTimeout(resolve,100));return verify(options);};
 const f=await fixture(t,auth);assert.equal((await f.post()).status,204);
 assert.ok(f.calls[0].context.deadlineMs<=entered+25000);
});
test('public factory rejects authority and extra selectors before acquiring its configured pool',async t=>{
 let connections=0;
 const worker=createGoogleEventDeliveryWorker({...config,namespace:'synthetic',pool:{async connect(){connections++;throw new Error('NO_DATABASE');}},definitions:[{name:'synthetic.event',description:'Synthetic event.',inputSchema:z.strictObject({}),payloadSchema:z.strictObject({}),matches:()=>true}],authorize:()=>true});
 const app=Fastify({logger:false});app.post('/tasks',worker.handle);
 t.after(async()=>{await worker.settle(invocation(5000));await app.close();});
 for(const payload of [{deliveryId:'one'},{deliveryId:'one',namespace:'another'}]){
  const response=await app.inject({method:'POST',url:'/tasks',payload});
  assert.ok([400,401].includes(response.statusCode));
 }
 assert.equal(connections,0);
});
test('public factory verifies a signed token and uses its fixed namespace in checked delivery',async t=>{
 const queries=[];let released=0;
 // Only certificate retrieval is replaced. Google's production JWT verification still checks the signature and claims.
 t.mock.method(OAuth2Client.prototype,'getFederatedSignonCertsAsync',async()=>({certs:client().certificateCache,format:'PEM'}));
 const worker=createGoogleEventDeliveryWorker({...config,namespace:'synthetic',pool:{async connect(){return {async query(sql,values){queries.push({sql,values});return {rows:[],rowCount:0};},release(){released++;}};}},definitions:[{name:'synthetic.event',description:'Synthetic event.',inputSchema:z.strictObject({}),payloadSchema:z.strictObject({}),matches:()=>true}],authorize:()=>true});
 const app=Fastify({logger:false});app.post('/tasks',{bodyLimit:1024},worker.handle);
 await app.listen({host:'127.0.0.1',port:0});
 t.after(async()=>{await worker.settle(invocation(5000));await app.close();});
 const response=await fetch(`http://127.0.0.1:${app.server.address().port}/tasks`,{method:'POST',headers:{authorization:`Bearer ${token()}`,'content-type':'application/json'},body:JSON.stringify({deliveryId:'one'})});
 assert.equal(response.status,204);
 const lookup=queries.find(entry=>entry.sql.includes('delivery_id=$2'));
 assert.deepEqual(lookup.values,['synthetic','one']);assert.equal(released,1);
});
