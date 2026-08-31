import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createMcpFastifyApp } from "@modelcontextprotocol/fastify";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, InMemoryServerEventBus, McpServer } from "@modelcontextprotocol/server";
import { readMessages } from "../fixtures/proxy-progress.mjs";
import { listenOptions, startSubscriptionProbe } from "../fixtures/subscription-sdk.mjs";

test("shared stream reader keeps its default and checks an explicit byte budget", async () => {
  const frame = Buffer.from(`event: message\ndata: ${JSON.stringify({
    jsonrpc: "2.0", id: 1, result: { padding: "x".repeat(1_400_000) },
  })}\n\n`);
  const response = { status: 200, headers: new Headers({
    "content-type": "text/event-stream", "x-accel-buffering": "no",
  }), body: [frame] };
  await assert.rejects(readMessages(response), /stream exceeds combined response budget/);
  assert.equal((await readMessages(response, undefined, frame.byteLength)).length, 1);
  await assert.rejects(readMessages(response, undefined, frame.byteLength - 1), /stream exceeds combined response budget/);
  for (const invalid of [0, -1, 1.5, Infinity, NaN]) {
    await assert.rejects(readMessages(response, undefined, invalid), /positive safe integer/);
  }
});

test("SDK feasibility: independent subscription closure through Fastify HTTP", { timeout: 10_000 }, async (t) => {
  const bus = new InMemoryServerEventBus();
  const requests = [];
  const app = createMcpFastifyApp({ host: "127.0.0.1" });
  t.after(async () => {
    await Promise.all(requests.map(({ handler }) => handler.close()));
    app.server.closeAllConnections();
    await app.close();
  });
  app.post("/mcp", async (request, reply) => {
    const handler = createMcpHandler(() => new McpServer(
      { name: "subscription-sdk-probe", version: "0.0.0" },
      { capabilities: { resources: { subscribe: true } }, supportedProtocolVersions: ["2026-07-28"] },
    ), { legacy: "reject", bus, keepAliveMs: 0, maxSubscriptions: 1 });
    const record = { handler, finished: false, closed: once(reply.raw, "close") };
    requests.push(record);
    reply.raw.once("finish", () => { record.finished = true; });
    reply.hijack();
    try { await toNodeHandler(handler)(request.raw, reply.raw, request.body); }
    finally { await handler.close(); }
  });
  await app.listen({ host: "127.0.0.1", port: 0 });
  const url = `http://127.0.0.1:${app.server.address().port}/mcp`;

  async function open(uri, signal = t.signal) {
    const response = await fetch(url, listenOptions(uri, signal));
    const acknowledged = Promise.withResolvers();
    const messages = readMessages(response, (message) => {
      assert.equal((message.params ?? message.result)?._meta?.["io.modelcontextprotocol/subscriptionId"], "same-id");
      if (message.method === "notifications/subscriptions/acknowledged") {
        assert.deepEqual(message.params.notifications, { resourceSubscriptions: [uri] });
        acknowledged.resolve();
      }
    });
    await Promise.race([acknowledged.promise, messages.then(() => assert.fail("missing acknowledgment"))]);
    return { messages, record: requests.at(-1) };
  }

  const first = await open("probe://resource/first");
  const second = await open("probe://resource/second");
  assert.equal(bus.listenerCount, 2);
  await first.record.handler.close();
  const firstMessages = await first.messages;
  await first.record.closed;
  assert.equal(first.record.finished, true);
  assert.equal(second.record.finished, false);
  assert.equal(bus.listenerCount, 1);
  assert.deepEqual(firstMessages.map((message) => message.method ?? message.result.resultType),
    ["notifications/subscriptions/acknowledged", "complete"]);
  assert.equal(firstMessages.at(-1).id, "same-id");

  bus.publish({ kind: "resource_updated", uri: "probe://resource/first" });
  bus.publish({ kind: "tools_list_changed" });
  bus.publish({ kind: "resource_updated", uri: "probe://resource/second" });
  await second.record.handler.close();
  const secondMessages = await second.messages;
  await second.record.closed;
  assert.equal(second.record.finished, true);
  assert.deepEqual(secondMessages.map((message) => message.method ?? message.result.resultType),
    ["notifications/subscriptions/acknowledged", "notifications/resources/updated", "complete"]);
  assert.equal(secondMessages[1].params.uri, "probe://resource/second");
  assert.equal(secondMessages.at(-1).id, "same-id");
  assert.equal(bus.listenerCount, 0);

  const cancelled = new AbortController();
  const third = await open("probe://resource/cancelled", AbortSignal.any([t.signal, cancelled.signal]));
  const disconnected = assert.rejects(third.messages, { name: "AbortError" });
  cancelled.abort();
  await disconnected;
  await third.record.closed;
  assert.equal(bus.listenerCount, 0);
  bus.publish({ kind: "resource_updated", uri: "probe://resource/cancelled" });

  const last = await open("probe://resource/shutdown");
  await Promise.all(requests.map(({ handler }) => handler.close()));
  const shutdownMessages = await last.messages;
  await last.record.closed;
  assert.equal(shutdownMessages.at(-1).result.resultType, "complete");
  assert.equal(last.record.finished, true);
  assert.equal(bus.listenerCount, 0);
});

test("SDK feasibility: capacity, input bounds, expiry and disconnect release listeners", { timeout: 10_000 }, async (t) => {
  const probe = await startSubscriptionProbe({ maxActive: 1, lifetimeMs: 500 });
  t.after(() => probe.close());
  const response = await fetch(probe.url, listenOptions("probe://resource/expiry", t.signal));
  const frames = [];
  const expired = assert.rejects(readMessages(response, (frame) => frames.push(frame)),
    (error) => error.cause?.code === "UND_ERR_SOCKET");
  const record = probe.requests[0];
  const refused = await fetch(probe.url, listenOptions("probe://resource/excess", t.signal));
  assert.equal(refused.status, 503);
  await refused.text();
  assert.equal(probe.requests.length, 1, "capacity refusal must not create a handler");
  await expired;
  await record.closed;
  assert.equal(record.reason, "deadline");
  assert.equal(probe.active.size, 0);
  assert.equal(probe.bus.listenerCount, 0);
  assert.deepEqual(frames.map((frame) => frame.method), ["notifications/subscriptions/acknowledged"]);
  const invalid = await fetch(probe.url, listenOptions(`probe://${"x".repeat(513)}`, t.signal));
  assert.equal(invalid.status, 400);
  await invalid.text();
  assert.equal(probe.requests.length, 1, "input refusal must not create a handler");
  const cancelled = new AbortController();
  const reopened = await fetch(probe.url, listenOptions("probe://resource/reopened",
    AbortSignal.any([t.signal, cancelled.signal])));
  assert.equal(reopened.status, 200, "expiry must release admission capacity");
  const disconnected = assert.rejects(readMessages(reopened), { name: "AbortError" });
  cancelled.abort();
  await disconnected;
  await probe.requests.at(-1).closed;
  assert.equal(probe.active.size, 0);
  assert.equal(probe.bus.listenerCount, 0);
});

// Feasibility only: caps total generated event bytes, not measured heap or a
// rolling queue. A production design also needs shared capacity and deadlines.
test("SDK feasibility: bounded event admission isolates overflow", { timeout: 10_000 }, async (t) => {
  const probe = await startSubscriptionProbe();
  t.after(() => probe.close());
  const { bus, requests, url } = probe;
  async function open(uri) {
    const response = await fetch(url, listenOptions(uri, t.signal));
    const observed = [];
    const acknowledgment = Promise.withResolvers();
    const reading = readMessages(response, (message) => {
      observed.push(message);
      if (message.method === "notifications/subscriptions/acknowledged") acknowledgment.resolve();
    });
    // Retain partial frames even when the socket is intentionally terminated.
    const outcome = reading.then(() => ({ ended: true }), (error) => ({ error }));
    await Promise.race([acknowledgment.promise, outcome.then(() => assert.fail("missing acknowledgment"))]);
    return { observed, outcome, record: requests.at(-1) };
  }

  const first = await open("probe://resource/first");
  const peer = await open("probe://resource/peer");
  for (let i = 0; i < 5; i++) {
    bus.publish({ kind: "resource_updated", uri: "probe://resource/unrelated" });
    bus.publish({ kind: "tools_list_changed" });
  }
  assert.equal(first.record.admitted, 0);
  assert.equal(peer.record.admitted, 0);
  for (let i = 0; i < 4; i++) bus.publish({ kind: "resource_updated", uri: "probe://resource/first" });
  assert.equal(first.record.admitted, 4);
  assert.equal(first.record.reason, undefined);
  bus.publish({ kind: "resource_updated", uri: "probe://resource/first" });
  await first.record.closed;
  const overflowError = (await first.outcome).error;
  assert.equal(overflowError?.name, "TypeError");
  assert.equal(overflowError?.cause?.code, "UND_ERR_SOCKET", "require a socket termination, not a parser failure");
  assert.equal(first.record.reason, "event-count");
  assert.ok(first.record.bytes <= 4 * 256);
  assert.ok(first.observed.every((message) => !message.result), "no complete frame on overflow");
  assert.equal(bus.listenerCount, 1);
  bus.publish({ kind: "resource_updated", uri: "probe://resource/first" });
  assert.equal(first.record.admitted, 4, "no post-termination admission");
  bus.publish({ kind: "resource_updated", uri: "probe://resource/peer" });
  await peer.record.handler.close();
  assert.deepEqual(await peer.outcome, { ended: true });
  assert.deepEqual(peer.observed.map((message) => message.method ?? message.result.resultType),
    ["notifications/subscriptions/acknowledged", "notifications/resources/updated", "complete"]);
  assert.equal(peer.observed[1].params.uri, "probe://resource/peer");

  const oversized = await open(`probe://resource/${"x".repeat(180)}`);
  bus.publish({ kind: "resource_updated", uri: `probe://resource/${"x".repeat(180)}` });
  await oversized.record.closed;
  const sizeError = (await oversized.outcome).error;
  assert.equal(sizeError?.name, "TypeError");
  assert.equal(sizeError?.cause?.code, "UND_ERR_SOCKET");
  assert.equal(oversized.record.reason, "event-size");
  assert.equal(oversized.record.admitted, 0);
  assert.equal(oversized.observed.length, 1, "oversized notification never emitted");
  assert.equal(bus.listenerCount, 0);
});
