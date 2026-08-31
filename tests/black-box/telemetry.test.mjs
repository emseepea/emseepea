import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { context, createContextKey, createTraceState, metrics, propagation, ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { createEmseepea, defineStreamingTool, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { callOptions, readMessages } from "../fixtures/proxy-progress.mjs";

const secret = "private-canary-DO-NOT-EXPORT";
const inputSchema = z.object({ id: z.string(), mode: z.string() });
const outputSchema = z.object({ value: z.string() });
const result = { text: "Done", data: { value: "done" } };

function providers(t) {
  const manager = new AsyncLocalStorageContextManager().enable();
  assert.equal(context.setGlobalContextManager(manager), true);
  const spans = new InMemorySpanExporter();
  const tracing = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter: spans })] });
  assert.equal(trace.setGlobalTracerProvider(tracing), true);
  const metricExport = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({ exporter: metricExport, exportIntervalMillis: 600_000 });
  const metering = new MeterProvider({ readers: [reader] });
  assert.equal(metrics.setGlobalMeterProvider(metering), true);
  t.after(async () => {
    trace.disable(); metrics.disable(); context.disable(); manager.disable();
    await Promise.all([Promise.resolve().then(() => tracing.shutdown()), metering.shutdown()]);
  });
  return { manager, tracing, spans, metering, metricExport };
}

async function server(t, { telemetry = true, handler = () => result, streaming = false, parent = ROOT_CONTEXT, operationTimeoutMs } = {}) {
  const tool = (streaming ? defineStreamingTool : defineTool)({
    name: "progress", access: "public", description: secret,
    inputSchema, outputSchema, handler,
  });
  const app = createEmseepea({ name: secret, version: "0.0.0", tools: [tool], telemetry, operationTimeoutMs });
  const running = await context.with(parent, () => serveEmseepea(app, { port: 0, shutdownTimeoutMs: 100 }));
  t.after(() => running.close());
  return running;
}

async function call(running, id = secret, options = {}) {
  const response = await fetch(running.url, callOptions(id, "normal", { token: false, ...options }));
  return { status: response.status, body: await response.json() };
}

async function waitForSpanCount(exporter, count) {
  const deadline = Date.now() + 1_000;
  while (exporter.getFinishedSpans().length < count && Date.now() < deadline) await delay(5);
  assert.equal(exporter.getFinishedSpans().length, count);
}

test("telemetry is checked, default-off, and works without a provider", async (t) => {
  for (const telemetry of [null, "true", {}, 1]) {
    assert.throws(() => createEmseepea({ name: "test", version: "0", telemetry }), /telemetry must be a boolean/);
  }
  for (const telemetry of [false, true]) {
    const running = await server(t, { telemetry });
    assert.equal((await call(running)).body.result.structuredContent.value, "done");
  }
  const p = providers(t);
  const app = createEmseepea({ name: "default", version: "0" });
  const running = await serveEmseepea(app, { port: 0 });
  t.after(() => running.close());
  await call(running);
  assert.equal(p.spans.getFinishedSpans().length, 0);
});

test("real traces and metrics preserve only safe parent identity across concurrent awaited work", async (t) => {
  const p = providers(t);
  const privateKey = createContextKey("private-context");
  const parentSpan = p.tracing.getTracer("test").startSpan("parent");
  const parentIdentity = { ...parentSpan.spanContext(), traceState: createTraceState(`private=${secret}`) };
  const parent = propagation.setBaggage(trace.setSpanContext(ROOT_CONTEXT, parentIdentity),
    propagation.createBaggage({ private: { value: secret } })).setValue(privateKey, secret);
  const observed = [];
  const running = await server(t, { parent, handler: async () => {
    await delay(5);
    const active = context.active();
    observed.push({ span: trace.getSpanContext(active), baggage: propagation.getBaggage(active), value: active.getValue(privateKey) });
    return result;
  } });
  const replies = await Promise.all(Array.from({ length: 4 }, (_, index) => call(running, `${secret}-${index}`, {
    headers: { Authorization: `Bearer ${secret}`, baggage: `private=${secret}`, traceparent: "00-11111111111111111111111111111111-1111111111111111-01" },
  })));
  assert.ok(replies.every(({ status, body }) => status === 200 && body.result.structuredContent.value === "done"));
  const spans = p.spans.getFinishedSpans();
  assert.equal(spans.length, 4);
  assert.equal(new Set(observed.map(({ span }) => span.spanId)).size, 4);
  for (const span of spans) {
    assert.equal(span.name, "mcp.request");
    assert.equal(span.parentSpanContext.spanId, parentIdentity.spanId);
    assert.equal(span.parentSpanContext.traceState, undefined);
    assert.equal(span.spanContext().traceId, parentIdentity.traceId);
    assert.equal(span.attributes["mcp.method"], "tools/call");
    assert.equal(span.attributes["emseepea.transport.outcome"], "finished");
    assert.deepEqual(Object.keys(span.attributes).sort(), ["emseepea.transport.outcome", "http.request.method", "http.response.status_code", "mcp.method"]);
  }
  assert.ok(observed.every(({ baggage, value, span }) => baggage === undefined && value === undefined && span.traceState === undefined));
  await p.metering.forceFlush();
  const exported = p.metricExport.getMetrics().flatMap((entry) => entry.scopeMetrics.flatMap((scope) => scope.metrics));
  assert.equal(exported.find((metric) => metric.descriptor.name === "emseepea.http.requests").dataPoints[0].value, 4);
  assert.equal(exported.find((metric) => metric.descriptor.name === "emseepea.http.response.duration").dataPoints[0].value.count, 4);
  assert.ok(!JSON.stringify({ spans: spans.map((span) => ({ attributes: span.attributes, events: span.events })), exported }).includes(secret));
  parentSpan.end();
});

test("transport outcomes do not mistake HTTP 200 tool errors for domain success", async (t) => {
  const p = providers(t);
  const running = await server(t, { handler: () => { throw new Error(secret); } });
  const reply = await call(running);
  assert.equal(reply.status, 200);
  assert.equal(reply.body.result.isError, true);
  const options = callOptions(secret, "normal", { token: false });
  const malformed = await fetch(running.url, { ...options, body: "{" });
  assert.equal(malformed.status, 400); await malformed.text();
  const spans = p.spans.getFinishedSpans();
  assert.equal(spans.length, 2);
  assert.equal(spans[0].attributes["emseepea.transport.outcome"], "finished");
  assert.equal(spans[1].attributes["mcp.method"], "_OTHER");
  assert.ok(!JSON.stringify(spans.map(({ attributes, events }) => ({ attributes, events }))).includes(secret));
});

test("rejected headers and unknown method names cannot become arbitrary metric labels", async (t) => {
  const p = providers(t);
  let calls = 0;
  const running = await server(t, { handler: () => { calls += 1; return result; } });
  const mismatched = await call(running, secret, { headers: { "Mcp-Name": secret } });
  assert.equal(mismatched.status, 400);
  const options = callOptions(secret, "normal", { token: false, headers: { "Mcp-Method": secret } });
  const body = JSON.parse(options.body);
  body.method = secret;
  const response = await fetch(running.url, { ...options, body: JSON.stringify(body) });
  const unknown = await response.json();
  assert.ok(unknown.error);
  assert.equal(calls, 0);
  await waitForSpanCount(p.spans, 2);
  assert.equal(p.spans.getFinishedSpans()[1].attributes["mcp.method"], "_OTHER");
  await p.metering.forceFlush();
  assert.ok(!JSON.stringify(p.metricExport.getMetrics()).includes(secret));
});

test("sign-in rejection is measured without exporting tokens or invoking tools", async (t) => {
  const p = providers(t);
  const tool = defineTool({
    name: "progress", access: "protected", requiredScopes: ["read"], description: secret,
    inputSchema, outputSchema, handler: () => assert.fail("must not invoke"),
  });
  let verified = 0;
  const app = createEmseepea({ name: "test", version: "0", tools: [tool], telemetry: true, oauth: {
    verifier: { verifyAccessToken: async () => { verified += 1; throw new OAuthError(OAuthErrorCode.InvalidToken, secret); } },
    metadata: { resourceServerUrl: new URL("https://api.example/mcp"), oauthMetadata: {
      issuer: "https://auth.example", authorization_endpoint: "https://auth.example/authorize",
      token_endpoint: "https://auth.example/token", response_types_supported: ["code"],
    } },
  } });
  const running = await serveEmseepea(app, { port: 0 });
  t.after(() => running.close());
  assert.equal((await call(running)).status, 401);
  assert.equal((await call(running, secret, { headers: { Authorization: `Bearer ${secret}` } })).status, 401);
  assert.equal(verified, 1);
  await waitForSpanCount(p.spans, 2);
  assert.ok(p.spans.getFinishedSpans().every((span) => span.attributes["http.response.status_code"] === 401));
  await p.metering.forceFlush();
  assert.ok(!JSON.stringify(p.metricExport.getMetrics()).includes(secret));
});

test("SSE spans stay open through progress and end once on completion or disconnect", async (t) => {
  const p = providers(t);
  let release;
  let cancelled;
  const stopped = new Promise((resolve) => { cancelled = resolve; });
  const running = await server(t, { streaming: true, handler: async (_input, { reportProgress, signal }) => {
    await reportProgress({ progress: 1, total: 2 });
    await new Promise((resolve) => {
      release = resolve;
      signal.addEventListener("abort", () => { cancelled(); resolve(); }, { once: true });
    });
    signal.throwIfAborted();
    return result;
  } });
  const response = await fetch(running.url, callOptions("finished"));
  const messages = await readMessages(response, (message) => {
    if (message.method === "notifications/progress") {
      assert.equal(p.spans.getFinishedSpans().length, 0);
      release();
    }
  });
  assert.equal(messages.at(-1).result.structuredContent.value, "done");
  assert.equal(p.spans.getFinishedSpans().length, 1);
  const abort = new AbortController();
  const disconnected = await fetch(running.url, callOptions("disconnected", "normal", { signal: abort.signal }));
  const reader = disconnected.body.getReader();
  await reader.read();
  assert.equal(p.spans.getFinishedSpans().length, 1);
  abort.abort();
  await Promise.race([stopped, delay(1_000).then(() => { throw new Error("disconnect did not cancel"); })]);
  await waitForSpanCount(p.spans, 2);
  const spans = p.spans.getFinishedSpans();
  assert.equal(spans.length, 2);
  assert.equal(spans[1].attributes["emseepea.transport.outcome"], "disconnected");
  const shuttingDown = await fetch(running.url, callOptions("shutdown"));
  const shutdownReader = shuttingDown.body.getReader();
  await shutdownReader.read();
  await running.close();
  await assert.rejects(async () => { while (!(await shutdownReader.read()).done) { /* Drain. */ } }, /terminated/);
  await waitForSpanCount(p.spans, 3);
  assert.equal(p.spans.getFinishedSpans()[2].attributes["emseepea.transport.outcome"], "disconnected");
});

test("a streaming deadline ends its span and both measurements exactly once", async (t) => {
  const p = providers(t);
  let aborted = false;
  const running = await server(t, { streaming: true, operationTimeoutMs: 100, handler: async (_input, { reportProgress, signal }) => {
    await reportProgress({ progress: 1, total: 2 });
    try { await delay(5_000, undefined, { signal }); }
    finally { aborted = signal.aborted; }
    return result;
  } });
  const messages = await readMessages(await fetch(running.url, callOptions("deadline")));
  assert.ok(messages.some((message) => message.method === "notifications/progress"));
  assert.equal(messages.at(-1).result.isError, true);
  assert.equal(aborted, true);
  await waitForSpanCount(p.spans, 1);
  await running.close();
  await p.metering.forceFlush();
  const exported = p.metricExport.getMetrics().flatMap((entry) => entry.scopeMetrics.flatMap((scope) => scope.metrics));
  assert.equal(p.spans.getFinishedSpans().length, 1);
  assert.equal(exported.find((metric) => metric.descriptor.name === "emseepea.http.requests").dataPoints.reduce((sum, point) => sum + point.value, 0), 1);
  assert.equal(exported.find((metric) => metric.descriptor.name === "emseepea.http.response.duration").dataPoints.reduce((sum, point) => sum + point.value.count, 0), 1);
});

test("standard SDK exporter failures leave subsequent tool calls working", async (t) => {
  const p = providers(t);
  let spanExports = 0;
  let metricExports = 0;
  t.mock.method(p.spans, "export", (_spans, callback) => {
    spanExports += 1;
    queueMicrotask(() => callback({ code: 1, error: new Error(secret) }));
  });
  t.mock.method(p.metricExport, "export", (_metrics, callback) => {
    metricExports += 1;
    queueMicrotask(() => callback({ code: 1, error: new Error(secret) }));
  });
  let calls = 0;
  const running = await server(t, { handler: () => { calls += 1; return result; } });
  for (let index = 0; index < 2; index += 1) {
    const response = await call(running);
    assert.equal(response.status, 200);
    assert.equal(response.body.result.structuredContent.value, "done");
    await p.tracing.forceFlush().catch(() => {}); // The SDK may surface an export failure during flush.
    await p.metering.forceFlush();
  }
  assert.equal(calls, 2);
  assert.equal(spanExports, 2);
  assert.equal(metricExports, 2);
});

test("independent concurrent parents remain separate in handlers and metric contexts", async (t) => {
  const p = providers(t);
  const privateKey = createContextKey("private-metric-context");
  const recorded = [];
  t.mock.method(metrics, "getMeter", () => ({
    createCounter: () => ({ add: (_value, _attributes, ctx) => recorded.push(ctx) }),
    createHistogram: () => ({ record: (_value, _attributes, ctx) => recorded.push(ctx) }),
  }));
  const parents = [1, 2].map((id) => ({ traceId: String(id).repeat(32), spanId: String(id).repeat(16), traceFlags: 1 }));
  const observed = [];
  const servers = await Promise.all(parents.map((identity) => server(t, {
    parent: propagation.setBaggage(trace.setSpanContext(ROOT_CONTEXT, identity),
      propagation.createBaggage({ private: { value: secret } })).setValue(privateKey, secret),
    handler: async () => {
      await delay(5);
      observed.push(trace.getSpanContext(context.active()));
      return result;
    },
  })));
  await Promise.all(servers.map((running) => call(running)));
  await waitForSpanCount(p.spans, 2);
  assert.deepEqual(observed.map((identity) => identity.traceId).sort(), parents.map((identity) => identity.traceId));
  assert.equal(recorded.length, 4);
  for (const span of p.spans.getFinishedSpans()) {
    const parent = parents.find((identity) => identity.traceId === span.spanContext().traceId);
    assert.equal(span.parentSpanContext.spanId, parent.spanId);
    assert.equal(recorded.filter((ctx) => trace.getSpanContext(ctx).spanId === span.spanContext().spanId).length, 2);
  }
  for (const ctx of recorded) {
    assert.equal(propagation.getBaggage(ctx), undefined);
    assert.equal(ctx.getValue(privateKey), undefined);
    assert.equal(trace.getSpanContext(ctx).traceState, undefined);
  }
});

test("throwing or duplicate context callbacks never execute the tool twice", async (t) => {
  for (const mode of ["before", "after", "twice"]) {
    await t.test(mode, async (t) => {
      const p = providers(t);
      let calls = 0;
      const running = await server(t, { handler: () => { calls += 1; return result; } });
      const original = p.manager.with.bind(p.manager);
      t.mock.method(p.manager, "with", (ctx, fn, thisArg, ...args) => {
        if (mode === "before") throw new Error(secret);
        const value = original(ctx, fn, thisArg, ...args);
        if (mode === "after") throw new Error(secret);
        original(ctx, fn, thisArg, ...args);
        return value;
      });
      assert.equal((await call(running)).body.result.structuredContent.value, "done");
      assert.equal(calls, 1);
    });
  }
});

test("telemetry API failures do not change successful or failed tool responses", async (t) => {
  for (const fails of ["getTracer", "startSpan", "setAttributes", "end", "getMeter", "createCounter", "createHistogram", "add", "record"]) {
    await t.test(fails, async (t) => {
      let failures = 0;
      const attempt = (method, value) => (..._args) => {
        if (fails === method) { failures += 1; throw new Error(secret); }
        return value;
      };
      const span = {
        spanContext: () => ({ traceId: "11111111111111111111111111111111", spanId: "1111111111111111", traceFlags: 1 }),
        setAttributes: attempt("setAttributes"), end: attempt("end"),
      };
      t.mock.method(trace, "getTracer", attempt("getTracer", { startSpan: attempt("startSpan", span) }));
      t.mock.method(metrics, "getMeter", attempt("getMeter", {
        createCounter: attempt("createCounter", { add: attempt("add") }),
        createHistogram: attempt("createHistogram", { record: attempt("record") }),
      }));
      let calls = 0;
      const running = await server(t, { handler: () => {
        if (++calls === 2) throw new Error(secret);
        return result;
      } });
      const success = await call(running);
      const failure = await call(running);
      assert.equal(success.status, 200);
      assert.equal(success.body.result.structuredContent.value, "done");
      assert.equal(failure.status, 200);
      assert.equal(failure.body.result.isError, true);
      assert.ok(!JSON.stringify(failure.body.result.content).includes(secret));
      assert.equal(calls, 2);
      assert.ok(failures > 0, `${fails} was not exercised`);
    });
  }
});
