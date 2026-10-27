import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { context, metrics, propagation, ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { AlwaysOffSampler, InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import { logs as sdkLogs } from "@opentelemetry/sdk-node";
import { createEmseepea, defineStreamingTool, defineTool, openTelemetry, serveEmseepea, structuredLogging } from "@emseepea/server";
import { z } from "zod";

const secret = "request-logs-private-canary";
const remoteSpan = "0123456789abcdef";
const firstTrace = "1234567890abcdef1234567890abcdef";
const secondTrace = "abcdef1234567890abcdef1234567890";
const parent = (id, flags = "01") => `00-${id}-${remoteSpan}-${flags}`;
const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "logs-test", version: "1" },
  "io.modelcontextprotocol/clientCapabilities": {},
};
const allowed = ["emseepea.protocol.outcome", "emseepea.transport.outcome", "http.request.method", "http.response.status_code", "mcp.capability.name", "mcp.method"];

async function fixture(t, { enabled = true, defaultOptions = false, tracing = true, loggerProvider = true, sampler, fault, stripRemote = false, blockDelivery = false, streaming = false, brokenSpan = false } = {}) {
  const spans = new InMemorySpanExporter();
  const tracingSdk = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter: spans })], ...(sampler ? { sampler } : {}) });
  const logExport = new sdkLogs.InMemoryLogRecordExporter();
  const processorContexts = [];
  const logging = new sdkLogs.LoggerProvider({ processors: [
    { onEmit(_record, ctx) { processorContexts.push({ span: trace.getSpanContext(ctx ?? ROOT_CONTEXT), baggage: propagation.getBaggage(ctx ?? ROOT_CONTEXT) }); }, async forceFlush() {}, async shutdown() {} },
    new sdkLogs.SimpleLogRecordProcessor({ exporter: logExport }),
  ] });
  const metricExport = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const metering = new MeterProvider({ readers: [new PeriodicExportingMetricReader({ exporter: metricExport, exportIntervalMillis: 600_000 })] });
  const metricContexts = [];
  const manager = new AsyncLocalStorageContextManager();
  assert.equal(context.setGlobalContextManager(manager.enable()), true);
  const propagator = new W3CTraceContextPropagator();
  assert.equal(propagation.setGlobalPropagator(stripRemote ? {
    fields: () => propagator.fields(), inject: (...args) => propagator.inject(...args),
    extract(...args) {
      const sc = trace.getSpanContext(propagator.extract(...args));
      return sc ? trace.setSpanContext(ROOT_CONTEXT, { traceId: sc.traceId, spanId: sc.spanId, traceFlags: sc.traceFlags }) : ROOT_CONTEXT;
    },
  } : propagator), true);
  if (tracing) assert.equal(trace.setGlobalTracerProvider(brokenSpan ? {
    getTracer: () => ({ startSpan: () => ({ spanContext() { throw new Error(secret); }, setAttributes() {}, end() {} }) }),
  } : tracingSdk), true);
  assert.equal(metrics.setGlobalMeterProvider({ getMeter(...args) {
    const delegate = metering.getMeter(...args);
    if (args[0] !== "@emseepea/server") return delegate;
    return {
      createCounter(...options) { const instrument = delegate.createCounter(...options); return { add(value, attributes, ctx) {
        metricContexts.push(trace.getSpanContext(ctx ?? ROOT_CONTEXT));
        if (fault === "counter") throw new Error(secret);
        instrument.add(value, attributes, ctx);
      } }; },
      createHistogram(...options) { const instrument = delegate.createHistogram(...options); return { record(value, attributes, ctx) {
        metricContexts.push(trace.getSpanContext(ctx ?? ROOT_CONTEXT));
        if (fault === "histogram") throw new Error(secret);
        instrument.record(value, attributes, ctx);
      } }; },
    };
  } }), true);
  if (loggerProvider) logs.setGlobalLoggerProvider(fault === "logger" ? { getLogger: () => ({ emit() { throw new Error(secret); } }) } : logging);
  const events = [];
  const waiters = [];
  let running;
  let calls = 0;
  const handlerContexts = [];
  t.after(async () => {
    if (running) await running.close();
    await Promise.all([tracingSdk.shutdown(), logging.shutdown(), metering.shutdown()]);
    trace.disable(); metrics.disable(); logs.disable(); propagation.disable(); context.disable();
  });
  const definition = {
    name: "echo", access: "public", description: "Echo a synthetic value.", inputSchema: z.object({ value: z.string() }),
    ...(!streaming ? { outputSchema: z.object({ value: z.string() }) } : {}),
    async handler({ value }, { signal, reportProgress }) {
      calls += 1;
      handlerContexts.push(trace.getActiveSpan()?.spanContext());
      if (streaming) {
        await reportProgress({ progress: 1, total: 1 });
        if (value === "disconnect") await delay(2_000, undefined, { signal });
        return { content: [{ type: "text", text: secret }] };
      }
      if (value === "tool-error") return { content: [{ type: "text", text: secret }], isError: true };
      if (brokenSpan) return { data: { value } };
      return trace.getTracer("logs-test.backend").startActiveSpan("backend.read", async (span) => {
        try { await delay(value.endsWith("slow") ? 20 : 2); return { data: { value } }; }
        finally { span.end(); }
      });
    },
  };
  const adapter = defaultOptions ? openTelemetry() : openTelemetry({ logs: enabled });
  running = await serveEmseepea(createEmseepea({ name: "request-logs", version: "1", tools: [streaming ? defineStreamingTool(definition) : defineTool(definition)], observability: [
    structuredLogging("completion", (event) => {
      events.push(event);
      if (blockDelivery) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
      for (const waiter of waiters) if (events.length >= waiter.count) waiter.resolve();
    }), adapter,
  ] }), { port: 0 });
  return {
    running, adapter, spans, logExport, processorContexts, metricContexts, handlerContexts, events,
    calls: () => calls,
    completed(count) { return events.length >= count ? Promise.resolve() : new Promise((resolve) => waiters.push({ count, resolve })); },
    async flush() { await Promise.all([logging.forceFlush(), metering.forceFlush(), tracingSdk.forceFlush()]); },
    points(name) { return metricExport.getMetrics().at(-1)?.scopeMetrics.flatMap((s) => s.metrics).find((m) => m.descriptor.name === name)?.dataPoints ?? []; },
  };
}

function call(url, { value = secret, traceparent = parent(firstTrace), progress = false, signal } = {}) {
  return fetch(url, { method: "POST", signal, headers: {
    Accept: "application/json, text/event-stream", "Content-Type": "application/json",
    "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call", "Mcp-Name": "echo",
    Authorization: `Bearer ${secret}`, traceparent, tracestate: "vendor=opaque-private-state", baggage: `private=${secret}`,
  }, body: JSON.stringify({ jsonrpc: "2.0", id: secret, method: "tools/call", params: {
    name: "echo", arguments: { value }, _meta: { ...meta, ...(progress ? { progressToken: "progress" } : {}) },
  } }) });
}

function checkRecord(record) {
  assert.equal(record.eventName, "mcp.request"); assert.equal(record.body, "MCP HTTP request ended");
  assert.equal(record.severityNumber, 9); assert.equal(record.severityText, "INFO");
  assert.deepEqual(Object.keys(record.attributes).sort(), allowed);
  assert.doesNotMatch(JSON.stringify({ body: record.body, attributes: record.attributes, spanContext: record.spanContext }), new RegExp(secret + "|opaque-private-state"));
}

test("concurrent completion logs retain local request identity and completion time across delayed delivery", async (t) => {
  const f = await fixture(t, { blockDelivery: true });
  const responses = await Promise.all([
    call(f.running.url, { value: secret + "slow", traceparent: parent(firstTrace) }),
    call(f.running.url, { value: secret + "fast", traceparent: parent(secondTrace) }),
  ]);
  for (const response of responses) assert.equal(response.status, 200);
  await Promise.all(responses.map((r) => r.json())); await f.completed(2); await f.flush();
  const records = f.logExport.getFinishedLogRecords(); assert.equal(records.length, 2);
  const requests = f.spans.getFinishedSpans().filter((s) => s.name === "mcp.request"); assert.equal(requests.length, 2);
  for (const record of records) {
    checkRecord(record);
    const span = requests.find((s) => s.spanContext().spanId === record.spanContext.spanId); assert.ok(span);
    assert.equal(record.spanContext.traceId, span.spanContext().traceId);
    assert.notEqual(record.spanContext.spanId, remoteSpan);
    assert.deepEqual(record.hrTime, span.endTime, "timestamp belongs to completion before the slow adapter");
  }
  assert.deepEqual(new Set(records.map((r) => r.spanContext.traceId)), new Set([firstTrace, secondTrace]));
  for (const seen of f.processorContexts) { assert.equal(seen.baggage, undefined); assert.equal(seen.span.traceState, undefined); assert.deepEqual(Object.keys(seen.span).sort(), ["isRemote", "spanId", "traceFlags", "traceId"]); }
  for (const sc of f.metricContexts) { assert.ok(requests.some((s) => s.spanContext().spanId === sc.spanId)); assert.equal(sc.traceState, undefined); }
  assert.equal(f.points("emseepea.http.requests")[0].value, 2);
});

test("logging defaults off and a missing logger provider is a no-op", async (t) => {
  for (const options of [{ defaultOptions: true }, { enabled: false }, { loggerProvider: false }]) await t.test(JSON.stringify(options), async (t) => {
    const f = await fixture(t, options); assert.equal((await call(f.running.url)).status, 200); await f.completed(1); await f.flush();
    assert.equal(f.logExport.getFinishedLogRecords().length, 0); assert.equal(f.points("emseepea.http.requests")[0].value, 1);
  });
});

test("valid unsampled local spans still correlate; invalid incoming parents start a local trace", async (t) => {
  for (const unsampled of [true, false]) await t.test(String(unsampled), async (t) => {
    const f = await fixture(t, unsampled ? { sampler: new AlwaysOffSampler() } : {});
    assert.equal((await call(f.running.url, { traceparent: unsampled ? parent(firstTrace, "00") : "invalid" })).status, 200);
    await f.completed(1); await f.flush(); const [record] = f.logExport.getFinishedLogRecords(); checkRecord(record);
    assert.equal(record.spanContext.spanId, f.handlerContexts[0].spanId); assert.notEqual(record.spanContext.spanId, remoteSpan);
    if (unsampled) { assert.equal(record.spanContext.traceFlags, 0); assert.equal(f.spans.getFinishedSpans().length, 0); }
    else { assert.notEqual(record.spanContext.traceId, firstTrace); assert.equal(record.spanContext.traceId, f.handlerContexts[0].traceId); }
  });
});

test("no-op tracer parents and broken local contexts never masquerade as local request spans", async (t) => {
  for (const options of [{ tracing: false }, { tracing: false, stripRemote: true }, { brokenSpan: true }]) await t.test(JSON.stringify(options), async (t) => {
    const f = await fixture(t, options); assert.equal((await call(f.running.url)).status, 200); await f.completed(1); await f.flush();
    const [record] = f.logExport.getFinishedLogRecords(); checkRecord(record); assert.equal(record.spanContext, undefined); assert.equal(f.calls(), 1);
  });
});

test("manual events explicitly exclude an unrelated ambient span and baggage", async (t) => {
  const f = await fixture(t);
  const unrelated = propagation.setBaggage(trace.setSpanContext(ROOT_CONTEXT, { traceId: firstTrace, spanId: remoteSpan, traceFlags: 1 }), propagation.createBaggage({ private: { value: secret } }));
  context.with(unrelated, () => f.adapter.emit({ type: "mcp.request", method: "tools/call", capability: "echo", httpMethod: "POST", statusCode: 200, outcome: "finished", protocolOutcome: "success", durationMs: 25 }));
  await f.flush(); const [record] = f.logExport.getFinishedLogRecords(); checkRecord(record); assert.equal(record.spanContext, undefined); assert.equal(f.processorContexts[0].baggage, undefined);
});

test("counter, histogram and logger API failures do not suppress other signals or protocol work", async (t) => {
  for (const fault of ["counter", "histogram", "logger"]) await t.test(fault, async (t) => {
    const f = await fixture(t, { fault }); const response = await call(f.running.url); assert.equal(response.status, 200); assert.equal((await response.json()).result.structuredContent.value, secret);
    await f.completed(1); await f.flush(); assert.equal(f.calls(), 1); assert.equal(f.spans.getFinishedSpans().filter((s) => s.name === "mcp.request").length, 1);
    assert.equal(f.points("emseepea.http.requests").length, fault === "counter" ? 0 : 1);
    assert.equal(f.points("emseepea.http.response.duration").length, fault === "histogram" ? 0 : 1);
    assert.equal(f.logExport.getFinishedLogRecords().length, fault === "logger" ? 0 : 1);
  });
});

test("tool errors and streaming finish/disconnect each emit exactly one safe completion record", async (t) => {
  await t.test("tool error", async (t) => {
    const f = await fixture(t); assert.equal((await call(f.running.url, { value: "tool-error" })).status, 200); await f.completed(1); await f.flush();
    const records = f.logExport.getFinishedLogRecords(); assert.equal(records.length, 1); checkRecord(records[0]); assert.equal(records[0].attributes["emseepea.protocol.outcome"], "tool_error");
  });
  await t.test("streaming", async (t) => {
    const f = await fixture(t, { streaming: true }); const first = await call(f.running.url, { progress: true }); await first.text(); await f.completed(1);
    const controller = new AbortController(); const response = await call(f.running.url, { value: "disconnect", progress: true, signal: controller.signal });
    const body = response.text(); controller.abort(); await assert.rejects(body, /abort/i); await f.completed(2); await f.flush();
    const records = f.logExport.getFinishedLogRecords(); assert.equal(records.length, 2); records.forEach(checkRecord);
    assert.deepEqual(records.map((r) => r.attributes["emseepea.transport.outcome"]), ["finished", "disconnected"]);
  });
});
