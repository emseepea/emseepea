import { performance } from 'node:perf_hooks';
import type { ExternalMcpEventInvocation } from './events-external.js';

/** Private ownership of exposed credential/fetch/body promises, never a cancellation guarantee. */
export function createGoogleApiLifetime() {
 const pending=new Set<Promise<unknown>>();let closing=false;
 return {
  async invoke<T>(invocation:ExternalMcpEventInvocation,unavailable:T,work:(signal:AbortSignal,check:()=>void)=>Promise<T>):Promise<T> {
   if(!invocation?.signal||!Number.isFinite(invocation.deadlineMs)||closing||invocation.signal.aborted||pending.size>=2)return unavailable;
   const end=performance.now()+Math.min(3000,invocation.deadlineMs-Date.now());if(end<=performance.now())return unavailable;
   const controller=new AbortController();
   const check=()=>{if(closing||controller.signal.aborted||invocation.signal.aborted||performance.now()>=end)throw new Error('GOOGLE_OPERATION_UNAVAILABLE');};
   let timer:ReturnType<typeof setTimeout>|undefined,stop:(()=>void)|undefined;
   const actual=Promise.resolve().then(async()=>{check();return work(controller.signal,check);}).catch(()=>{controller.abort();return unavailable;});
   pending.add(actual);void actual.then(()=>pending.delete(actual));
   try {
    const value=await Promise.race([actual,new Promise<T>(resolve=>{
     timer=setTimeout(()=>{controller.abort();resolve(unavailable);},Math.max(1,end-performance.now()));
     stop=()=>{controller.abort();resolve(unavailable);};invocation.signal.addEventListener('abort',stop,{once:true});if(invocation.signal.aborted)stop();
    })]);
    if(closing||invocation.signal.aborted||performance.now()>=end)return unavailable;return value;
   }finally{if(timer)clearTimeout(timer);if(stop)invocation.signal.removeEventListener('abort',stop);}
  },
  async settle(invocation:ExternalMcpEventInvocation):Promise<boolean> {
   closing=true;if(!invocation?.signal||!Number.isFinite(invocation.deadlineMs))return false;
   const end=performance.now()+Math.max(0,invocation.deadlineMs-Date.now());
   while(pending.size){if(invocation.signal.aborted||performance.now()>=end)return false;
    let timer:ReturnType<typeof setTimeout>|undefined,stop:(()=>void)|undefined;
    try{const complete=await Promise.race([Promise.allSettled(pending).then(()=>true),new Promise<false>(resolve=>{
     timer=setTimeout(()=>resolve(false),Math.max(1,end-performance.now()));stop=()=>resolve(false);invocation.signal.addEventListener('abort',stop,{once:true});if(invocation.signal.aborted)stop();
    })]);if(!complete)return false;}finally{if(timer)clearTimeout(timer);if(stop)invocation.signal.removeEventListener('abort',stop);}
   }
   return true;
  },
 };
}
