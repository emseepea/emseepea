import { context, isSpanContextValid, metrics, propagation, ROOT_CONTEXT, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { Context, Span, Tracer } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import type { FastifyInstance, FastifyRequest } from "fastify";

const methods = new Set<string>([
  "server/discover", "tools/list", "tools/call", "resources/list",
  "resources/templates/list", "resources/read", "prompts/list", "prompts/get",
  "completion/complete", "subscriptions/listen",
]);
const httpMethods = new Set<string>(["POST", "GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"]);

export type ObservedMcpMethod =
  | "server/discover" | "tools/list" | "tools/call" | "resources/list"
  | "resources/templates/list" | "resources/read" | "prompts/list" | "prompts/get"
  | "completion/complete" | "subscriptions/listen" | "_OTHER";
export type ObservedHttpMethod =
  | "POST" | "GET" | "HEAD" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "_OTHER";
export type ObservedProtocolOutcome = "success" | "tool_error" | "protocol_error" | "disconnected";

export interface CallerClassification {
  readonly id: string;
  readonly userAgentPrefix: string;
}

export interface ObservabilityState {
  protocolOutcome: Exclude<ObservedProtocolOutcome, "disconnected">;
  /** Internal cancellation provenance; never copied into completion events. */
  cancelled?: boolean;
  /**
   * Why a production forwarding check refused, when the reason is one the
   * operator needs and the caller must not be told (ADR-0102). The response
   * carries the same generic message either way.
   */
  forwardingRefusal?: ObservedForwardingRefusal;
}

/**
 * `hop-count-mismatch`: the header carried fewer entries than
 * `forwardedHops` declared, so no entry could be the client address.
 */
export type ObservedForwardingRefusal = "hop-count-mismatch";

const requestStates = new WeakMap<FastifyRequest, ObservabilityState>();

export interface ObservabilityEvent {
  readonly type: "mcp.request";
  readonly method: ObservedMcpMethod;
  readonly capability?: string;
  readonly httpMethod: ObservedHttpMethod;
  readonly statusCode: number;
  readonly outcome: "finished" | "disconnected";
  readonly protocolOutcome: ObservedProtocolOutcome;
  readonly callerClass?: string;
  readonly durationMs: number;
  /**
   * Present only on a refused production request whose forwarding metadata
   * failed for a reason the operator needs in order to fix a declaration
   * (ADR-0102). Absent on every other request, so an adapter that ignores it
   * behaves exactly as before.
   */
  readonly forwardingRefusal?: ObservedForwardingRefusal;
}

export interface ObservabilityAdapter {
  readonly id: string;
  readonly emit: (event: ObservabilityEvent) => void | Promise<void>;
  readonly flush?: () => void | Promise<void>;
}

export function structuredLogging(
  id: string,
  write: (event: ObservabilityEvent) => void | Promise<void>,
): ObservabilityAdapter {
  return Object.freeze({ id, emit: write });
}

// Normalization preserves emit identity while copying the public adapter.
// A public adapter ID must never grant access to the request lifecycle.
const requestTracers = new WeakMap<ObservabilityAdapter["emit"], { tracer: Tracer; useActiveSpan: boolean }>();
const requestEmissions = new WeakMap<ObservabilityEvent, { context: Context; timestamp: number }>();

function eventAttributes(event: ObservabilityEvent) {
  return {
    "mcp.method": event.method,
    ...(event.capability ? { "mcp.capability.name": event.capability } : {}),
    "http.request.method": event.httpMethod,
    "http.response.status_code": event.statusCode,
    "emseepea.protocol.outcome": event.protocolOutcome,
    "emseepea.transport.outcome": event.outcome,
    ...(event.callerClass ? { "emseepea.caller.class": event.callerClass } : {}),
  };
}

export function openTelemetry(options: {
  /** Emit safe completion records through the application's Logs API provider. Default: false. */
  readonly logs?: boolean;
  /** Use a valid active local span as the request parent. Default: true. */
  readonly useActiveSpan?: boolean;
  /** @deprecated Use useActiveSpan instead. Ignored when useActiveSpan is defined. */
  readonly httpInstrumentation?: boolean;
} = {}): ObservabilityAdapter {
  const tracer = trace.getTracer("@emseepea/server");
  const meter = metrics.getMeter("@emseepea/server");
  const logger = options.logs === true ? logs.getLogger("@emseepea/server") : undefined;
  const calls = meter.createCounter("emseepea.http.requests", { unit: "{request}" });
  const duration = meter.createHistogram("emseepea.http.response.duration", {
    unit: "s",
    advice: { explicitBucketBoundaries: [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10] },
  });
  const adapter = Object.freeze({
    id: "opentelemetry",
    emit(event: ObservabilityEvent) {
      const attributes = eventAttributes(event);
      const emission = requestEmissions.get(event);
      const emissionContext = emission?.context ?? ROOT_CONTEXT;
      try { calls.add(1, attributes, emissionContext); }
      catch { /* One signal cannot suppress another. */ }
      try { duration.record(event.durationMs / 1_000, attributes, emissionContext); }
      catch { /* One signal cannot suppress another. */ }
      try {
        logger?.emit({
          eventName: "mcp.request",
          body: "MCP HTTP request ended",
          severityNumber: SeverityNumber.INFO,
          severityText: "INFO",
          attributes,
          context: emissionContext,
          ...(emission ? { timestamp: emission.timestamp } : {}),
        });
      } catch { /* Logging cannot change protocol behaviour or other signals. */ }
    },
  });
  requestTracers.set(adapter.emit, { tracer, useActiveSpan: (options.useActiveSpan ?? options.httpInstrumentation ?? true) === true });
  return adapter;
}

function startRequestSpan(tracer: Tracer, request: FastifyRequest, startTime: number, useActiveSpan: boolean): { span: Span; context: Context } | undefined {
  let parent = ROOT_CONTEXT;
  let parentIdentity: { traceId: string; spanId: string } | undefined;
  let kind: SpanKind = SpanKind.SERVER;
  if (useActiveSpan) {
    try {
      const active = trace.getSpanContext(context.active());
      if (active && active.isRemote !== true) {
        // Import only validated local correlation identity, never ambient
        // baggage, traceState or other application context data.
        const local = { traceId: active.traceId, spanId: active.spanId, traceFlags: active.traceFlags, isRemote: false };
        if (isSpanContextValid(local) && Number.isInteger(local.traceFlags) && local.traceFlags >= 0 && local.traceFlags <= 255) {
          parent = trace.setSpanContext(ROOT_CONTEXT, local);
          parentIdentity = local;
          kind = SpanKind.INTERNAL;
        }
      }
    } catch { /* Unavailable application context falls back to HTTP extraction. */ }
  }
  if (kind === SpanKind.SERVER) {
    try {
      // Only tracing headers reach the configured propagator. In particular,
      // baggage, credentials and unrelated ambient context are excluded.
      const carrier: Record<string, string> = {};
      for (const name of ["traceparent", "tracestate"]) {
        const value = request.headers[name];
        if (typeof value === "string" && value.length <= 512) carrier[name] = value;
      }
      const extracted = trace.getSpanContext(propagation.extract(ROOT_CONTEXT, carrier));
      if (extracted && isSpanContextValid(extracted)) {
        parent = trace.setSpanContext(ROOT_CONTEXT, extracted);
        parentIdentity = { traceId: extracted.traceId, spanId: extracted.spanId };
      }
    } catch { /* A broken propagator must not prevent protocol execution. */ }
  }
  let span: Span;
  try {
    span = tracer.startSpan("mcp.request", { kind, startTime }, parent);
  } catch { return undefined; }
  let completionContext = ROOT_CONTEXT;
  try {
    const value = span.spanContext();
    // Log processors receive this context too. Exclude opaque traceState and
    // arbitrary provider properties, retaining only validated correlation data.
    const local = { traceId: value.traceId, spanId: value.spanId, traceFlags: value.traceFlags, isRemote: false };
    // A no-op tracer can return its parent unchanged. Unsampled local spans,
    // however, still have a new identity and remain useful for log correlation.
    if (value.isRemote !== true && isSpanContextValid(local)
      && Number.isInteger(local.traceFlags) && local.traceFlags >= 0 && local.traceFlags <= 255
      && !(parentIdentity?.traceId === local.traceId && parentIdentity.spanId === local.spanId)) {
      completionContext = trace.setSpanContext(ROOT_CONTEXT, local);
    }
  } catch { /* Invalid or broken span contexts produce uncorrelated records. */ }
  return { span, context: completionContext };
}

export function installObservability(
  app: FastifyInstance,
  adapters: readonly ObservabilityAdapter[],
  capabilityName: (body: unknown) => string | undefined,
  callerClassifications: readonly CallerClassification[] | undefined,
  limits: { deliveryTimeoutMs: number },
): (timeoutMs: number) => Promise<void> {
  const pending = new Set<Promise<void>>();
  const tracing = adapters.map((adapter) => requestTracers.get(adapter.emit)).find((value) => value !== undefined);

  app.addHook("onRequest", (request, reply, done) => {
    if (request.routeOptions.url !== "/mcp") { done(); return; }
    const state: ObservabilityState = { protocolOutcome: "success" };
    requestStates.set(request, state);
    const started = performance.now();
    const requestSpan = tracing ? startRequestSpan(tracing.tracer, request, performance.timeOrigin + started, tracing.useActiveSpan) : undefined;
    const span = requestSpan?.span;
    let ended = false;
    const finish = () => end(reply.raw.destroyed || reply.raw.socket?.destroyed ? "disconnected" : "finished");
    const close = () => end("disconnected");
    function end(outcome: "finished" | "disconnected"): void {
      if (ended) return;
      ended = true;
      const finished = performance.now();
      reply.raw.off("finish", finish);
      reply.raw.off("close", close);
      const body = request.body;
      const method = body && typeof body === "object" && "method" in body ? body.method : undefined;
      const capability = capabilityName(body);
      const status = reply.raw.statusCode;
      const statusCode = reply.raw.headersSent && Number.isInteger(status) && status >= 100 && status <= 599
        ? status
        : 0;
      const callerClass = classifyCaller(request.headers["user-agent"], callerClassifications);
      const event = Object.freeze({
        type: "mcp.request" as const,
        method: (typeof method === "string" && methods.has(method) ? method : "_OTHER") as ObservedMcpMethod,
        ...(capability ? { capability } : {}),
        httpMethod: (httpMethods.has(request.method) ? request.method : "_OTHER") as ObservedHttpMethod,
        statusCode,
        outcome,
        protocolOutcome: outcome === "disconnected"
          ? "disconnected"
          : state.protocolOutcome === "success" && statusCode >= 400
            ? "protocol_error"
            : state.protocolOutcome,
        ...(callerClass ? { callerClass } : {}),
        durationMs: Math.min(3_600_000, Math.max(0, finished - started)),
        ...(state.forwardingRefusal ? { forwardingRefusal: state.forwardingRefusal } : {}),
      });
      if (tracing) requestEmissions.set(event, {
        context: requestSpan?.context ?? ROOT_CONTEXT,
        timestamp: performance.timeOrigin + finished,
      });
      if (span) {
        try { span.setAttributes(eventAttributes(event)); }
        catch { /* Span decoration cannot change protocol behaviour. */ }
        const errorType = outcome !== "finished" ? undefined
          : statusCode >= 500 ? String(statusCode)
            : statusCode >= 400 ? undefined
              : event.protocolOutcome === "tool_error" && !state.cancelled ? "tool_error" : undefined;
        if (errorType) {
          try { span.setAttribute("error.type", errorType); }
          catch { /* Error attributes cannot suppress status or finalization. */ }
          try { span.setStatus({ code: SpanStatusCode.ERROR }); }
          catch { /* Status cannot suppress finalization or other signals. */ }
        }
        try { span.end(performance.timeOrigin + finished); }
        catch { /* Finalization is independent of adapter delivery. */ }
      }
      for (const adapter of adapters) {
        try {
          const delivery = bounded(
            Promise.resolve(adapter.emit(event)).catch(() => {}),
            limits.deliveryTimeoutMs,
          );
          pending.add(delivery);
          void delivery.finally(() => pending.delete(delivery));
        } catch { /* Observability cannot change protocol behaviour. */ }
      }
    }
    reply.raw.once("finish", finish);
    reply.raw.once("close", close);
    if (!span) { done(); return; }
    let continued = false;
    try {
      context.with(trace.setSpan(ROOT_CONTEXT, span), () => {
        continued = true;
        done();
      });
    } catch {
      // A context manager can throw before or after calling the continuation.
      // Never retry protocol work that has already started.
      if (!continued) done();
    }
  });

  return async (timeoutMs) => {
    await bounded(Promise.all(pending), timeoutMs);
    await Promise.all(adapters.map(async (adapter) => {
      if (!adapter.flush) return;
      try { await bounded(Promise.resolve().then(() => adapter.flush!()), timeoutMs); }
      catch { /* Every adapter gets an independent bounded flush opportunity. */ }
    }));
  };
}

function classifyCaller(
  userAgent: string | undefined,
  classifications: readonly CallerClassification[] | undefined,
): string | undefined {
  if (!classifications) return undefined;
  if (!userAgent || userAgent.length > 512) return "_OTHER";
  return classifications.find(({ userAgentPrefix }) => userAgent.startsWith(userAgentPrefix))?.id ?? "_OTHER";
}

export function observabilityState(request: FastifyRequest): ObservabilityState | undefined {
  return requestStates.get(request);
}

async function bounded(work: Promise<unknown>, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      work,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
