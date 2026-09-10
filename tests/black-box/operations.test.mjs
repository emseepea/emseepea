import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { createEmseepea, defineStreamingTool, defineTool, serveEmseepea } from "@emseepea/server";
import { insecureTestAuthentication } from "@emseepea/testing";
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
  assert.equal(await response.text(), response.status === 200 ? "ready\n" : "not ready\n");
  return response.status;
}

test("invalid operation callbacks and timeouts are rejected before listening", async () => {
  for (const value of [null, false, "callback", {}]) {
    assert.throws(() => createEmseepea({ ...options, readiness: value }), /readiness must be a function/);
  }
  for (const value of [0, -1, 1.5, Number.NaN, Infinity, 60_001, "10", null]) {
    assert.throws(
      () => createEmseepea({ ...options, readiness: () => true, readinessTimeoutMs: value }),
      /readinessTimeoutMs/,
    );
    const app = createEmseepea(options);
    await assert.rejects(
      serveEmseepea(app, { port: 0, observabilityFlushTimeoutMs: value }),
      /observabilityFlushTimeoutMs/,
    );
    await app.close();
  }
  assert.throws(() => createEmseepea({ ...options, readinessTimeoutMs: 10 }), /requires readiness/);
});

test("readiness tracks dependency failure and recovery without disabling independent tools", async (t) => {
  let healthy = true;
  let calls = 0;
  const tool = defineTool({
    name: "progress",
    access: "public",
    description: "Return one value.",
    inputSchema: z.object({ id: z.string(), mode: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    handler: () => { calls += 1; return result; },
  });
  const running = await start(t, { readiness: () => healthy, tools: [tool] });
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
});

test("probe failures and timeouts reveal no details", async (t) => {
  for (const readiness of [() => { throw new Error(secret); }, () => Promise.reject(new Error(secret))]) {
    assert.equal(await ready(await start(t, { readiness })), 503);
  }
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const overdue = await start(t, {
    readinessTimeoutMs: 10,
    readiness: () => { now += 40; return true; },
  });
  assert.equal(await ready(overdue), 503);
});

test("timed-out probes retain their single-flight slot until late settlement", async (t) => {
  let calls = 0;
  let settle;
  let signal;
  const running = await start(t, {
    readinessTimeoutMs: 30,
    readiness: (context) => {
      calls += 1;
      signal = context.signal;
      return new Promise((resolve) => { settle = resolve; });
    },
  });
  assert.deepEqual(await Promise.all([ready(running), ready(running), ready(running)]), [503, 503, 503]);
  assert.equal(calls, 1);
  assert.equal(signal.aborted, true);
  assert.equal(await ready(running), 503);
  assert.equal(calls, 1);
  settle(true);
  await delay(0);
});

test("shutdown aborts work, stops admission, shares one close, and flushes observability", async (t) => {
  let cancelled = false;
  let flushed = 0;
  const tool = defineStreamingTool({
    name: "progress",
    access: "protected",
    requiredScopes: ["progress:run"],
    description: "Report progress.",
    inputSchema: z.object({ id: z.string(), mode: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    async handler(_input, { reportProgress, signal }) {
      await reportProgress({ progress: 1, total: 2 });
      try { await delay(5_000, undefined, { signal }); }
      finally { cancelled = signal.aborted; }
      return result;
    },
  });
  const running = await start(t, {
    tools: [tool],
    authentication: insecureTestAuthentication(["progress:run"], "public"),
    observability: [{ id: "test", emit() {}, flush() { flushed += 1; } }],
  }, { shutdownTimeoutMs: 40, observabilityFlushTimeoutMs: 100 });
  const response = await fetch(running.url, callOptions("shutdown", "normal", { authToken: "test-token" }));
  const reader = response.body.getReader();
  await reader.read();
  const closing = running.close();
  assert.equal(closing, running.close());
  await closing;
  assert.equal(cancelled, true);
  assert.equal(flushed, 1);
  await assert.rejects(fetch(new URL("/readyz", running.url)));
  await assert.rejects(async () => { while (!(await reader.read()).done) { /* Drain. */ } }, /terminated/);
});
