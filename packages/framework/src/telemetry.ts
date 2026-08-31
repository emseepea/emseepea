import {
  context, isSpanContextValid, metrics, ROOT_CONTEXT, SpanKind, trace, TraceFlags,
} from "@opentelemetry/api";
import type { FastifyInstance } from "fastify";

const methods = new Set([
  "server/discover", "tools/list", "tools/call", "resources/list",
  "resources/templates/list", "resources/read", "prompts/list", "prompts/get",
  "completion/complete",
]);
const httpMethods = new Set(["POST", "GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"]);

// Telemetry failures must not affect protocol work. This does not isolate an
// adopter's blocking exporter or asynchronous errors outside these API calls.
function safely<T>(work: () => T): T | undefined {
  try { return work(); } catch { return undefined; }
}

export function installRequestTelemetry(app: FastifyInstance): void {
  const tracer = safely(() => trace.getTracer("@emseepea/server"));
  const meter = safely(() => metrics.getMeter("@emseepea/server"));
  const calls = safely(() => meter?.createCounter("emseepea.http.requests", { unit: "{request}" }));
  const duration = safely(() => meter?.createHistogram("emseepea.http.response.duration", { unit: "s" }));

  // SDK host/origin checks run first. Requests they reject are not measured.
  app.addHook("onRequest", (request, reply, done) => {
    if (request.routeOptions.url !== "/mcp") { done(); return; }
    const started = performance.now();
    const parentContext = safely(() => {
      const parent = trace.getSpanContext(context.active());
      return parent && isSpanContextValid(parent)
        ? trace.setSpanContext(ROOT_CONTEXT, {
            traceId: parent.traceId,
            spanId: parent.spanId,
            traceFlags: parent.traceFlags & TraceFlags.SAMPLED,
            isRemote: parent.isRemote === true,
          })
        : ROOT_CONTEXT;
    }) ?? ROOT_CONTEXT;
    const span = safely(() => tracer?.startSpan("mcp.request", { kind: SpanKind.SERVER }, parentContext));
    const requestContext = (span && safely(() => trace.setSpan(parentContext, span))) ?? parentContext;
    let ended = false;
    const finish = () => end(reply.raw.destroyed || reply.raw.socket?.destroyed ? "disconnected" : "finished");
    const close = () => end("disconnected");
    function end(outcome: "finished" | "disconnected"): void {
      if (ended) return;
      ended = true;
      reply.raw.off("finish", finish);
      reply.raw.off("close", close);
      const method = request.body && typeof request.body === "object" && "method" in request.body
        ? request.body.method : undefined;
      const status = reply.raw.statusCode;
      const attributes = {
        "mcp.method": typeof method === "string" && methods.has(method) ? method : "_OTHER",
        "http.request.method": httpMethods.has(request.method) ? request.method : "_OTHER",
        "http.response.status_code": reply.raw.headersSent && Number.isInteger(status) &&
          status >= 100 && status <= 599 ? status : 0,
        "emseepea.transport.outcome": outcome,
      };
      safely(() => span?.setAttributes(attributes));
      safely(() => calls?.add(1, attributes, requestContext));
      safely(() => duration?.record((performance.now() - started) / 1_000, attributes, requestContext));
      safely(() => span?.end());
    }
    reply.raw.once("finish", finish);
    reply.raw.once("close", close);
    let continued = false;
    const next = () => {
      if (continued) return;
      continued = true;
      done();
    };
    safely(() => context.with(requestContext, next));
    // A broken context manager may throw before or after calling next. The
    // guard is set before middleware runs, so fallback cannot replay it.
    next();
  });
}
