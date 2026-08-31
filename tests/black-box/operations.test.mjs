import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { trace } from "@opentelemetry/api";
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import { createEmseepea, defineStreamingTool, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";
import { callOptions } from "../fixtures/proxy-progress.mjs";

const result = { text: "Done", data: { value: "done" } };
const secret = "private-readiness-error";
const options = { name: "operations-test", version: "0" };

async function start(t, config = {}, serve = {}) {
  const app = createEmseepea({ ...options, ...config });
  const running = await serveEmseepea(app, { port: 0, ...serve });
  t.after(() => running.close());
  return { app, ...running };
}

async function ready(running) {
  const response = await fetch(new URL("/readyz", running.url));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-type"), /^text\/plain/);
  const body = await response.text();
  assert.equal(body, response.status === 200 ? "ready\n" : "not ready\n");
  return response.status;
}

test("invalid operation callbacks and timeouts are rejected before listening", async () => {
  for (const value of [null, false, "callback", {}]) {
    assert.throws(() => createEmseepea({ ...options, readiness: value }), /readiness must be a function/);
    const app = createEmseepea(options);
    await assert.rejects(serveEmseepea(app, { port: 0, flushTelemetry: value }), /flushTelemetry must be a function/);
    assert.equal(app.server.listening, false);
    await app.close();
  }
  for (const value of [0, -1, 1.5, NaN, Infinity, 60_001, "10", null]) {
    assert.throws(() => createEmseepea({ ...options, readiness: () => true, readinessTimeoutMs: value }), /readinessTimeoutMs/);
    const app = createEmseepea(options);
    await assert.rejects(serveEmseepea(app, { port: 0, flushTelemetry: () => {}, telemetryFlushTimeoutMs: value }), /telemetryFlushTimeoutMs/);
    assert.equal(app.server.listening, false);
    await app.close();
  }
  assert.throws(() => createEmseepea({ ...options, readinessTimeoutMs: 10 }), /requires readiness/);
  const app = createEmseepea(options);
  await assert.rejects(serveEmseepea(app, { port: 0, telemetryFlushTimeoutMs: 10 }), /requires flushTelemetry/);
  await app.close();
});

test("readiness tracks dependency failure and recovery without disabling independent tools", async (t) => {
  let healthy = true;
  let calls = 0;
  const tool = defineTool({ name: "progress", access: "public", description: "Return one value.",
    inputSchema: z.object({ id: z.string(), mode: z.string() }), outputSchema: z.object({ value: z.string() }),
    handler: () => { calls += 1; return result; },
  });
  const config = { ...options, readiness: () => healthy, tools: [tool] };
  const app = createEmseepea(config);
  config.readiness = () => false;
  const running = await serveEmseepea(app, { port: 0 });
  t.after(() => running.close());
  assert.equal(await ready(running), 200);
  for (const unavailable of [false, "true", 1, undefined, { secret }]) {
    healthy = unavailable;
    assert.equal(await ready(running), 503);
  }
  const response = await fetch(running.url, callOptions("independent", "normal", { token: false }));
  assert.equal((await response.json()).result.structuredContent.value, "done");
  assert.equal(calls, 1);
  const health = await fetch(new URL("/healthz", running.url));
  assert.equal(health.status, 200);
  assert.equal(await health.text(), "ok\n");
  healthy = true;
  assert.equal(await ready(running), 200);
  assert.equal(await ready(await start(t)), 200);
});

test("probe failures reveal no error details", async (t) => {
  for (const readiness of [() => { throw new Error(secret); }, () => Promise.reject(new Error(secret))]) {
    assert.equal(await ready(await start(t, { readiness })), 503);
  }
});

test("overdue readiness success is rejected even before its timer gets a turn", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const running = await start(t, { readinessTimeoutMs: 10, readiness: () => { now += 40; return true; } });
  assert.equal(await ready(running), 503);
});

test("timed-out probes retain their single-flight slot until late settlement", async (t) => {
  for (const rejectLate of [false, true]) {
    let calls = 0;
    let settle;
    let signal;
    const running = await start(t, { readinessTimeoutMs: 30, readiness: (ctx) => {
      calls += 1;
      signal = ctx.signal;
      return new Promise((resolve, reject) => { settle = () => rejectLate ? reject(new Error(secret)) : resolve(true); });
    } });
    assert.deepEqual(await Promise.all([ready(running), ready(running), ready(running)]), [503, 503, 503]);
    assert.equal(calls, 1);
    assert.equal(signal.aborted, true);
    assert.equal(await ready(running), 503);
    assert.equal(calls, 1);
    settle();
    await delay(0);
    const next = ready(running);
    assert.equal(await next, 503);
    assert.equal(calls, 2);
    settle();
  }
});

test("shutdown aborts readiness, stops new connections, and shares one close promise", async (t) => {
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  let signal;
  let flushed = 0;
  const running = await start(t, { readiness: (ctx) => { signal = ctx.signal; entered(); return new Promise(() => {}); } }, {
    shutdownTimeoutMs: 50, flushTelemetry: () => { flushed += 1; }, telemetryFlushTimeoutMs: 100,
  });
  const request = ready(running);
  await started;
  const closing = running.close();
  assert.equal(closing, running.close());
  assert.equal(signal.aborted, true);
  assert.equal(await request, 503);
  await closing;
  assert.equal(flushed, 1);
  await assert.rejects(fetch(new URL("/readyz", running.url)));
});

test("forced stream shutdown finalizes its terminal span before flushing", async (t) => {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] });
  assert.equal(trace.setGlobalTracerProvider(provider), true);
  t.after(async () => { trace.disable(); await provider.shutdown(); });
  let cancelled = false;
  let flushed = 0;
  let spansAtFlush;
  const tool = defineStreamingTool({ name: "progress", access: "public", description: "Report progress.",
    inputSchema: z.object({ id: z.string(), mode: z.string() }), outputSchema: z.object({ value: z.string() }),
    handler: async (_input, { reportProgress, signal }) => {
      await reportProgress({ progress: 1, total: 2 });
      try { await delay(5_000, undefined, { signal }); }
      finally { cancelled = signal.aborted; }
      return result;
    },
  });
  const running = await start(t, { tools: [tool], telemetry: true }, {
    shutdownTimeoutMs: 40, telemetryFlushTimeoutMs: 200,
    flushTelemetry: async () => {
      flushed += 1;
      spansAtFlush = exporter.getFinishedSpans().map((span) => span.attributes["emseepea.transport.outcome"]);
      await provider.forceFlush();
    },
  });
  const response = await fetch(running.url, callOptions("shutdown"));
  const reader = response.body.getReader();
  await reader.read();
  assert.equal(exporter.getFinishedSpans().length, 0);
  await running.close();
  assert.equal(flushed, 1);
  assert.deepEqual(spansAtFlush, ["disconnected"]);
  assert.equal(cancelled, true);
  await assert.rejects(async () => { while (!(await reader.read()).done) { /* Drain. */ } }, /terminated/);
});

test("flusher errors and ignored cancellation cannot prevent bounded close", async (t) => {
  for (const mode of ["throw", "reject", "hang"]) {
    let signal;
    let calls = 0;
    const running = await start(t, {}, { shutdownTimeoutMs: 30, telemetryFlushTimeoutMs: 30, flushTelemetry: (ctx) => {
      signal = ctx.signal;
      calls += 1;
      if (mode === "throw") throw new Error(secret);
      if (mode === "reject") return Promise.reject(new Error(secret));
      return new Promise(() => {});
    } });
    await Promise.race([running.close(), delay(1_000).then(() => assert.fail("close exceeded its bounds"))]);
    assert.equal(calls, 1);
    if (mode === "hang") assert.equal(signal.aborted, true);
  }
});

test("late terminal telemetry cannot start a flush after its deadline", async (t) => {
  let now = Date.now();
  let ended = 0;
  let flushed = 0;
  t.mock.method(Date, "now", () => now);
  t.mock.method(trace, "getTracer", () => ({ startSpan: () => ({
    spanContext: () => ({ traceId: "1".repeat(32), spanId: "1".repeat(16), traceFlags: 1 }),
    setAttributes: () => {},
    end: () => { ended += 1; now += 1_000; },
  }) }));
  const tool = defineStreamingTool({ name: "progress", access: "public", description: "Report progress.",
    inputSchema: z.object({ id: z.string(), mode: z.string() }), outputSchema: z.object({ value: z.string() }),
    handler: async (_input, { reportProgress, signal }) => {
      await reportProgress({ progress: 1, total: 2 });
      await delay(5_000, undefined, { signal });
      return result;
    },
  });
  const running = await start(t, { tools: [tool], telemetry: true }, {
    shutdownTimeoutMs: 30, telemetryFlushTimeoutMs: 100,
    flushTelemetry: () => { flushed += 1; },
  });
  const response = await fetch(running.url, callOptions("late-telemetry"));
  const reader = response.body.getReader();
  await reader.read();
  await running.close();
  assert.equal(ended, 1);
  assert.equal(flushed, 0);
  await assert.rejects(async () => { while (!(await reader.read()).done) { /* Drain. */ } }, /terminated/);
});

test("a stalled Fastify close hook cannot keep the HTTP listener open", async (t) => {
  let release;
  const hook = new Promise((resolve) => { release = resolve; });
  let flushed = false;
  const app = createEmseepea(options);
  app.addHook("preClose", async () => hook);
  const running = await serveEmseepea(app, {
    port: 0,
    shutdownTimeoutMs: 30, telemetryFlushTimeoutMs: 100,
    flushTelemetry: () => { flushed = true; },
  });
  t.after(() => running.close());
  try {
    await running.close();
    assert.equal(app.server.listening, false);
    assert.equal(flushed, true);
    await assert.rejects(fetch(new URL("/healthz", running.url)));
  } finally { release(); }
});

test("flush is skipped if HTTP closure cannot be established within its budget", async (t) => {
  let flushed = false;
  const running = await start(t, {}, {
    shutdownTimeoutMs: 30, telemetryFlushTimeoutMs: 30,
    flushTelemetry: () => { flushed = true; },
  });
  const realClose = running.app.server.close.bind(running.app.server);
  const mock = t.mock.method(running.app.server, "close", () => running.app.server);
  try {
    await Promise.race([running.close(), delay(1_000).then(() => assert.fail("close exceeded its bounds"))]);
    assert.equal(flushed, false);
  } finally {
    mock.mock.restore();
    await new Promise((resolve) => realClose(resolve));
  }
});

test("flushing preserves unrelated close errors and the originally configured callback", async () => {
  const app = createEmseepea(options);
  const failure = new Error(secret);
  app.addHook("onClose", async () => { throw failure; });
  let originalCalls = 0;
  let replacementCalls = 0;
  const serveOptions = { port: 0, flushTelemetry: () => { originalCalls += 1; } };
  const running = await serveEmseepea(app, serveOptions);
  serveOptions.flushTelemetry = () => { replacementCalls += 1; };
  await assert.rejects(running.close(), (error) => error === failure);
  assert.equal(originalCalls, 1);
  assert.equal(replacementCalls, 0);
  assert.equal(app.server.listening, false);
});
