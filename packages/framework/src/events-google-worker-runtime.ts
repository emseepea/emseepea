import {performance} from 'node:perf_hooks';
import type {FastifyReply,FastifyRequest} from 'fastify';
import {OAuth2Client} from 'google-auth-library';
import {assertGoogleSdkSafe,GoogleEventTransportSetupError} from './events-google-sdk-guards.js';
import {createGoogleApiLifetime} from './events-google-sdk-lifetime.js';
import {createPostgresEventDelivery,type PostgresEventDelivery,type PostgresEventDeliveryOptions} from './events-postgres-delivery.js';
import type {ExternalMcpEventInvocation} from './events-external.js';

interface WorkerIdentity {
 readonly audience:string;
 readonly serviceAccountEmail:string;
 readonly serviceAccountUid:string;
}
export interface GoogleEventDeliveryWorkerOptions extends PostgresEventDeliveryOptions,WorkerIdentity {}
export interface GoogleEventDeliveryWorker {
 handle(request:FastifyRequest,reply:FastifyReply):Promise<void>;
 settle(invocation:ExternalMcpEventInvocation):Promise<boolean>;
}
function hasControl(value:string):boolean {
 for(const character of value){const code=character.codePointAt(0)!;if(code<=31||code===127)return true;}
 return false;
}
function identity(options:WorkerIdentity):WorkerIdentity {
 try {
  const url=new URL(options.audience);
  if(typeof options.audience!=='string'||Buffer.byteLength(options.audience)>2048||hasControl(options.audience)||
   url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port&&url.port!=='443'||
   typeof options.serviceAccountEmail!=='string'||typeof options.serviceAccountUid!=='string'||
   !/^[-a-z0-9.]{1,64}@[-a-z0-9.]{1,128}\.iam\.gserviceaccount\.com$/.test(options.serviceAccountEmail)||
   !/^[0-9]{1,40}$/.test(options.serviceAccountUid))throw new Error();
  return Object.freeze({audience:options.audience,serviceAccountEmail:options.serviceAccountEmail,serviceAccountUid:options.serviceAccountUid});
 }catch{throw new GoogleEventTransportSetupError('INVALID_CONFIGURATION');}
}
function deliveryId(body:unknown):string|null {
 if(!body||typeof body!=='object'||Object.getPrototypeOf(body)!==Object.prototype||Reflect.ownKeys(body).length!==1)return null;
 const field=Object.getOwnPropertyDescriptor(body,'deliveryId');
 const value=field&&'value' in field?field.value:undefined;
 return typeof value==='string'&&value.length>0&&Buffer.byteLength(value)<=240&&
  !hasControl(value)&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)?value:null;
}
/** Explicitly register handle on a worker route, never on the public MCP route. */
export function createGoogleEventDeliveryWorker(options:GoogleEventDeliveryWorkerOptions):GoogleEventDeliveryWorker {
 const configured=identity(options);assertGoogleSdkSafe();
 const delivery=createPostgresEventDelivery({namespace:options.namespace,pool:options.pool,definitions:options.definitions,authorize:options.authorize});
 return createGoogleEventDeliveryWorkerRuntime(configured,delivery,new OAuth2Client());
}
/** Private test seam. The public factory always uses Google verification and checked delivery. */
export function createGoogleEventDeliveryWorkerRuntime(options:WorkerIdentity,delivery:PostgresEventDelivery,auth:OAuth2Client):GoogleEventDeliveryWorker {
 const configured=identity(options),authentication=createGoogleApiLifetime();assertGoogleSdkSafe();
 const pending=new Set<Promise<void>>(),controllers=new Set<AbortController>();let closing=false;
 async function handle(request:FastifyRequest,reply:FastifyReply):Promise<void> {
  if(closing){reply.code(503).send();return;}
  const controller=new AbortController(),end=performance.now()+25000,deadlineMs=Date.now()+25000;
  const abort=()=>controller.abort(),closed=()=>{if(!reply.raw.writableFinished)abort();};
  const timer=setTimeout(abort,25000);controllers.add(controller);
  request.raw.once('aborted',abort);reply.raw.once('close',closed);
  if(request.raw.aborted||reply.raw.destroyed)abort();
  try {
   const id=deliveryId(request.body);if(id===null){reply.code(400).send();return;}
   const header=request.headers.authorization;
   const authHeaders=request.raw.rawHeaders.filter((_,index)=>index%2===0&&request.raw.rawHeaders[index]!.toLowerCase()==='authorization');
   if(authHeaders.length!==1||typeof header!=='string'||header.length>8192||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(header)){reply.code(401).send();return;}
   const context={signal:controller.signal,deadlineMs};
   const allowed=await authentication.invoke<boolean|null>(context,null,async(_signal,check)=>{
    assertGoogleSdkSafe();check();
    let ticket;
    try{ticket=await auth.verifyIdToken({idToken:header.slice(7),audience:configured.audience});}catch{return false;}
    check();assertGoogleSdkSafe();const claims=ticket.getPayload();
    return !!claims&&(claims.iss==='https://accounts.google.com'||claims.iss==='accounts.google.com')&&
     claims.aud===configured.audience&&claims.sub===configured.serviceAccountUid&&claims.email===configured.serviceAccountEmail&&
     claims.email_verified===true&&Number.isFinite(claims.exp)&&claims.exp*1000>Date.now();
   });
   if(closing||controller.signal.aborted||performance.now()>=end||allowed===null){reply.code(503).send();return;}
   if(!allowed){reply.code(401).send();return;}
   const result=await delivery.deliver(id,context);
   reply.code(result.outcome==='terminal'?204:503).send();
  }catch{if(!reply.sent)reply.code(503).send();}
  finally{clearTimeout(timer);controllers.delete(controller);request.raw.removeListener('aborted',abort);reply.raw.removeListener('close',closed);}
 }
 return Object.freeze({
  handle(request:FastifyRequest,reply:FastifyReply){
   const operation=handle(request,reply);pending.add(operation);
   void operation.then(()=>pending.delete(operation),()=>pending.delete(operation));return operation;
  },
  async settle(invocation:ExternalMcpEventInvocation):Promise<boolean> {
   closing=true;for(const controller of controllers)controller.abort();
   if(!invocation?.signal||!Number.isFinite(invocation.deadlineMs)||invocation.signal.aborted||invocation.deadlineMs<=Date.now())return false;
   const complete=Promise.all([authentication.settle(invocation),delivery.settle(invocation),Promise.allSettled(pending).then(()=>true)]).then(results=>results.every(Boolean),()=>false);
   let timer:ReturnType<typeof setTimeout>|undefined,stop:(()=>void)|undefined;
   try{return await Promise.race([complete,new Promise<false>(resolve=>{
    timer=setTimeout(()=>resolve(false),Math.min(2147483647,Math.max(1,invocation.deadlineMs-Date.now())));
    stop=()=>resolve(false);invocation.signal.addEventListener('abort',stop,{once:true});if(invocation.signal.aborted)stop();
   })]);}finally{if(timer)clearTimeout(timer);if(stop)invocation.signal.removeEventListener('abort',stop);}
  },
 });
}
