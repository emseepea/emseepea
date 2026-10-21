import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { z } from 'zod';
import * as external from '../../packages/framework/dist/events-external.js';
const moduleMockExports = Number(process.versions.node.split('.')[0]) >= 24 ? 'exports' : 'namedExports';
mock.module('../../packages/framework/dist/events-external.js', {
  [moduleMockExports]: { ...external, createExternalMcpEventRuntime(options) {
    const runtime=external.createExternalMcpEventRuntime(options);
    return {...runtime,async settle(){return false;}};
  } },
});
const {createEmseepea}=await import('../../packages/framework/dist/index.js');
test('server close reports an external lifecycle that did not settle',async()=>{
  const resourceServerUrl=new URL('https://api.example/mcp');
  const app=createEmseepea({name:'external-close-test',version:'0.0.0',authentication:{
    verifier:{async verifyAccessToken(){throw new Error('No request expected');}},
    metadata:{resourceServerUrl,oauthMetadata:{issuer:'https://auth.example',authorization_endpoint:'https://auth.example/authorize',token_endpoint:'https://auth.example/token',response_types_supported:['code']}}},
    events:{mode:'external',definitions:[{name:'synthetic.reply',description:'Synthetic reply.',inputSchema:z.strictObject({}),payloadSchema:z.strictObject({}),matches:()=>true}],
      ownerKey:()=> 'synthetic-owner',authorize:()=>true,health:()=>true,
      lifecycle:{async observe(){throw new Error('No operation expected');},async activate(){throw new Error('No operation expected');},async revoke(){throw new Error('No operation expected');}}}});
  await assert.rejects(app.close(),/External Events shutdown has unfinished operations/);
});
