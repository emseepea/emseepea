import { performance } from 'node:perf_hooks';
import { ExternalMcpEventError, type ExternalMcpEventInvocation } from './events-external.js';
import type { OwnedEventClient, OwnedEventPool, EventSql } from './events-postgres-owned.js';
export interface DeliverySession {
  readonly remaining:()=>number;
  check():void;
  transaction<T>(work:(sql:EventSql)=>Promise<T>):Promise<T>;
  wait<T>(work:()=>T|Promise<T>,maximumMs:number):Promise<T>;
}
/** One owned connection, multiple short transactions; no caller-owned client is accepted. */
export function createDeliverySessionOwner(pool:OwnedEventPool) {
  let closed=false,disposalFailed=false;
  const pending=new Set<Promise<unknown>>();
  function track<T>(promise:Promise<T>):Promise<T> {
    pending.add(promise);void promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;
  }
  function dispose(client:OwnedEventClient,uncertain:boolean) {
    try{client.release(uncertain?new Error('DELIVERY_OPERATION_UNKNOWN'):undefined);}catch{disposalFailed=true;}
  }
  async function operation<T>(invocation:ExternalMcpEventInvocation,work:(session:DeliverySession)=>Promise<T>):Promise<T> {
    if(!invocation?.signal||!Number.isFinite(invocation.deadlineMs))throw new ExternalMcpEventError('INVALID_INPUT');
    const end=performance.now()+Math.min(25000,invocation.deadlineMs-Date.now());
    const check=(stageEnd=end)=>{
      if(closed||invocation.signal.aborted)throw new ExternalMcpEventError('ABORTED');
      if(performance.now()>=Math.min(end,stageEnd))throw new ExternalMcpEventError('DEADLINE');
    };
    check();
    async function wait<TValue>(task:()=>TValue|Promise<TValue>,stageEnd:number):Promise<TValue> {
      check(stageEnd);let timer:ReturnType<typeof setTimeout>|undefined,stop:(()=>void)|undefined;
      try {
        const actual=track(Promise.resolve().then(()=>{check(stageEnd);return task();}));
        const value=await Promise.race([actual,new Promise<never>((_resolve,reject)=>{
          timer=setTimeout(()=>reject(new ExternalMcpEventError('DEADLINE')),Math.max(1,Math.min(stageEnd,end)-performance.now()));
          stop=()=>reject(new ExternalMcpEventError('ABORTED'));invocation.signal.addEventListener('abort',stop,{once:true});if(invocation.signal.aborted)stop();
        })]);
        check(stageEnd);return value;
      }finally{if(timer)clearTimeout(timer);if(stop)invocation.signal.removeEventListener('abort',stop);}
    }
    const acquisition=track(Promise.resolve().then(()=>pool.connect()));let client:OwnedEventClient;
    try{client=await wait(()=>acquisition,performance.now()+1000);}
    catch(error){track(acquisition.then(value=>dispose(value,true),()=>{}));if(error instanceof ExternalMcpEventError)throw error;throw new ExternalMcpEventError('UNAVAILABLE');}
    let uncertain=false,inTransaction=false;
    const raw: (stageEnd:number)=>EventSql=stageEnd=>async(sql,values)=>{
      try{return await wait(()=>client.query(sql,values),stageEnd);}
      catch(error){const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
        if(error instanceof ExternalMcpEventError||typeof code!=='string'||!/^[0-9A-Z]{5}$/.test(code)||code.startsWith('08'))uncertain=true;
        throw error;
      }
    };
    async function rollback() {
      if(!inTransaction||uncertain)return;
      let timer:ReturnType<typeof setTimeout>|undefined;
      try{await Promise.race([track(Promise.resolve().then(()=>client.query('ROLLBACK'))),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('ROLLBACK_UNKNOWN')),500);})]);inTransaction=false;}
      catch{uncertain=true;}finally{if(timer)clearTimeout(timer);}
    }
    const session:DeliverySession={
      remaining:()=>Math.max(0,end-performance.now()),check,
      wait:(task,maximumMs)=>wait(task,performance.now()+maximumMs),
      async transaction<TValue>(task:(sql:EventSql)=>Promise<TValue>):Promise<TValue> {
        check();if(inTransaction||uncertain)throw new ExternalMcpEventError('OUTCOME_UNKNOWN');
        let committing=false;
        try {
          const begin=raw(performance.now()+1000);
          await begin('BEGIN');inTransaction=true;
          await begin("SET LOCAL search_path=pg_catalog,public,pg_temp; SET LOCAL statement_timeout='750ms'; SET LOCAL lock_timeout='250ms'");
          const stageEnd=Math.min(end,performance.now()+1000),query=raw(stageEnd);
          const run:EventSql=async(sql,values)=>{
            check(stageEnd);const ms=Math.max(1,Math.floor(Math.min(750,stageEnd-performance.now())));
            await query("SELECT pg_catalog.set_config('statement_timeout',$1,true),pg_catalog.set_config('lock_timeout',$2,true)",[`${ms}ms`,`${Math.min(250,ms)}ms`]);
            return query(sql,values);
          };
          const result=await task(run);check(stageEnd);
          committing=true;await raw(performance.now()+1000)('COMMIT');committing=false;inTransaction=false;
          return result;
        }catch(error){uncertain ||= committing;await rollback();if(uncertain)throw new ExternalMcpEventError('OUTCOME_UNKNOWN');if(error instanceof ExternalMcpEventError)throw error;throw new ExternalMcpEventError('UNAVAILABLE');}
      },
    };
    try{return await work(session);}
    catch(error){if(error instanceof ExternalMcpEventError)throw error;throw new ExternalMcpEventError('UNAVAILABLE');}
    finally{await rollback();dispose(client,uncertain||inTransaction);}
  }
  return {
    track,
    run<T>(invocation:ExternalMcpEventInvocation,work:(session:DeliverySession)=>Promise<T>) {return track(operation(invocation,work));},
    // Private admission support. Call only after run() returns, never from its tracked work.
    // The caller keeps admission closed; bounded settle() remains the shutdown boundary.
    async quiesce():Promise<boolean> {
      while(pending.size)await Promise.allSettled([...pending]);
      return !disposalFailed;
    },
    async settle(invocation:ExternalMcpEventInvocation):Promise<boolean> {
      closed=true;const end=performance.now()+Math.max(0,invocation.deadlineMs-Date.now());
      while(pending.size){if(invocation.signal.aborted||performance.now()>=end)return false;let timer:ReturnType<typeof setTimeout>|undefined,stop:(()=>void)|undefined;
        try{const done=await Promise.race([Promise.allSettled([...pending]).then(()=>true),new Promise<false>(resolve=>{timer=setTimeout(()=>resolve(false),Math.max(1,end-performance.now()));stop=()=>resolve(false);invocation.signal.addEventListener('abort',stop,{once:true});if(invocation.signal.aborted)stop();})]);if(!done)return false;}
        finally{if(timer)clearTimeout(timer);if(stop)invocation.signal.removeEventListener('abort',stop);}
      }
      return !disposalFailed;
    },
  };
}
