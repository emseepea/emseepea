import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { McpEventDefinition } from "./events.js";
export { postgresEventCaptureMigrations, migratePostgresEventCapture } from "./events-postgres-migrations.js";
export {
  createPostgresEventDelivery,
  createPostgresEventDeliveryMigrator,
  PostgresEventDeliveryMigrationError,
  type PostgresEventDelivery,
  type PostgresEventDeliveryOptions,
  type PostgresEventDeliveryOutcome,
} from "./events-postgres-delivery.js";
export {
  createPostgresEventDispatchMigrator,
  PostgresEventDispatchMigrationError,
} from "./events-postgres-dispatch-migrations.js";

export interface PostgresEventClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string, values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly Row[]; readonly rowCount: number | null }>;
}
export interface PostgresEventInvocation {
  readonly signal: AbortSignal;
  /** Absolute Unix time in milliseconds. The operation also applies its own shorter maximum duration. */
  readonly deadlineMs: number;
}
export interface PostgresSourcePublication {
  readonly sourceEventId: string;
  readonly sourceVersion: string;
  readonly eventName: string;
  readonly ownerKey: string;
  readonly occurredAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}
declare const transactionBrand: unique symbol;
export interface PostgresEventTransaction { readonly [transactionBrand]: true }
export interface PostgresCaptureOutcome {
  readonly outcome: "captured" | "replayed";
  readonly eventId: string;
  readonly deliveryCount: number;
  readonly eligibilityAt: string;
}
export type PostgresEventCaptureErrorCode = "INVALID_INPUT" | "ABORTED" | "DEADLINE" |
  "OUTCOME_UNKNOWN" | "TRANSACTION_NOT_BOUND" | "TRANSACTION_CHANGED" |
  "UNSUPPORTED_TRANSACTION_POLICY" | "CONCURRENT_USE" | "PUBLICATION_CONFLICT" |
  "WHOLE_TRANSACTION_RETRY_REQUIRED" | "UNAVAILABLE";
export class PostgresEventCaptureError extends Error {
  constructor(readonly code: PostgresEventCaptureErrorCode) { super(code); this.name = "PostgresEventCaptureError"; }
}
function fail(code: PostgresEventCaptureErrorCode): never { throw new PostgresEventCaptureError(code); }
function checkedText(value: unknown): string {
  if (typeof value !== "string" || /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) fail("INVALID_INPUT");
  return value;
}
function identifier(value: unknown): string {
  const text = checkedText(value);
  if (!text || Buffer.byteLength(text) > 240) fail("INVALID_INPUT");
  return text;
}
function ownValues(value: unknown, array = false): Record<string, PropertyDescriptor> {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) fail("INVALID_INPUT");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") fail("INVALID_INPUT");
    const property = descriptors[key];
    if (!property || !("value" in property) || (!property.enumerable && !(array && key === "length"))) fail("INVALID_INPUT");
    checkedText(key);
  }
  return descriptors;
}
function canonical(value: unknown, depth = 0): unknown {
  if (depth > 32) fail("INVALID_INPUT");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return checkedText(value);
  if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return value;
  if (Array.isArray(value)) {
    const fields = ownValues(value, true);
    if (Reflect.ownKeys(fields).length !== value.length + 1) fail("INVALID_INPUT");
    const result: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      if (!Object.hasOwn(fields, String(i))) fail("INVALID_INPUT");
      result.push(canonical(fields[String(i)]!.value, depth + 1));
    }
    return result;
  }
  const fields = ownValues(value);
  const result: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(fields).sort()) result[key] = canonical(fields[key]!.value, depth + 1);
  return result;
}
function freezeJson(value: unknown): void {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
interface Clock { readonly signal: AbortSignal; readonly end: number }
function clock(invocation: PostgresEventInvocation): Clock {
  if (!invocation?.signal || !Number.isFinite(invocation.deadlineMs)) fail("INVALID_INPUT");
  if (invocation.signal.aborted) fail("ABORTED");
  const remaining = Math.min(4000, invocation.deadlineMs - Date.now());
  if (remaining <= 0) fail("DEADLINE");
  return { signal: invocation.signal, end: performance.now() + remaining };
}
function check(time: Clock, sent = false): void {
  if (time.signal.aborted || performance.now() >= time.end) fail(sent ? "OUTCOME_UNKNOWN" : time.signal.aborted ? "ABORTED" : "DEADLINE");
}
interface Identity extends Record<string, unknown> {
  readonly backend: string; readonly xid: string; readonly isolation: string;
  readonly statement_ms: string; readonly lock_ms: string;
}
interface Binding extends Identity {
  readonly client: PostgresEventClient; readonly namespace: string;
  active: boolean; invalid: boolean;
}
const IDENTITY = `SELECT pg_catalog.pg_backend_pid()::pg_catalog.text AS backend,pg_catalog.pg_current_xact_id()::pg_catalog.text AS xid,
 pg_catalog.current_setting('transaction_isolation') AS isolation,
 (SELECT setting::pg_catalog.int8 FROM pg_catalog.pg_settings WHERE name OPERATOR(pg_catalog.=) 'statement_timeout') AS statement_ms,
 (SELECT setting::pg_catalog.int8 FROM pg_catalog.pg_settings WHERE name OPERATOR(pg_catalog.=) 'lock_timeout') AS lock_ms`;
const GUARD = `WITH guard AS MATERIALIZED (SELECT
 pg_catalog.pg_backend_pid()::pg_catalog.text OPERATOR(pg_catalog.=) $1 AND pg_catalog.pg_current_xact_id()::pg_catalog.text OPERATOR(pg_catalog.=) $2
 AND pg_catalog.current_setting('transaction_isolation') OPERATOR(pg_catalog.=) $3
 AND (pg_catalog.current_setting('transaction_isolation') OPERATOR(pg_catalog.=) 'repeatable read' OR pg_catalog.current_setting('transaction_isolation') OPERATOR(pg_catalog.=) 'serializable')
 AND (SELECT setting::pg_catalog.int8 FROM pg_catalog.pg_settings WHERE name OPERATOR(pg_catalog.=) 'statement_timeout') OPERATOR(pg_catalog.>=) 1
 AND (SELECT setting::pg_catalog.int8 FROM pg_catalog.pg_settings WHERE name OPERATOR(pg_catalog.=) 'statement_timeout') OPERATOR(pg_catalog.<=) 1500
 AND (SELECT setting::pg_catalog.int8 FROM pg_catalog.pg_settings WHERE name OPERATOR(pg_catalog.=) 'lock_timeout') OPERATOR(pg_catalog.>=) 1
 AND (SELECT setting::pg_catalog.int8 FROM pg_catalog.pg_settings WHERE name OPERATOR(pg_catalog.=) 'lock_timeout') OPERATOR(pg_catalog.<=) 500
 AND $4::pg_catalog.text OPERATOR(pg_catalog.=) $5::pg_catalog.text AS valid)`;
const READ_SOURCE = `${GUARD} SELECT valid,
 (SELECT pg_catalog.jsonb_build_object('fingerprint',fingerprint,'eventId',event_id,'deliveryCount',recipient_count,
 'eligibilityAt',pg_catalog.to_char(eligibility_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
 FROM public.emseepea_event_sources WHERE namespace OPERATOR(pg_catalog.=) $5 AND source_kind OPERATOR(pg_catalog.=) $6 AND source_id OPERATOR(pg_catalog.=) $7) AS saved
 FROM guard`;
const TICK = `${GUARD} SELECT valid,pg_catalog.clock_timestamp() AS eligibility_at FROM guard`;
const CANDIDATES = `SELECT subscription_id,generation,arguments FROM public.emseepea_event_capture_subscriptions
 WHERE namespace OPERATOR(pg_catalog.=) $1 AND owner_key OPERATOR(pg_catalog.=) $2 AND event_name OPERATOR(pg_catalog.=) $3 AND active AND expires_at OPERATOR(pg_catalog.>) $4::pg_catalog.timestamptz
 ORDER BY subscription_id,generation`;
const SOURCE = `${GUARD}, written AS (
 INSERT INTO public.emseepea_event_sources(namespace,source_kind,source_id,source_version,fingerprint,event_id,
 owner_key,event_name,occurred_at,eligibility_at,recipient_count,payload)
 SELECT $5,$6,$7,$8,$9,$10,$11,$12,$13::pg_catalog.timestamptz,$14::pg_catalog.timestamptz,$15::pg_catalog.int4,$16::pg_catalog.jsonb
 FROM guard WHERE valid RETURNING source_id)
 SELECT valid,(SELECT pg_catalog.count(*)::pg_catalog.int4 FROM written) AS n FROM guard`;
const INTENTS = `${GUARD}, written AS (
 INSERT INTO public.emseepea_event_intents(namespace,source_kind,source_id,subscription_id,generation,delivery_id,event_id)
 SELECT $5,$6,$7,j.subscription_id,j.generation,j.delivery_id,$8 FROM guard,
 pg_catalog.jsonb_to_recordset($9::pg_catalog.jsonb) AS j(subscription_id pg_catalog.text,generation pg_catalog.text,delivery_id pg_catalog.text)
 WHERE valid RETURNING delivery_id)
 SELECT valid,(SELECT pg_catalog.count(*)::pg_catalog.int4 FROM written) AS n FROM guard`;
function policy(value: Identity | undefined): value is Identity {
  return !!value && typeof value.backend === "string" && typeof value.xid === "string"
    && ["repeatable read", "serializable"].includes(value.isolation)
    && Number(value.statement_ms) > 0 && Number(value.statement_ms) <= 1500
    && Number(value.lock_ms) > 0 && Number(value.lock_ms) <= 500;
}
function valid(row: Record<string, unknown> | undefined): asserts row is Record<string, unknown> {
  if (row?.valid !== true) fail("TRANSACTION_CHANGED");
}
function sqlError(error: unknown): never {
  if (error instanceof PostgresEventCaptureError) throw error;
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "40001" || code === "55P03") fail("WHOLE_TRANSACTION_RETRY_REQUIRED");
  if (code === "23505") fail("PUBLICATION_CONFLICT");
  fail("UNAVAILABLE");
}

/** Captures publication state only. It does not configure or deliver native Events.
 * Registered schemas and matchers must be side-effect-free and synchronous. A deadline
 * check cannot interrupt a matcher after it starts. The caller exclusively owns the
 * transaction. Ordinary deletion must retain deduplication identities. Administrative
 * ledger erasure is governed separately and is not provided by this capture-only API.
 */
export function createPostgresEventCapture(options: Readonly<{
  namespace: string; sourceKind: string; definitions: readonly McpEventDefinition[];
}>) {
  const namespace = identifier(options?.namespace);
  const sourceKind = identifier(options?.sourceKind);
  if (!Array.isArray(options.definitions) || !options.definitions.length) fail("INVALID_INPUT");
  const definitions = new Map<string, McpEventDefinition>();
  for (const definition of options.definitions) {
    identifier(definition?.name);
    if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/.test(definition.name) || definitions.has(definition.name) || typeof definition.matches !== "function" ||
      typeof definition.payloadSchema?.safeParse !== "function" || typeof definition.inputSchema?.safeParse !== "function") fail("INVALID_INPUT");
    definitions.set(definition.name, Object.freeze({ ...definition }));
  }
  const bindings = new WeakMap<PostgresEventTransaction, Binding>();
  async function query<Row extends Record<string, unknown>>(client: PostgresEventClient, time: Clock, sql: string, values?: readonly unknown[]) {
    check(time);
    const result = await client.query<Row>(sql, values);
    check(time, true); // A late response is not rollback/cancellation evidence.
    return result;
  }
  return Object.freeze({
    async bindTransaction(client: PostgresEventClient, invocation: PostgresEventInvocation): Promise<PostgresEventTransaction> {
      const time = clock(invocation);
      if (!client || typeof client.query !== "function") fail("INVALID_INPUT");
      try {
        const first = (await query<Identity>(client, time, IDENTITY)).rows[0];
        const second = (await query<Identity>(client, time, IDENTITY)).rows[0];
        if (!policy(first) || !policy(second)) fail("UNSUPPORTED_TRANSACTION_POLICY");
        if (first.backend !== second.backend || first.xid !== second.xid || first.isolation !== second.isolation) fail("TRANSACTION_NOT_BOUND");
        const handle = Object.freeze({}) as PostgresEventTransaction;
        bindings.set(handle, { ...second, client, namespace, active: false, invalid: false });
        return handle;
      } catch (error) { return sqlError(error); }
    },
    async captureInTransaction(handle: PostgresEventTransaction, publication: PostgresSourcePublication,
      invocation: PostgresEventInvocation): Promise<PostgresCaptureOutcome> {
      const state = handle && bindings.get(handle);
      if (!state || state.invalid) fail("TRANSACTION_NOT_BOUND");
      if (state.active) { state.invalid = true; fail("CONCURRENT_USE"); }
      state.active = true;
      try {
        const time = clock(invocation);
        const fields = ownValues(publication);
        const get = (key: string) => fields[key]?.value;
        const sourceId = identifier(get("sourceEventId"));
        const sourceVersion = identifier(get("sourceVersion"));
        const eventName = identifier(get("eventName"));
        const ownerKey = identifier(get("ownerKey"));
        const occurredAt = checkedText(get("occurredAt"));
        if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(occurredAt) || !Number.isFinite(Date.parse(occurredAt))
          || new Date(occurredAt).toISOString() !== occurredAt) fail("INVALID_INPUT");
        const definition = definitions.get(eventName);
        if (!definition) fail("INVALID_INPUT");
        const raw = get("data"); ownValues(raw);
        const rawCanonical = canonical(raw);
        if (Buffer.byteLength(JSON.stringify(rawCanonical)) > 262144) fail("INVALID_INPUT");
        freezeJson(rawCanonical);
        const parsedPayload = definition.payloadSchema.safeParse(rawCanonical);
        if (!parsedPayload.success) fail("INVALID_INPUT");
        ownValues(parsedPayload.data);
        const data = canonical(parsedPayload.data) as Record<string, unknown>;
        freezeJson(data);
        const body = JSON.stringify(data);
        if (Buffer.byteLength(body) > 262144) fail("INVALID_INPUT");
        const fingerprint = hash([namespace, sourceKind, sourceId, sourceVersion, eventName, ownerKey, occurredAt, data]);
        const base = [state.backend, state.xid, state.isolation, state.namespace, namespace];
        const existing = (await query(state.client, time, READ_SOURCE, [...base, sourceKind, sourceId])).rows[0]; valid(existing);
        if (existing.saved !== null) {
          const saved = existing.saved as { fingerprint: string; eventId: string; deliveryCount: number; eligibilityAt: string };
          if (saved.fingerprint !== fingerprint) fail("PUBLICATION_CONFLICT");
          return Object.freeze({ outcome: "replayed", eventId: saved.eventId, deliveryCount: saved.deliveryCount, eligibilityAt: saved.eligibilityAt });
        }
        const tick = (await query(state.client, time, TICK, base)).rows[0]; valid(tick);
        const eligibility = tick.eligibility_at;
        if (!(eligibility instanceof Date) || !Number.isFinite(eligibility.getTime())) fail("UNAVAILABLE");
        const candidates = (await query(state.client, time, CANDIDATES, [namespace, ownerKey, eventName, eligibility])).rows;
        const eventId = hash(["event", namespace, sourceKind, sourceId]);
        const recipients: { subscription_id: string; generation: string; delivery_id: string }[] = [];
        for (const candidate of candidates) {
          check(time);
          ownValues(candidate.arguments);
          const rawArguments = canonical(candidate.arguments);
          freezeJson(rawArguments);
          const parsedArguments = definition.inputSchema.safeParse(rawArguments);
          if (!parsedArguments.success) fail("INVALID_INPUT");
          ownValues(parsedArguments.data);
          const arguments_ = canonical(parsedArguments.data) as Record<string, unknown>;
          freezeJson(arguments_);
          const matches = definition.matches(arguments_, data, ownerKey);
          if (typeof matches !== "boolean") fail("INVALID_INPUT");
          if (matches) {
            const subscriptionId = identifier(candidate.subscription_id);
            const generation = identifier(candidate.generation);
            recipients.push({ subscription_id: subscriptionId, generation,
              delivery_id: hash(["delivery", eventId, subscriptionId, generation]) });
          }
        }
        const source = (await query(state.client, time, SOURCE, [...base, sourceKind, sourceId, sourceVersion,
          fingerprint, eventId, ownerKey, eventName, occurredAt, eligibility, recipients.length, body])).rows[0]; valid(source);
        if (source.n !== 1) fail("UNAVAILABLE");
        const intents = (await query(state.client, time, INTENTS, [...base, sourceKind, sourceId, eventId,
          JSON.stringify(recipients)])).rows[0]; valid(intents);
        if (intents.n !== recipients.length) fail("UNAVAILABLE");
        return Object.freeze({ outcome: "captured", eventId, deliveryCount: recipients.length, eligibilityAt: eligibility.toISOString() });
      } catch (error) { state.invalid = true; return sqlError(error); }
      finally { state.active = false; }
    },
  });
}
