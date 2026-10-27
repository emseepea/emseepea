import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { StringDecoder } from "node:string_decoder";
import { ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { parseTraceParent, W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const timestamp = () => performance.timeOrigin + performance.now();
const getter = { keys: (carrier) => Object.keys(carrier), get: (carrier, key) => carrier[key] };
const protocols = new Set(["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07"]);
const observedProtocol = (value) => value === undefined ? "absent"
  : typeof value !== "string" ? "invalid-type" : protocols.has(value) ? value : "_OTHER";

// Use the configured standard parser, but retain no carrier values or baggage.
function carriers(source) {
  const bounded = {};
  const fields = {};
  for (const name of ["traceparent", "tracestate"]) {
    const value = source?.[name];
    fields[name] = value === undefined ? "absent"
      : typeof value !== "string" ? "invalid-type" : value.length > 512 ? "oversize" : "present";
    if (fields[name] === "present") bounded[name] = value;
  }
  const parent = bounded.traceparent ? parseTraceParent(bounded.traceparent) : null;
  if (fields.traceparent === "present") fields.traceparent = parent ? "valid" : "invalid";
  if (fields.tracestate === "present") {
    const context = new W3CTraceContextPropagator().extract(ROOT_CONTEXT, bounded, getter);
    const accepted = trace.getSpanContext(context)?.traceState?.serialize();
    fields.tracestate = !parent ? "unused-without-valid-parent" : accepted ? "accepted" : "ignored";
  }
  return { fields, parent };
}

/** Synthetic discovery fixture, not a production instrumentation API. */
export async function startTelemetryProbe({ runId, authentication, endpoint, port = 0, provenance = "controlled-local" }) {
  z.string().uuid().parse(runId);
  z.enum(["controlled-local", "native-pending"]).parse(provenance);
  if (!authentication) throw new Error("The probe requires an explicit test authenticator");
  const storage = new AsyncLocalStorage();
  const states = new WeakMap();
  const records = [];
  let overflow = false;
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 600_000 });
  const provider = new MeterProvider({ readers: [reader] });
  const meter = provider.getMeter("emseepea.chatgpt.probe");
  const count = meter.createCounter("emseepea.probe.operations", { unit: "{operation}" });
  const duration = meter.createHistogram("emseepea.probe.operation.duration", { unit: "s" });

  const app = createEmseepea({
    name: "emseepea-otel-chatgpt-probe", version: "0.0.1", authentication,
    tools: [defineTool({
      name: "observe-telemetry", access: "protected", requiredScopes: ["feedback"],
      description: "Run one synthetic telemetry compatibility observation. Use only the supplied test run ID.",
      inputSchema: z.object({ runId: z.string().uuid(), mode: z.enum(["immediate", "awaited"]) }),
      outputSchema: z.object({ observed: z.boolean(), mode: z.enum(["immediate", "awaited"]) }),
      async handler(input, context) {
        const state = storage.getStore();
        if (!state || input.runId !== runId) throw new Error("Unknown synthetic probe run");
        state.mode = input.mode;
        state.authenticatedClientSha256 = digest(context.principal.clientId);
        state.handlerStartedAtMs = timestamp();
        if (input.mode === "awaited") await delay(25, undefined, { signal: context.signal });
        state.handlerReturnedAtMs = timestamp();
        return { data: { observed: true, mode: input.mode } };
      },
    })],
  });

  app.addHook("onRequest", (request, reply, done) => {
    const state = { httpReceivedAtMs: timestamp() };
    states.set(request.raw, state);
    storage.run(state, done);
  });
  app.addHook("preValidation", (request, reply, done) => {
    const body = request.body;
    const state = states.get(request.raw);
    if (body?.method === "tools/call" && body.params?.name === "observe-telemetry") {
      state.operationReceivedAtMs = timestamp();
      state.protocols = { httpHeader: observedProtocol(request.headers["mcp-protocol-version"]),
        mcpMeta: observedProtocol(body.params._meta?.["io.modelcontextprotocol/protocolVersion"]) };
      state.requestIdSha256 = digest(JSON.stringify(body.id));
      const http = carriers(request.headers);
      const meta = carriers(body.params._meta);
      state.carriers = { http: http.fields, meta: meta.fields,
        sameValidParent: http.parent && meta.parent
          ? http.parent.traceId === meta.parent.traceId && http.parent.spanId === meta.parent.spanId : null };
      // Hash only the declared synthetic fixture call, not arbitrary metadata.
      state.fixtureRequestSha256 = digest(JSON.stringify({ method: body.method,
        target: body.params.name, runId: body.params.arguments?.runId, mode: body.params.arguments?.mode }));
    }
    done();
  });

  // Observe the actual result frame accepted by ServerResponse.write/end. A
  // handler's return and the later HTTP finish are separate observations.
  // Buffering is private to this tiny synthetic fixture; no response is changed.
  app.server.prependListener("request", (request, response) => {
    if (request.url !== "/mcp") return;
    let buffer = "";
    let oversized = false;
    let byteCount = 0;
    const decoder = new StringDecoder("utf8");
    const observe = (chunk, emittedAtMs) => {
      const state = states.get(request);
      if (!state?.mode || state.resultEmittedAtMs || oversized || !chunk) return;
      const bytes = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      byteCount += bytes.byteLength;
      if (byteCount > 16_384) { buffer = ""; oversized = true; return; }
      buffer += decoder.write(bytes);
      let message;
      try { message = JSON.parse(buffer); }
      catch { return; } // A fragmented frame is not yet a result emission.
      {
        if (!message || typeof message !== "object" || !Object.hasOwn(message, "id") || digest(JSON.stringify(message.id)) !== state.requestIdSha256
          || (!Object.hasOwn(message, "result") && !Object.hasOwn(message, "error"))) return;
        state.resultEmittedAtMs = emittedAtMs;
        state.wireMode = "json";
        state.responseSha256 = digest(JSON.stringify(message));
        state.outcome = message.error || message.result?.isError ? "error" : "success";
        count.add(1, { mode: state.mode });
        duration.record((state.resultEmittedAtMs - state.operationReceivedAtMs) / 1_000, { mode: state.mode });
        buffer = "";
      }
    };
    const write = response.write;
    response.write = function (...args) {
      const emittedAtMs = timestamp();
      const accepted = Reflect.apply(write, this, args);
      observe(args[0], emittedAtMs);
      return accepted;
    };
    const end = response.end;
    response.end = function (...args) {
      const emittedAtMs = timestamp();
      const result = Reflect.apply(end, this, args);
      observe(args[0], emittedAtMs);
      return result;
    };
    response.once("finish", () => {
      const state = states.get(request);
      if (!state?.mode) return;
      state.httpFinishedAtMs = timestamp();
      queueMicrotask(() => {
        if (records.length === 16) { overflow = true; return; }
        records.push({ sequence: records.length + 1, runId, provenance,
          endpointSha256: endpoint ? digest(endpoint.href) : null,
          method: "tools/call", target: "observe-telemetry", mode: state.mode,
          wireMode: state.wireMode ?? "unknown", authenticatedClientSha256: state.authenticatedClientSha256,
          observedAt: new Date().toISOString(), carriers: state.carriers,
          protocols: state.protocols,
          fixtureRequestSha256: state.fixtureRequestSha256,
          responseSha256: state.responseSha256 ?? null, outcome: state.outcome ?? "incomplete",
          boundaries: {
            httpReceivedAtMs: state.httpReceivedAtMs, operationReceivedAtMs: state.operationReceivedAtMs,
            handlerStartedAtMs: state.handlerStartedAtMs, handlerReturnedAtMs: state.handlerReturnedAtMs,
            resultEmittedAtMs: state.resultEmittedAtMs ?? null, httpFinishedAtMs: state.httpFinishedAtMs,
          },
        });
      });
    });
  });

  const running = await serveEmseepea(app, { host: "127.0.0.1", port });
  let closing;
  const evidence = async () => {
    await provider.forceFlush();
    return { schemaVersion: 1, nativeStatus: "UNKNOWN", overflow,
      measurement: "parsed-operation-receipt-to-corresponding-result-frame-emission",
      records: structuredClone(records),
      // Keep only the probe instruments and their bounded observations, not
      // resource detectors, SDK internals or arbitrary instrumentation scopes.
      metrics: exporter.getMetrics().map((batch) => ({ scopeMetrics: batch.scopeMetrics
        .filter(({ scope }) => scope.name === "emseepea.chatgpt.probe")
        .map((scope) => ({ metrics: scope.metrics
          .filter(({ descriptor }) => ["emseepea.probe.operations", "emseepea.probe.operation.duration"].includes(descriptor.name))
          .map((metric) => ({ descriptor: { name: metric.descriptor.name, unit: metric.descriptor.unit },
            dataPoints: metric.dataPoints.map((point) => ({ attributes: { mode: point.attributes.mode },
              value: structuredClone(point.value), startTime: point.startTime, endTime: point.endTime })) })) })) })) };
  };
  return {
    url: running.url,
    evidence,
    close() {
      return closing ??= (async () => {
        await running.close();
        try { return await evidence(); }
        finally { await provider.shutdown(); }
      })();
    },
  };
}
