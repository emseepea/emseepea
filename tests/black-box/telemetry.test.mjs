import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { metrics, trace } from "@opentelemetry/api";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import {
  createEmseepea,
  defineTool,
  openTelemetry,
  serveEmseepea,
  structuredLogging,
} from "@emseepea/server";
import { z } from "zod";

const secret = "private-canary-DO-NOT-EXPORT";
const inputSchema = z.object({ value: z.string() });
const outputSchema = z.object({ value: z.string() });
const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "observability-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

function tool(handler = ({ value }) => ({ data: { value } })) {
  return defineTool({
    name: "echo",
    access: "public",
    description: "Echo a value.",
    inputSchema,
    outputSchema,
    handler,
  });
}

async function start(t, observability = [], handler) {
  const running = await serveEmseepea(createEmseepea({
    name: "observability-test",
    version: "0.0.0",
    tools: [tool(handler)],
    observability,
  }), { port: 0, shutdownTimeoutMs: 100, observabilityFlushTimeoutMs: 40 });
  t.after(() => running.close());
  return running;
}

async function call(url, name = "echo", value = secret) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "tools/call",
      "Mcp-Name": name,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: secret,
      method: "tools/call",
      params: { name, arguments: { value }, _meta: requestMeta },
    }),
  });
  return { response, body: await response.json() };
}

test("observability is optional, typed, and rejects duplicate adapters", async (t) => {
  for (const observability of [null, {}, "logs"]) {
    assert.throws(
      () => createEmseepea({ name: "invalid", version: "0", observability }),
      /observability must be an array/,
    );
  }
  for (const adapter of [null, {}, { id: "", emit() {} }, { id: "valid" }]) {
    assert.throws(
      () => createEmseepea({ name: "invalid", version: "0", observability: [adapter] }),
      /observability adapters require/,
    );
  }
  const adapter = structuredLogging("log", () => {});
  assert.throws(
    () => createEmseepea({ name: "duplicate", version: "0", observability: [adapter, adapter] }),
    /Duplicate observability adapter id: log/,
  );
  const running = await start(t);
  assert.equal((await call(running.url)).body.result.structuredContent.value, secret);
});

test("two adapters receive the same immutable redacted event in stable order", async (t) => {
  const deliveries = [];
  let immutable = false;
  const adapters = ["first", "second"].map((id) => structuredLogging(id, (event) => {
    deliveries.push([id, event]);
    try { event.method = secret; } catch { immutable = true; }
  }));
  const running = await start(t, adapters);
  assert.equal((await call(running.url)).response.status, 200);
  await delay(0);
  assert.deepEqual(deliveries.map(([id]) => id), ["first", "second"]);
  assert.equal(deliveries[0][1], deliveries[1][1]);
  assert.deepEqual(
    Object.keys(deliveries[0][1]).sort(),
    ["capability", "durationMs", "httpMethod", "method", "outcome", "statusCode", "type"],
  );
  assert.equal(deliveries[0][1].capability, "echo");
  assert.equal(deliveries[0][1].method, "tools/call");
  assert.equal(deliveries[0][1].statusCode, 200);
  assert.equal(immutable, true);
  assert.doesNotMatch(JSON.stringify(deliveries), new RegExp(secret));

  deliveries.length = 0;
  await call(running.url, "unknown", secret);
  await delay(0);
  assert.equal(deliveries[0][1].capability, undefined);
  assert.doesNotMatch(JSON.stringify(deliveries), /unknown/);
});

test("adapter failures never alter the protocol response", async (t) => {
  const running = await start(t, [
    structuredLogging("throws", () => { throw new Error(secret); }),
    structuredLogging("rejects", async () => { throw new Error(secret); }),
  ]);
  for (let index = 0; index < 2; index += 1) {
    const result = await call(running.url, "echo", `value-${index}`);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.result.structuredContent.value, `value-${index}`);
  }
});

test("repeated slow deliveries are bounded and every adapter gets a flush opportunity", async () => {
  let flushed = 0;
  const never = new Promise(() => {});
  const app = createEmseepea({
    name: "bounded-observability",
    version: "0",
    tools: [tool()],
    observability: [
      { id: "slow", emit: () => never },
      { id: "fast", emit() {}, flush() { flushed += 1; } },
    ],
  });
  const running = await serveEmseepea(app, {
    port: 0,
    shutdownTimeoutMs: 100,
    observabilityFlushTimeoutMs: 200,
  });
  await Promise.all(Array.from({ length: 20 }, () => call(running.url)));
  await delay(250);
  const started = performance.now();
  await running.close();
  assert.equal(flushed, 1);
  assert.ok(performance.now() - started < 100);
});

test("shutdown drains event delivery before flushing adapters", async (t) => {
  let delivered = false;
  let flushedAfterDelivery = false;
  const running = await start(t, [{
    id: "ordered",
    async emit() {
      await delay(20);
      delivered = true;
    },
    flush() { flushedAfterDelivery = delivered; },
  }]);
  await call(running.url);
  await running.close();
  assert.equal(flushedAfterDelivery, true);
});

test("the OpenTelemetry adapter records only the safe event contract", async (t) => {
  const spans = new InMemorySpanExporter();
  const tracing = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter: spans })] });
  assert.equal(trace.setGlobalTracerProvider(tracing), true);
  const metricExport = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({ exporter: metricExport, exportIntervalMillis: 600_000 });
  const metering = new MeterProvider({ readers: [reader] });
  assert.equal(metrics.setGlobalMeterProvider(metering), true);
  t.after(async () => {
    trace.disable();
    metrics.disable();
    await Promise.all([tracing.shutdown(), metering.shutdown()]);
  });

  const running = await start(t, [openTelemetry()]);
  assert.equal((await call(running.url)).response.status, 200);
  await delay(0);
  assert.equal(spans.getFinishedSpans().length, 1);
  const attributes = spans.getFinishedSpans()[0].attributes;
  assert.deepEqual(Object.keys(attributes).sort(), [
    "emseepea.transport.outcome",
    "http.request.method",
    "http.response.status_code",
    "mcp.capability.name",
    "mcp.method",
  ]);
  await metering.forceFlush();
  assert.doesNotMatch(JSON.stringify({ attributes, metrics: metricExport.getMetrics() }), new RegExp(secret));
});
