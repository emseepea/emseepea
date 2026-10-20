import {performance} from 'node:perf_hooks';
import type {ExternalMcpEventInvocation} from './events-external.js';
type Owner=(invocation:ExternalMcpEventInvocation)=>Promise<boolean>;
interface Budget {end:number;controller:AbortController}
interface Scope {owners:Set<Owner>;budget?:Budget;result?:Promise<boolean>}
const scopes=new WeakMap<object,Scope>();
function scope(root:object):Scope {let value=scopes.get(root);if(!value){value={owners:new Set()};scopes.set(root,value);}return value;}
/** Private owner registry, always keyed by the root application, never by a child plugin. */
export function registerAppShutdownOwner(root:object,owner:Owner):()=>void {
 const value=scope(root);if(value.budget)throw new Error('APP_SHUTDOWN_ALREADY_STARTED');
 value.owners.add(owner);return ()=>{if(!value.budget)value.owners.delete(owner);};
}
/** Establish before stopping request admission. Repeated calls cannot extend the deadline. */
export function prepareAppShutdown(root:object,timeoutMs=10000):void {
 const value=scope(root);if(value.budget)return;
 if(!Number.isFinite(timeoutMs)||timeoutMs<0)throw new Error('INVALID_SHUTDOWN_BUDGET');
 value.budget={end:performance.now()+timeoutMs,controller:new AbortController()};
}
export function remainingAppShutdown(root:object):number {prepareAppShutdown(root);return Math.max(0,scope(root).budget!.end-performance.now());}
/** Start every owner once, concurrently; observe raw results even after the bounded join expires. */
export function startAppShutdown(root:object):Promise<boolean> {
 const value=scope(root);prepareAppShutdown(root);if(value.result)return value.result;
 const budget=value.budget!,remaining=Math.max(0,budget.end-performance.now());
 if(remaining===0)budget.controller.abort();
 const invocation=Object.freeze({signal:budget.controller.signal,deadlineMs:Date.now()+remaining});
 const actual=Promise.all([...value.owners].map(owner=>Promise.resolve().then(()=>owner(invocation)).then(answer=>answer===true,()=>false)));
 let timer:ReturnType<typeof setTimeout>|undefined;
 const expired=new Promise<false>(resolve=>{timer=setTimeout(()=>{budget.controller.abort();resolve(false);},remaining);});
 value.result=Promise.race([actual.then(answers=>{if(performance.now()>=budget.end||!answers.every(Boolean)){budget.controller.abort();return false;}return true;}),expired]).finally(()=>{if(timer)clearTimeout(timer);});
 return value.result;
}
