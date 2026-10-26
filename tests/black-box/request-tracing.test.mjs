import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { context, metrics, propagation, ROOT_CONTEXT, SpanKind, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { createEmseepea, defineStreamingTool, defineTool, openTelemetry, serveEmseepea, structuredLogging } from "@emseepea/server";
import { z } from "zod";

const secret = "tracing-private-canary";
const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "tracing-test", version: "0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};
const remote = {
  traceId: "1234567890abcdef1234567890abcdef",
  spanId: "1234567890abcdef",
  traceFlags: 1,
  isRemote: true,
};
const traceparent = `00-${remote.traceId}-${remote.spanId}-01`;

function tracing(t, { provider, propagator, manager } = {}) {
  const exporter = new InMemorySpanExporter();
  const sdk = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] });
  const asyncContext = manager ?? new AsyncLocalStorageContextManager();
  assert.equal(context.setGlobalContextManager(asyncContext.enable()), true);
  assert.equal(trace.setGlobalTracerProvider(provider ?? sdk), true);
  assert.equal(propagation.setGlobalPropagator(propagator ?? new W3CTraceContextPropagator()), true);
  t.after(async () => {
    context.disable();
    propagation.disable();
    trace.disable();
    metrics.disable();
    await sdk.shutdown();
  });
  return { exporter, tracer: trace.getTracer("test.backend") };
}

async function server(t, handler, { adapters = [openTelemetry()], streaming = false, access = "public", authentication } = {}) {
  const definition = {
    name: "echo", access, description: "Echo a test value.",
    ...(access === "protected" ? { requiredScopes: ["status:read"] } : {}),
    inputSchema: z.object({ value: z.string() }), handler,
    ...(!streaming ? { outputSchema: z.object({ value: z.string() }) } : {}),
  };
  const running = await serveEmseepea(createEmseepea({
    name: "tracing-test", version: "0", observability: adapters,
    ...(authentication ? { authentication } : {}),
    tools: [streaming ? defineStreamingTool(definition) : defineTool(definition)],
  }), { port: 0, shutdownTimeoutMs: 100 });
  t.after(() => running.close());
  return running;
}

function request(url, { value = secret, headers = {}, signal, name = "echo", progress = false } = {}) {
  return fetch(url, {
    method: "POST", signal,
    headers: {
      Accept: "application/json, text/event-stream", "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call", "Mcp-Name": name,
      Authorization: `Bearer ${secret}`, ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: secret, method: "tools/call",
      params: { name, arguments: { value }, _meta: { ...meta, ...(progress ? { progressToken: "progress" } : {}) } },
    }),
  });
}

function requestSpans(exporter) {
  return exporter.getFinishedSpans().filter((span) => span.name === "mcp.request");
}

test("the request span covers async backend work and continues the incoming trace", async (t) => {
  const delegate = new W3CTraceContextPropagator();
  const { exporter, tracer } = tracing(t, { propagator: {
    fields: () => delegate.fields(), inject: (...args) => delegate.inject(...args),
    extract(...args) {
      // Propagation work belongs to the measured request lifetime too.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
      return delegate.extract(...args);
    },
  } });
  const events = [];
  let entered;
  let release;
  const started = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  let active;
  const running = await server(t, async ({ value }) => {
    active = trace.getActiveSpan()?.spanContext();
    entered();
    await gate;
    return tracer.startActiveSpan("backend.read", async (span) => {
      try { await delay(25); return { data: { value } }; }
      finally { span.end(); }
    });
  }, { adapters: [structuredLogging("events", (event) => events.push(event)), openTelemetry()] });

  const response = request(running.url, { headers: { traceparent, baggage: `private=${secret}` } });
  await started;
  assert.equal(requestSpans(exporter).length, 0, "a live request must not be exported as finished");
  assert.equal(active.traceId, remote.traceId);
  release();
  assert.equal((await (await response).json()).result.structuredContent.value, secret);
  await delay(0);
  const [span] = requestSpans(exporter);
  const child = exporter.getFinishedSpans().find((value) => value.name === "backend.read");
  assert.equal(requestSpans(exporter).length, 1);
  assert.equal(span.kind, SpanKind.SERVER);
  assert.equal(span.parentSpanContext.spanId, remote.spanId);
  assert.equal(child.parentSpanContext.spanId, span.spanContext().spanId);
  assert.equal(child.spanContext().traceId, remote.traceId);
  const ms = span.duration[0] * 1_000 + span.duration[1] / 1e6;
  assert.ok(ms >= 20, `request span must cover delayed backend work, got ${ms}ms`);
  assert.ok(Math.abs(ms - events[0].durationMs) < 10, "span and event describe the same interval");
  assert.equal(span.attributes["mcp.capability.name"], "echo");
  assert.equal(span.attributes["emseepea.protocol.outcome"], "success");
  assert.equal(propagation.getBaggage(context.active()), undefined);
  assert.doesNotMatch(JSON.stringify({ attributes: span.attributes, events: span.events, logs: events }), new RegExp(secret));
});

test("overlapping requests keep separate parents and backend contexts across awaits", async (t) => {
  const { exporter, tracer } = tracing(t);
  let count = 0;
  let both;
  const gate = new Promise((resolve) => { both = resolve; });
  const seen = [];
  const running = await server(t, async ({ value }) => {
    const before = trace.getActiveSpan().spanContext();
    if (++count === 2) both();
    await gate;
    await delay(value === "one" ? 15 : 1);
    assert.deepEqual(trace.getActiveSpan().spanContext(), before);
    seen.push(before);
    return tracer.startActiveSpan(`backend.${value}`, (span) => {
      span.end();
      return { data: { value } };
    });
  });
  const otherTrace = "abcdef1234567890abcdef1234567890";
  await Promise.all([
    request(running.url, { value: "one", headers: { traceparent } }).then((response) => response.json()),
    request(running.url, { value: "two", headers: { traceparent: `00-${otherTrace}-${remote.spanId}-01` } }).then((response) => response.json()),
  ]);
  await delay(0);
  assert.equal(new Set(seen.map((span) => span.spanId)).size, 2);
  assert.deepEqual(new Set(seen.map((span) => span.traceId)), new Set([remote.traceId, otherTrace]));
  assert.equal(requestSpans(exporter).length, 2);
  for (const child of exporter.getFinishedSpans().filter((span) => span.name.startsWith("backend."))) {
    const parent = requestSpans(exporter).find((span) => span.spanContext().spanId === child.parentSpanContext.spanId);
    assert.ok(parent);
    assert.equal(child.spanContext().traceId, parent.spanContext().traceId);
  }
  assert.equal(trace.getActiveSpan(), undefined);
});

test("missing, invalid and oversized trace parents start fresh traces without ambient baggage", async (t) => {
  const { exporter } = tracing(t);
  const running = await server(t, ({ value }) => {
    assert.equal(propagation.getBaggage(context.active()), undefined);
    return { data: { value } };
  });
  for (const headers of [{}, { traceparent: "invalid" }, { traceparent: "x".repeat(513) },
    { traceparent: `00-${"0".repeat(32)}-${remote.spanId}-01` }]) {
    const response = await request(running.url, { headers });
    assert.equal(response.status, 200);
    await response.json();
  }
  await delay(0);
  assert.equal(requestSpans(exporter).length, 4);
  for (const span of requestSpans(exporter)) assert.equal(span.parentSpanContext, undefined);
  assert.equal(new Set(requestSpans(exporter).map((span) => span.spanContext().traceId)).size, 4);
});

test("only a validated span context survives the application propagator", async (t) => {
  const delegate = new W3CTraceContextPropagator();
  let extractedHeaders;
  const { exporter } = tracing(t, { propagator: {
    fields: () => delegate.fields(), inject: (...args) => delegate.inject(...args),
    extract(base, carrier, getter) {
      assert.equal(base, ROOT_CONTEXT);
      extractedHeaders = Object.keys(carrier).sort();
      return propagation.setBaggage(delegate.extract(base, carrier, getter),
        propagation.createBaggage({ private: { value: secret } }));
    },
  } });
  const running = await server(t, ({ value }) => {
    assert.equal(propagation.getBaggage(context.active()), undefined);
    return { data: { value } };
  });
  const response = await request(running.url, { headers: { traceparent, tracestate: "vendor=opaque", baggage: `private=${secret}` } });
  assert.equal(response.status, 200);
  await response.json();
  await delay(0);
  assert.deepEqual(extractedHeaders, ["traceparent", "tracestate"]);
  assert.equal(requestSpans(exporter)[0].spanContext().traceId, remote.traceId);
});

test("streaming and disconnects each finalize the request span once", async (t) => {
  const { exporter } = tracing(t);
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const running = await server(t, async ({ value }, { signal, reportProgress }) => {
    await reportProgress({ progress: 1, total: 1 });
    if (value === "disconnect") {
      entered();
      await delay(1_000, undefined, { signal });
    }
    return { content: [{ type: "text", text: "done" }] };
  }, { streaming: true });
  const response = await request(running.url, { progress: true });
  assert.match(response.headers.get("content-type"), /^text\/event-stream/);
  await response.text();
  await delay(0);
  assert.equal(requestSpans(exporter).length, 1);
  const controller = new AbortController();
  const pending = request(running.url, { value: "disconnect", progress: true, signal: controller.signal }).then((result) => result.text());
  await started;
  controller.abort();
  await assert.rejects(pending, /abort/i);
  await delay(30);
  assert.equal(requestSpans(exporter).length, 2);
  assert.equal(requestSpans(exporter)[1].attributes["emseepea.transport.outcome"], "disconnected");
});

test("disabled tracing and a custom adapter using the same ID do not create request spans", async (t) => {
  const { exporter } = tracing(t);
  for (const adapters of [[], [structuredLogging("opentelemetry", () => {})]]) {
    const running = await server(t, ({ value }) => {
      assert.equal(trace.getActiveSpan(), undefined);
      return { data: { value } };
    }, { adapters });
    assert.equal((await request(running.url)).status, 200);
  }
  await delay(0);
  assert.equal(exporter.getFinishedSpans().length, 0);
});

test("pre-response telemetry failures preserve exactly one successful handler call", async (t) => {
  for (const fault of ["extract", "start", "activate-before", "activate-after"]) {
    await t.test(fault, async (t) => {
      const manager = new AsyncLocalStorageContextManager();
      const originalWith = manager.with.bind(manager);
      let calls = 0;
      const options = {};
      if (fault === "extract") options.propagator = {
        fields: () => [], inject() {}, extract() { throw new Error(secret); },
      };
      if (fault === "start") options.provider = { getTracer: () => ({ startSpan() { throw new Error(secret); } }) };
      if (fault.startsWith("activate")) {
        let failed = false;
        manager.with = (ctx, fn, thisArg, ...args) => {
          if (failed) return originalWith(ctx, fn, thisArg, ...args);
          failed = true;
          if (fault === "activate-before") throw new Error(secret);
          originalWith(ctx, fn, thisArg, ...args);
          throw new Error(secret);
        };
        options.manager = manager;
      }
      const { exporter } = tracing(t, options);
      const running = await server(t, ({ value }) => { calls++; return { data: { value } }; });
      const response = await request(running.url);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).result.structuredContent.value, secret);
      assert.equal(calls, 1);
      await delay(0);
      assert.equal(requestSpans(exporter).length, fault === "start" ? 0 : 1);
    });
  }
});

test("protocol errors and throwing completion metrics cannot prevent span finalization", async (t) => {
  const { exporter } = tracing(t);
  metrics.setGlobalMeterProvider({ getMeter: () => ({
    createCounter: () => ({ add() { throw new Error(secret); } }),
    createHistogram: () => ({ record() { throw new Error(secret); } }),
  }) });
  const running = await server(t, () => { assert.fail("unknown tool must not execute a handler"); });
  const response = await request(running.url, { name: "unknown" });
  await response.json();
  await delay(0);
  assert.equal(requestSpans(exporter).length, 1);
  assert.equal(requestSpans(exporter)[0].attributes["emseepea.protocol.outcome"], "protocol_error");
  assert.doesNotMatch(JSON.stringify(requestSpans(exporter)[0].attributes), new RegExp(secret));
});

test("tracing spans authorization failures without admitting tool work or exporting provider errors", async (t) => {
  const { exporter } = tracing(t);
  let verifications = 0;
  const running = await server(t, () => { assert.fail("denied tool must not execute"); }, {
    access: "protected",
    authentication: {
      verifier: { async verifyAccessToken() {
        verifications++;
        assert.ok(trace.getActiveSpan(), "asynchronous authentication inherits the request span");
        await delay(1);
        assert.ok(trace.getActiveSpan());
        throw new OAuthError(OAuthErrorCode.InvalidToken, secret);
      } },
      metadata: {
        resourceServerUrl: new URL("https://api.example/mcp"),
        oauthMetadata: {
          issuer: "https://auth.example",
          authorization_endpoint: "https://auth.example/authorize",
          token_endpoint: "https://auth.example/token",
          response_types_supported: ["code"],
        },
      },
    },
  });
  const response = await request(running.url);
  assert.equal(response.status, 401);
  assert.doesNotMatch(await response.text(), new RegExp(secret));
  await delay(0);
  assert.equal(verifications, 1);
  assert.equal(requestSpans(exporter).length, 1);
  const [span] = requestSpans(exporter);
  assert.equal(span.attributes["http.response.status_code"], 401);
  assert.doesNotMatch(JSON.stringify({ attributes: span.attributes, events: span.events }), new RegExp(secret));
});
