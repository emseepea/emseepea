import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { GoogleAuth } from 'google-auth-library';
import { GoogleEventTransportSetupError, googleSdkGraphSafe, googleSdkLoggingSafe } from './events-google-sdk-guards.js';
export { GoogleEventTransportSetupError } from './events-google-sdk-guards.js';
import type { ExternalMcpEventInvocation } from './events-external.js';
import type { EventDispatchTransport } from './events-postgres-dispatch.js';
import { createGoogleApiLifetime } from './events-google-sdk-lifetime.js';

type Row=Record<string,unknown>;
type Invocation=ExternalMcpEventInvocation;
const origin='https://cloudtasks.googleapis.com';
const requestLimit=8192,responseLimit=16384,bodyLimit=1024;
export interface CloudTasksEventConfiguration {
 readonly namespace:string;readonly projectId:string;readonly location:string;readonly queueId:string;
 readonly workerURL:string;readonly audience:string;readonly serviceAccountEmail:string;readonly serviceAccountUid:string;
}
interface Credentials {getRequestHeaders(url:string):Promise<Headers>}
interface Runtime {
 graphSafe():boolean;loggingSafe():boolean;
 createAuth(projectId:string):{getClient():Promise<Credentials>};
 fetch:typeof globalThis.fetch;
}
const production:Runtime={
 graphSafe:googleSdkGraphSafe,
 loggingSafe:googleSdkLoggingSafe,
 createAuth:projectId=>new GoogleAuth({projectId,universeDomain:'googleapis.com',scopes:['https://www.googleapis.com/auth/cloud-platform']}),
 fetch:(input,options)=>globalThis.fetch(input,options),
};
const setup=(code:GoogleEventTransportSetupError['code']):never=>{throw new GoogleEventTransportSetupError(code);};
const hasControl=(value:string)=>{for(const character of value){const code=character.codePointAt(0)!;if(code<=31||code===127)return true;}return false;};
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length>0&&Buffer.byteLength(v)<=max&&
 !hasControl(v)&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v);
const object=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const keys=(v:Row,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));
const noKeys=(v:unknown)=>v===undefined||object(v)&&Object.keys(v).length===0;
function https(value:unknown):string {
 if(!text(value,2048))return setup('INVALID_CONFIGURATION');
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port&&url.port!=='443')return setup('INVALID_CONFIGURATION');return url.href;}
 catch{return setup('INVALID_CONFIGURATION');}
}
function configure(value:CloudTasksEventConfiguration) {
 if(!object(value)||!keys(value,['namespace','projectId','location','queueId','workerURL','audience','serviceAccountEmail','serviceAccountUid'])||
  !text(value.namespace,240)||typeof value.projectId!=='string'||!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value.projectId)||
  typeof value.location!=='string'||!/^[a-z][a-z0-9-]{0,62}$/.test(value.location)||typeof value.queueId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value.queueId)||
  typeof value.serviceAccountEmail!=='string'||!/^[-a-z0-9.]{1,64}@[-a-z0-9.]{1,128}\.iam\.gserviceaccount\.com$/.test(value.serviceAccountEmail)||
  typeof value.serviceAccountUid!=='string'||!/^[0-9]{1,40}$/.test(value.serviceAccountUid))return setup('INVALID_CONFIGURATION');
 const config=Object.freeze({...value,workerURL:https(value.workerURL),audience:https(value.audience)});
 const queue=`projects/${config.projectId}/locations/${config.location}/queues/${config.queueId}`;
 return {config,queue,fingerprint:createHash('sha256').update(JSON.stringify([config.namespace,queue,config.workerURL,config.audience,config.serviceAccountEmail,config.serviceAccountUid,'POST',1,28])).digest('hex')};
}
/** Private preparation seam; no public route or credential/provider override is exported by the package. */
export function createCloudTasksRestTransportRuntime(options:CloudTasksEventConfiguration,runtime:Runtime=production):EventDispatchTransport&{settle(invocation:Invocation):Promise<boolean>} {
 const {config,queue,fingerprint}=configure(options),lifetime=createGoogleApiLifetime();
 let disposalFailed=false;
 const endpoint=`${origin}/v2/${queue.split('/').map(encodeURIComponent).join('/')}`;
 const body=(deliveryId:string)=>Buffer.from(JSON.stringify({deliveryId}));
 function descriptor(deliveryId:string,taskId:string) {
  if(!text(deliveryId,240)||!/^emseepea-[0-9a-f]{64}$/.test(taskId))throw new Error('INVALID_TASK_IDENTITY');
  const bytes=body(deliveryId);if(bytes.length>bodyLimit)throw new Error('TASK_BODY_TOO_LARGE');
  return {name:`${queue}/tasks/${taskId}`,httpRequest:{httpMethod:'POST',url:config.workerURL,headers:{'Content-Type':'application/json'},body:bytes.toString('base64'),
   oidcToken:{serviceAccountEmail:config.serviceAccountEmail,audience:config.audience}},dispatchDeadline:'28s'};
 }
 function requestBody(deliveryId:string,taskId:string){const bytes=Buffer.from(JSON.stringify({task:descriptor(deliveryId,taskId),responseView:'BASIC'}));if(bytes.length>requestLimit)throw new Error('CREATE_REQUEST_TOO_LARGE');return bytes;}
 // Reject configurations whose worst valid escaped identifier can never meet the request cap.
 try{requestBody('\\'.repeat(240),'emseepea-'+'f'.repeat(64));}catch{return setup('INVALID_CONFIGURATION');}
 const guards=()=>{if(!runtime.graphSafe())return setup('UNSUPPORTED_DEPENDENCY_GRAPH');if(!runtime.loggingSafe())return setup('UNSAFE_SDK_LOGGING');};
 guards();const auth=runtime.createAuth(config.projectId);
 async function read(response:Response,check:()=>void):Promise<unknown> {
  if(!response.body)throw new Error('EMPTY_GOOGLE_RESPONSE');const reader=response.body.getReader();let done=false,total=0,value:unknown,failure:unknown;const chunks:Uint8Array[]=[];
  try{while(true){check();const next=await reader.read();check();if(next.done){done=true;break;}total+=next.value.byteLength;if(total>responseLimit)throw new Error('GOOGLE_RESPONSE_TOO_LARGE');chunks.push(next.value);}
   value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,total)));
  }catch(error){failure=error;}
  if(!done)try{await reader.cancel();}catch{disposalFailed=true;failure=new Error('GOOGLE_STREAM_CLEANUP_FAILED');}
  try{reader.releaseLock();}catch{disposalFailed=true;}
  if(failure)throw failure;return value;
 }
 async function request(path:string,method:'GET'|'POST',data:Buffer|undefined,invocation:Invocation):Promise<{status:number;value:unknown}|null> {
  if(data&&data.length>requestLimit)return null;
  return lifetime.invoke<{status:number;value:unknown}|null>(invocation,null,async(signal,check)=>{
   guards();check();const credentials=await auth.getClient();check();guards();
   const supplied=await credentials.getRequestHeaders(origin);check();guards();
   const authorization=supplied.get('authorization');
   if(typeof authorization!=='string'||authorization.length>8192||!/^Bearer [A-Za-z0-9._~+\x2f-]+=*$/.test(authorization))throw new Error('GOOGLE_AUTH_UNAVAILABLE');
   // Do not forward quota-project or arbitrary SDK headers into the configured queue request.
   const headers:Record<string,string>={Authorization:authorization};if(data)headers['Content-Type']='application/json';
   check();const response=await runtime.fetch(path,{method,headers,redirect:'manual',signal,...(data?{body:data.toString('utf8')}: {})});
   if(response.status>=300&&response.status<400){if(response.body)await response.body.cancel();throw new Error('GOOGLE_REDIRECT_REJECTED');}
   const value=await read(response,check);check();return {status:response.status,value};
  });
 }
 function matching(value:unknown,deliveryId:string,taskId:string):boolean {
  if(!object(value)||!keys(value,['name','httpRequest','dispatchDeadline','scheduleTime','createTime','dispatchCount','responseCount','firstAttempt','lastAttempt','view']))return false;
  const wanted=descriptor(deliveryId,taskId),http=value.httpRequest;
  if(value.name!==wanted.name||value.dispatchDeadline!=='28s'||!object(http)||!keys(http,['httpMethod','url','headers','body','oidcToken'])||http.httpMethod!=='POST'||http.url!==config.workerURL)return false;
  if(!object(http.oidcToken)||!keys(http.oidcToken,['serviceAccountEmail','audience'])||http.oidcToken.serviceAccountEmail!==config.serviceAccountEmail||http.oidcToken.audience!==config.audience)return false;
  if(!object(http.headers)||Object.keys(http.headers).length!==1||Object.entries(http.headers).some(([name,value])=>name.toLowerCase()!=='content-type'||value!=='application/json'))return false;
  if(typeof http.body!=='string'||http.body.length>1400||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(http.body))return false;
  const decoded=Buffer.from(http.body,'base64');return decoded.length<=bodyLimit&&decoded.toString('base64')===http.body&&decoded.equals(body(deliveryId));
 }
 return Object.freeze({
  fingerprint,
  async queue(invocation:Invocation):Promise<'present'|'unavailable'> {
   const response=await request(endpoint,'GET',undefined,invocation);if(!response||response.status!==200||!object(response.value))return 'unavailable';const value=response.value;
   return value.name===queue&&value.state==='RUNNING'&&keys(value,['name','state','rateLimits','retryConfig','purgeTime','taskTtl','tombstoneTtl','stackdriverLoggingConfig','httpTarget','appEngineRoutingOverride'])&&noKeys(value.httpTarget)&&noKeys(value.appEngineRoutingOverride)?'present':'unavailable';
  },
  async inspect(task:Readonly<{deliveryId:string;taskId:string}>,invocation:Invocation):Promise<'matching'|'conflict'|'missing'|'unavailable'> {
   const {deliveryId,taskId}=task;try{descriptor(deliveryId,taskId);}catch{return 'conflict';}
   const response=await request(`${endpoint}/tasks/${taskId}?responseView=FULL`,'GET',undefined,invocation);
   if(!response)return 'unavailable';if(response.status===404)return 'missing';if(response.status!==200)return 'unavailable';return matching(response.value,deliveryId,taskId)?'matching':'conflict';
  },
  async create(task:Readonly<{deliveryId:string;taskId:string}>,invocation:Invocation):Promise<'created'|'exists'|'unavailable'> {
   const {deliveryId,taskId}=task;let bytes:Buffer;try{bytes=requestBody(deliveryId,taskId);}catch{return 'unavailable';}
   const response=await request(`${endpoint}/tasks`,'POST',bytes,invocation);if(!response||!object(response.value))return 'unavailable';
   if(response.status>=200&&response.status<300&&response.value.name===`${queue}/tasks/${taskId}`)return 'created';
   return response.status===409&&object(response.value.error)&&response.value.error.status==='ALREADY_EXISTS'?'exists':'unavailable';
  },
  async settle(invocation:Invocation){return await lifetime.settle(invocation)&&!disposalFailed;},
 });
}
