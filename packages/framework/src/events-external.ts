import type { AuthInfo } from "@modelcontextprotocol/server";
import { performance } from "node:perf_hooks";
import {
  checkedListWire, McpEventInputError, mcpEventSubscriptionIdentity, normalizeMcpEventDefinitions,
  validateMcpEventSubscription, validateMcpEventUnsubscribe, verifyMcpEventCallback,
  type McpEventsOptions, type McpEventRuntime, type McpEventSubscription,
} from "./events.js";
import { postCheckedWebhook } from "./events-webhook.js";

export interface ExternalMcpEventInvocation { readonly signal: AbortSignal; readonly deadlineMs: number }
export interface ExternalMcpEventIdentity {
  readonly id: string; readonly ownerKey: string; readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>; readonly url: string;
}
export interface ExternalMcpEventObservation {
  readonly id: string; readonly ownerKey: string; readonly revision: string | null;
  readonly generation: string | null; readonly active: boolean; readonly observedAt: number;
  readonly subscription: Omit<McpEventSubscription, "secret" | "previousSecret" | "previousSecretUntil" | "verifiedUntil"> | null;
}
export interface ExternalMcpEventActivation {
  readonly id: string; readonly revision: string; readonly generation: string;
  readonly observedAt: number; readonly expiresAt: number;
}
/** Durable implementations must qualify CAS, database-time expiry and tombstone fencing. */
export interface ExternalMcpEventLifecycle {
  observe(identity: ExternalMcpEventIdentity, invocation: ExternalMcpEventInvocation): Promise<ExternalMcpEventObservation>;
  activate(request: ExternalMcpEventIdentity & Readonly<{
    expectedRevision: string | null; intent: "renew" | "new"; secret: string; ttlMs: number;
  }>, invocation: ExternalMcpEventInvocation): Promise<ExternalMcpEventActivation>;
  /** Join adapter-owned raw work within the shared shutdown budget. */
  settle?(invocation: ExternalMcpEventInvocation): Promise<boolean>;
  /** Fence stale activation even when observe previously returned revision:null. */
  revoke(identity: ExternalMcpEventIdentity, invocation: ExternalMcpEventInvocation): Promise<void>;
}
export interface ExternalMcpEventsOptions extends Omit<McpEventsOptions, "store"> {
  readonly mode: "external";
  readonly lifecycle: ExternalMcpEventLifecycle;
  readonly store?: never;
}
export type ExternalMcpEventErrorCode = "INVALID_INPUT" | "SUBSCRIPTION_CHANGED" | "UNAVAILABLE" |
  "ABORTED" | "DEADLINE" | "OUTCOME_UNKNOWN" | "EXTERNAL_PUBLICATION_REQUIRES_CAPTURE";
export class ExternalMcpEventError extends Error {
  constructor(readonly code: ExternalMcpEventErrorCode) { super(code); this.name = "ExternalMcpEventError"; }
}
type ProtocolRuntime = Omit<McpEventRuntime, "drain">;
export interface ExternalMcpEventRuntime extends ProtocolRuntime {
  forInvocation(invocation: ExternalMcpEventInvocation): ProtocolRuntime;
  settle(invocation?: ExternalMcpEventInvocation): Promise<boolean>;
}
interface Clock { readonly signal: AbortSignal; readonly end: number; readonly deadlineMs: number }
function fail(code: ExternalMcpEventErrorCode): never { throw new ExternalMcpEventError(code); }
function text(value: unknown): value is string { return typeof value === "string" && !!value && Buffer.byteLength(value) <= 8192; }
function token(value: unknown): value is string { return text(value) && Buffer.byteLength(value) <= 240; }
function epoch(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) < 8640000000000000; }
function copy(value: unknown, depth = 0): unknown {
  if (depth > 32) fail("UNAVAILABLE");
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object" || ![Object.prototype, Array.prototype].includes(Object.getPrototypeOf(value))) fail("UNAVAILABLE");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const array = Array.isArray(value);
  const result: Record<string, unknown> | unknown[] = array ? [] : Object.create(null);
  if (array && Reflect.ownKeys(descriptors).length !== value.length + 1) fail("UNAVAILABLE");
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") fail("UNAVAILABLE");
    const field = descriptors[key]!;
    if (!("value" in field) || !field.enumerable && !(array && key === "length")) fail("UNAVAILABLE");
    if (array && key === "length") continue;
    if (array && !/^(0|[1-9][0-9]*)$/.test(key)) fail("UNAVAILABLE");
    (result as Record<string, unknown>)[key] = copy(field.value, depth + 1);
  }
  return Object.freeze(result);
}
function makeClock(invocation?: ExternalMcpEventInvocation): Clock {
  const signal = invocation?.signal ?? new AbortController().signal;
  const deadlineMs = invocation?.deadlineMs ?? Date.now() + 30000;
  if (!Number.isFinite(deadlineMs)) fail("INVALID_INPUT");
  if (signal.aborted) fail("ABORTED");
  const remaining = Math.min(30000, deadlineMs - Date.now());
  if (remaining <= 0) fail("DEADLINE");
  return { signal, end: performance.now() + remaining, deadlineMs: Date.now() + remaining };
}
function admit(time: Clock): void {
  if (time.signal.aborted) fail("ABORTED");
  if (performance.now() >= time.end) fail("DEADLINE");
}
function observed(value: unknown, identity: ExternalMcpEventIdentity): ExternalMcpEventObservation {
  const snapshot = copy(value) as ExternalMcpEventObservation;
  if (!snapshot || snapshot.id !== identity.id || snapshot.ownerKey !== identity.ownerKey ||
    !(snapshot.revision === null || token(snapshot.revision)) || !(snapshot.generation === null || token(snapshot.generation)) ||
    typeof snapshot.active !== "boolean" || !epoch(snapshot.observedAt)) fail("UNAVAILABLE");
  if (snapshot.revision === null && (snapshot.generation !== null || snapshot.active || snapshot.subscription !== null)) fail("UNAVAILABLE");
  const prior = snapshot.subscription;
  if (prior !== null) {
    if (!snapshot.revision || !snapshot.generation || !epoch(prior.expiresAt) || prior.id !== identity.id ||
      prior.ownerKey !== identity.ownerKey || prior.name !== identity.name || prior.url !== identity.url ||
      mcpEventSubscriptionIdentity(prior.ownerKey,prior.name,prior.arguments,prior.url) !== identity.id) fail("UNAVAILABLE");
  }
  if (snapshot.active && (!prior || prior.expiresAt <= snapshot.observedAt)) fail("UNAVAILABLE");
  if (!snapshot.active && prior && prior.expiresAt > snapshot.observedAt) fail("UNAVAILABLE");
  return snapshot;
}
/** No SQL/provider implementation and no legacy queue are created by this runtime. */
export function createExternalMcpEventRuntime(options: ExternalMcpEventsOptions,
  webhookPost: typeof postCheckedWebhook = postCheckedWebhook): ExternalMcpEventRuntime {
  if (!options || options.mode !== "external" || "store" in options || !Array.isArray(options.definitions) ||
    !options.definitions.length || options.definitions.length > 100 || typeof options.ownerKey !== "function" ||
    typeof options.authorize !== "function" || typeof options.health !== "function" || !options.lifecycle ||
    ["observe","activate","revoke"].some((key) => typeof options.lifecycle[key as keyof ExternalMcpEventLifecycle] !== "function")) {
    throw new TypeError("External Events require an explicit lifecycle and cannot include a legacy store");
  }
  const callbackMs = options.callbackTimeoutMs ?? 5000;
  if (!Number.isSafeInteger(callbackMs) || callbackMs < 1 || callbackMs > 10000) throw new TypeError("events.callbackTimeoutMs must be between 1 and 10000");
  const definitions = normalizeMcpEventDefinitions(options.definitions);
  const pendingOperations = new Set<Promise<unknown>>();
  let closing = false;
  function bound(time: Clock): ProtocolRuntime {
    async function step<T>(work: (invocation: ExternalMcpEventInvocation) => T | Promise<T>, effect = false): Promise<T> {
      if (closing) fail("ABORTED");
      admit(time);
      let started = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let stop: (() => void) | undefined;
      const deadline = new AbortController();
      const signal = AbortSignal.any([time.signal,deadline.signal]);
      const stageEnd = Math.min(time.end,performance.now()+callbackMs);
      const stageDeadlineMs = Date.now()+Math.max(0,stageEnd-performance.now());
      try {
        const operation = Promise.resolve().then(() => {
          if (closing) fail("ABORTED");
          admit(time); started = true;
          if (performance.now() >= stageEnd) fail("DEADLINE");
          return work({signal,deadlineMs:stageDeadlineMs});
        });
        pendingOperations.add(operation);
        void operation.then(() => pendingOperations.delete(operation),() => pendingOperations.delete(operation));
        const result = await Promise.race([
          operation,
          new Promise<never>((_resolve,reject) => {
            timer = setTimeout(() => { deadline.abort(); reject(new ExternalMcpEventError("DEADLINE")); },Math.max(1,stageEnd-performance.now()));
            stop = () => reject(new ExternalMcpEventError("ABORTED"));
            time.signal.addEventListener("abort",stop,{once:true});
            if (time.signal.aborted) stop();
          }),
        ]);
        if (performance.now() >= stageEnd) { deadline.abort(); fail("DEADLINE"); }
        admit(time); return result;
      } catch (error) {
        if (error instanceof ExternalMcpEventError && error.code === "SUBSCRIPTION_CHANGED") throw error;
        if (effect && started) fail("OUTCOME_UNKNOWN");
        if (error instanceof ExternalMcpEventError || error instanceof McpEventInputError) throw error;
        return fail("UNAVAILABLE");
      } finally {
        if (timer) clearTimeout(timer);
        if (stop) time.signal.removeEventListener("abort",stop);
      }
    }
    const runtime: ProtocolRuntime = {
      definitions,
      async ownerKey(auth: AuthInfo) {
        const owner = await step(() => options.ownerKey(auth));
        if (typeof owner !== "string" || !owner.trim() || Buffer.byteLength(owner) > 256) fail("UNAVAILABLE");
        return owner;
      },
      async list(ownerKey) {
        const allowed = [];
        for (const definition of definitions) {
          if (await step(() => options.authorize({ownerKey,name:definition.name,arguments:{},phase:"list"})) !== true) continue;
          if (definition.listWire) {
            const wire = await step(() => definition.listWire!(ownerKey,definition.wire));
            if (wire) allowed.push(checkedListWire(definition,wire));
          } else allowed.push(definition.wire);
        }
        return allowed;
      },
      validateSubscription(params) { return validateMcpEventSubscription(definitions,params); },
      async subscribe(ownerKey,params) {
        admit(time);
        const valid = runtime.validateSubscription(params);
        const suppliedTtl = (params as Record<string,unknown>).ttlMs;
        if (suppliedTtl !== undefined && suppliedTtl !== null && (!Number.isSafeInteger(suppliedTtl) || Number(suppliedTtl) <= 0)) throw new McpEventInputError(-32602,"invalid_ttl");
        const ttlMs = Math.min(typeof suppliedTtl === "number" ? suppliedTtl : 86400000,86400000);
        const arguments_ = copy(valid.arguments) as Readonly<Record<string,unknown>>;
        const id = mcpEventSubscriptionIdentity(ownerKey,valid.definition.name,arguments_,valid.url);
        const identity = Object.freeze({id,ownerKey,name:valid.definition.name,arguments:arguments_,url:valid.url});
        const snapshot = observed(await step((context) => options.lifecycle.observe(identity,context)),identity);
        const phase = snapshot.active ? "refresh" : "subscribe";
        const authorize = async () => {
          if (await step(() => options.authorize({ownerKey,name:identity.name,arguments:arguments_,phase})) !== true) throw new McpEventInputError(-32602,"capability_not_found");
        };
        await authorize(); // No outbound challenge precedes current business authority.
        await step(() => verifyMcpEventCallback(valid.url,valid.secret,id,Date.now(),webhookPost));
        await authorize();
        const rawActivation = await step((context) => options.lifecycle.activate(Object.freeze({
          ...identity,expectedRevision:snapshot.revision,intent:snapshot.active ? "renew" : "new",secret:valid.secret,ttlMs,
        }),context),true);
        let activation: ExternalMcpEventActivation;
        try { activation = copy(rawActivation) as ExternalMcpEventActivation; }
        catch { fail("OUTCOME_UNKNOWN"); }
        if (!activation || activation.id !== id || !token(activation.revision) || !token(activation.generation) ||
          !epoch(activation.observedAt) || activation.observedAt < snapshot.observedAt || !epoch(activation.expiresAt) || activation.expiresAt <= activation.observedAt ||
          activation.expiresAt-activation.observedAt > ttlMs || activation.revision === snapshot.revision ||
          (snapshot.active ? activation.generation !== snapshot.generation : activation.generation === snapshot.generation)) fail("OUTCOME_UNKNOWN");
        return {id,refreshBefore:new Date(activation.expiresAt).toISOString(),cursor:null,truncated:false};
      },
      async unsubscribe(ownerKey,params) {
        admit(time);
        const valid = validateMcpEventUnsubscribe(definitions,params);
        const arguments_ = copy(valid.arguments) as Readonly<Record<string,unknown>>;
        const id = mcpEventSubscriptionIdentity(ownerKey,valid.definition.name,arguments_,valid.url);
        await step((context) => options.lifecycle.revoke(Object.freeze({id,ownerKey,name:valid.definition.name,arguments:arguments_,url:valid.url}),context),true);
      },
      async publish() { fail("EXTERNAL_PUBLICATION_REQUIRES_CAPTURE"); },
      async ready() { try { return await step(() => options.health()) === true; } catch { return false; } },
    };
    return Object.freeze(runtime);
  }
  // Unbound calls are for bounded readiness/diagnostics. RPC uses one shared invocation clock.
  const unbound: ProtocolRuntime = {
    definitions,
    ownerKey: (auth) => bound(makeClock()).ownerKey(auth),
    list: (owner) => bound(makeClock()).list(owner),
    validateSubscription: (params) => validateMcpEventSubscription(definitions,params),
    subscribe: (owner,params) => bound(makeClock()).subscribe(owner,params),
    unsubscribe: (owner,params) => bound(makeClock()).unsubscribe(owner,params),
    publish: async () => fail("EXTERNAL_PUBLICATION_REQUIRES_CAPTURE"),
    ready: () => bound(makeClock()).ready(),
  };
  return Object.freeze({...unbound,
    forInvocation(invocation:ExternalMcpEventInvocation) {
      if (closing) fail("ABORTED");
      return bound(makeClock(invocation));
    },
    async settle(input?:ExternalMcpEventInvocation) {
      closing = true;
      const controller = new AbortController();
      if(input&&(!input.signal||!Number.isFinite(input.deadlineMs)))return false;
      const duration=Math.max(0,Math.min(10000,input?input.deadlineMs-Date.now():10000));
      const end=performance.now()+duration;
      const invocation = {signal:controller.signal,deadlineMs:input?Math.min(input.deadlineMs,Date.now()+duration):Date.now()+duration};
      const abort=()=>controller.abort();input?.signal.addEventListener('abort',abort,{once:true});
      if(input?.signal.aborted||duration===0)controller.abort();
      let timer: ReturnType<typeof setTimeout> | undefined,stopJoin:(()=>void)|undefined;
      try {
        const settled=await Promise.race([
          Promise.all([
            Promise.allSettled(pendingOperations),
            Promise.resolve().then(() => options.lifecycle.settle ? options.lifecycle.settle(invocation) : true),
          ]).then(([,adapterSettled]) => adapterSettled === true, () => false),
          new Promise<false>((resolve) => {
            stopJoin=()=>resolve(false);controller.signal.addEventListener('abort',stopJoin,{once:true});
            timer=setTimeout(()=>{controller.abort();resolve(false);},duration);
            if(controller.signal.aborted)stopJoin();
          }),
        ]);
        if(!settled||controller.signal.aborted||performance.now()>=end){controller.abort();return false;}
        return settled;
      } finally { if (timer) clearTimeout(timer);input?.signal.removeEventListener('abort',abort);if(stopJoin)controller.signal.removeEventListener('abort',stopJoin); }
    },
  });
}

