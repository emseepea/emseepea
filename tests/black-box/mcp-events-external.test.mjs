import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { z } from 'zod';
import { createEmseepea, serveEmseepea, publishMcpEvent } from '../../packages/framework/dist/index.js';
const resourceServerUrl=new URL('https://api.example/mcp');
const meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientInfo':{name:'external-events-test',version:'0.0.0'},'io.modelcontextprotocol/clientCapabilities':{}};
function options() {
  const calls={observe:0,activate:0,revoke:[]};
  const lifecycle={async observe(){calls.observe++;throw new Error('UNEXPECTED_OBSERVE');},async activate(){calls.activate++;throw new Error('UNEXPECTED_ACTIVATE');},async revoke(identity){calls.revoke.push(identity);}};
  const value={name:'external-eventful',version:'0.0.0',authentication:{
    verifier:{async verifyAccessToken(token){return {token,clientId:'synthetic',scopes:['events:read'],expiresAt:Math.floor(Date.now()/1000)+60,resource:resourceServerUrl};}},
    metadata:{resourceServerUrl,oauthMetadata:{issuer:'https://auth.example',authorization_endpoint:'https://auth.example/authorize',token_endpoint:'https://auth.example/token',response_types_supported:['code']}}},
    events:{mode:'external',definitions:[{name:'synthetic.reply',description:'Synthetic reply reference.',inputSchema:z.strictObject({threadId:z.string()}),payloadSchema:z.strictObject({threadId:z.string()}),matches:()=>true}],
      ownerKey:auth=>`owner:${auth.token}`,authorize:({ownerKey})=>ownerKey!=='owner:denied',health:()=>true,lifecycle}};
  return {value,calls};
}
async function rpc(url,method,params={},token) {
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream','MCP-Protocol-Version':'2026-07-28','Mcp-Method':method,...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:{...params,_meta:meta}})});
  return {response,body:await response.json()};
}
test('external constructor starts no polling timer and rejects mixed configurations before callbacks',async()=>{
  const f=options();let polls=0;const original=globalThis.setInterval;
  const spy=mock.method(globalThis,'setInterval',(callback,delay,...args)=>{if(delay===1000)polls++;return original(callback,delay,...args);});
  let app;
  try { app=createEmseepea(f.value);assert.equal(polls,0); }
  finally { if(app)await app.close();spy.mock.restore(); }
  assert.throws(()=>createEmseepea({...f.value,events:{...f.value.events,store:{}}}));
  assert.equal(f.calls.observe+f.calls.activate+f.calls.revoke.length,0);
});
test('authenticated external RPC retains permission-shaped discovery and owner-scoped cleanup',async()=>{
  const f=options();const app=createEmseepea(f.value);const server=await serveEmseepea(app,{port:0});
  try {
    const anonymous=await rpc(server.url,'events/list');assert.equal(anonymous.response.status,401);
    const denied=await rpc(server.url,'events/list',{},'denied');assert.deepEqual(denied.body.result.events,[]);
    const allowed=await rpc(server.url,'events/list',{},'user-a');assert.deepEqual(allowed.body.result.events.map(event=>event.name),['synthetic.reply']);
    const invalid={name:'synthetic.reply',arguments:{threadId:'thread:1'},delivery:{mode:'webhook',url:'http://127.0.0.1/private',secret:`whsec_${Buffer.alloc(32,1).toString('base64')}`}};
    const rejected=await rpc(server.url,'events/subscribe',invalid,'user-a');assert.ok(rejected.body.error);assert.equal(f.calls.observe+f.calls.activate,0);
    const unsubscribe={name:'synthetic.reply',arguments:{threadId:'thread:1'},delivery:{mode:'webhook',url:'https://callback.example/events'}};
    await rpc(server.url,'events/unsubscribe',unsubscribe,'user-a');await rpc(server.url,'events/unsubscribe',unsubscribe,'user-b');
    assert.deepEqual(f.calls.revoke.map(item=>item.ownerKey),['owner:user-a','owner:user-b']);assert.notEqual(f.calls.revoke[0].id,f.calls.revoke[1].id);
    await assert.rejects(publishMcpEvent(app,'synthetic.reply',{threadId:'thread:1'}),error=>error.code==='EXTERNAL_PUBLICATION_REQUIRES_CAPTURE');
    assert.equal(f.calls.observe+f.calls.activate,0);
  } finally { await server.close(); }
});

