import { metrics, SpanKind, trace } from "@opentelemetry/api";
import type { FastifyInstance } from "fastify";

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

export interface ObservabilityEvent {
  readonly type: "mcp.request";
  readonly method: ObservedMcpMethod;
  readonly capability?: string;
  readonly httpMethod: ObservedHttpMethod;
  readonly statusCode: number;
  readonly outcome: "finished" | "disconnected";
  readonly durationMs: number;
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

export function openTelemetry(): ObservabilityAdapter {
  const tracer = trace.getTracer("@emseepea/server");
  const meter = metrics.getMeter("@emseepea/server");
  const calls = meter.createCounter("emseepea.http.requests", { unit: "{request}" });
  const duration = meter.createHistogram("emseepea.http.response.duration", { unit: "s" });
  return Object.freeze({
    id: "opentelemetry",
    emit(event: ObservabilityEvent) {
      const attributes = {
        "mcp.method": event.method,
        ...(event.capability ? { "mcp.capability.name": event.capability } : {}),
        "http.request.method": event.httpMethod,
        "http.response.status_code": event.statusCode,
        "emseepea.transport.outcome": event.outcome,
      };
      const span = tracer.startSpan("mcp.request", { kind: SpanKind.SERVER });
      span.setAttributes(attributes);
      calls.add(1, attributes);
      duration.record(event.durationMs / 1_000, attributes);
      span.end();
    },
  });
}

export function installObservability(
  app: FastifyInstance,
  adapters: readonly ObservabilityAdapter[],
  capabilityName: (body: unknown) => string | undefined,
  limits: { deliveryTimeoutMs: number },
): (timeoutMs: number) => Promise<void> {
  const pending = new Set<Promise<void>>();

  app.addHook("onRequest", (request, reply, done) => {
    if (request.routeOptions.url !== "/mcp") { done(); return; }
    const started = performance.now();
    let ended = false;
    const finish = () => end(reply.raw.destroyed || reply.raw.socket?.destroyed ? "disconnected" : "finished");
    const close = () => end("disconnected");
    function end(outcome: "finished" | "disconnected"): void {
      if (ended) return;
      ended = true;
      reply.raw.off("finish", finish);
      reply.raw.off("close", close);
      const body = request.body;
      const method = body && typeof body === "object" && "method" in body ? body.method : undefined;
      const capability = capabilityName(body);
      const status = reply.raw.statusCode;
      const event = Object.freeze({
        type: "mcp.request" as const,
        method: (typeof method === "string" && methods.has(method) ? method : "_OTHER") as ObservedMcpMethod,
        ...(capability ? { capability } : {}),
        httpMethod: (httpMethods.has(request.method) ? request.method : "_OTHER") as ObservedHttpMethod,
        statusCode: reply.raw.headersSent && Number.isInteger(status) && status >= 100 && status <= 599
          ? status
          : 0,
        outcome,
        durationMs: Math.min(3_600_000, Math.max(0, performance.now() - started)),
      });
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
    done();
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
