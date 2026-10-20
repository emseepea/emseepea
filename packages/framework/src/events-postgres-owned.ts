import { performance } from 'node:perf_hooks';
import { ExternalMcpEventError, type ExternalMcpEventInvocation } from './events-external.js';
import type { PostgresEventClient } from './events-postgres.js';
export interface OwnedEventClient extends PostgresEventClient { release(error?: Error): void }
export interface OwnedEventPool { connect(): Promise<OwnedEventClient> }
export type EventSql = (sql: string, values?: readonly unknown[]) => ReturnType<PostgresEventClient['query']>;
/** Private operation owner. A local timeout is never a backend cancellation claim. */
export function createOwnedEventOperations() {
  const pending = new Set<Promise<unknown>>();
  let closed = false, disposalFailed = false;
  function track<T>(promise: Promise<T>): Promise<T> {
    pending.add(promise);
    void promise.then(()=>pending.delete(promise),()=>pending.delete(promise));
    return promise;
  }
  function dispose(client: OwnedEventClient, uncertain: boolean) {
    try { client.release(uncertain ? new Error('EVENT_OPERATION_UNKNOWN') : undefined); }
    catch { disposalFailed = true; }
  }
  async function operation<T>(pool: OwnedEventPool, invocation: ExternalMcpEventInvocation, work: (sql: EventSql)=>Promise<T>, readOnly: boolean, knownError: (error:unknown)=>boolean): Promise<T> {
    if (!invocation?.signal || !Number.isFinite(invocation.deadlineMs)) throw new ExternalMcpEventError('INVALID_INPUT');
    const end = performance.now()+Math.min(5000,invocation.deadlineMs-Date.now());
    const check=()=>{
      if (closed || invocation.signal.aborted) throw new ExternalMcpEventError('ABORTED');
      if (performance.now()>=end) throw new ExternalMcpEventError('DEADLINE');
    };
    check();
    async function wait<TValue>(promise:Promise<TValue>, cap:number, abort=true):Promise<TValue> {
      let timer:ReturnType<typeof setTimeout>|undefined;let stop:(()=>void)|undefined;
      try {
        return await Promise.race([track(promise),new Promise<never>((_resolve,reject)=>{
          timer=setTimeout(()=>reject(new ExternalMcpEventError('DEADLINE')),Math.max(1,Math.min(cap,end-performance.now())));
          if (abort) {
            stop=()=>reject(new ExternalMcpEventError('ABORTED'));
            invocation.signal.addEventListener('abort',stop,{once:true});if(invocation.signal.aborted)stop();
          }
        })]);
      } finally {if(timer)clearTimeout(timer);if(stop)invocation.signal.removeEventListener('abort',stop);}
    }
    const acquisition=Promise.resolve().then(()=>pool.connect());
    let client:OwnedEventClient;
    try {client=await wait(acquisition,500);check();}
    catch(error) {track(acquisition.then(value=>dispose(value,true),()=>{}));if(error instanceof ExternalMcpEventError)throw error;throw new ExternalMcpEventError('UNAVAILABLE');}
    let uncertain=false,committing=false,began=false;
    const raw:EventSql=async(sql,values)=>{
      check();
      try {const result=await wait(Promise.resolve().then(()=>client.query(sql,values)),1000);check();return result;}
      catch(error) {
        const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
        if(error instanceof ExternalMcpEventError || typeof code!=='string'||!/^[0-9A-Z]{5}$/.test(code)||code.startsWith('08'))uncertain=true;
        throw error;
      }
    };
    const run:EventSql=async(sql,values)=>{
      check();const ms=Math.max(1,Math.floor(Math.min(750,end-performance.now())));
      await raw("SELECT pg_catalog.set_config('statement_timeout',$1,true),pg_catalog.set_config('lock_timeout',$2,true)",[`${ms}ms`,`${Math.min(ms,250)}ms`]);
      return raw(sql,values);
    };
    try {
      await raw(readOnly?'BEGIN READ ONLY':'BEGIN');began=true;
      await raw('SET LOCAL search_path=pg_catalog,public,pg_temp');
      const result=await work(run);check();
      committing=true;await raw('COMMIT');committing=false;began=false;
      return result;
    } catch(error) {
      uncertain ||= committing;
      if(began&&!uncertain) {
        // Cleanup has its own finite cap; it never races another query on this client.
        try {
          const rollback=track(Promise.resolve().then(()=>client.query('ROLLBACK')));
          let timer:ReturnType<typeof setTimeout>|undefined;
          try {await Promise.race([rollback,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('ROLLBACK_UNKNOWN')),500);})]);}
          finally {if(timer)clearTimeout(timer);}
        } catch {uncertain=true;}
      }
      if(uncertain)throw new ExternalMcpEventError(readOnly?'UNAVAILABLE':'OUTCOME_UNKNOWN');
      if(error instanceof ExternalMcpEventError||knownError(error))throw error;
      throw new ExternalMcpEventError('UNAVAILABLE');
    } finally {dispose(client,uncertain);}
  }
  return {
    track,
    run<T>(pool:OwnedEventPool,invocation:ExternalMcpEventInvocation,work:(sql:EventSql)=>Promise<T>,readOnly=false,knownError:(error:unknown)=>boolean=()=>false):Promise<T> {
      return track(operation(pool,invocation,work,readOnly,knownError));
    },
    async settle(invocation:ExternalMcpEventInvocation):Promise<boolean> {
      closed=true;
      const end=performance.now()+Math.max(0,invocation.deadlineMs-Date.now());
      while(pending.size) {
        if(invocation.signal.aborted||performance.now()>=end)return false;
        let timer:ReturnType<typeof setTimeout>|undefined;let stop:(()=>void)|undefined;
        try {
          const done=await Promise.race([Promise.allSettled([...pending]).then(()=>true),new Promise<false>(resolve=>{
            timer=setTimeout(()=>resolve(false),Math.max(1,end-performance.now()));
            stop=()=>resolve(false);invocation.signal.addEventListener('abort',stop,{once:true});if(invocation.signal.aborted)stop();
          })]);
          if(!done)return false;
        } finally {if(timer)clearTimeout(timer);if(stop)invocation.signal.removeEventListener('abort',stop);}
      }
      return !disposalFailed;
    },
  };
}
