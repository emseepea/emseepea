import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createMcpFastifyApp } from "@modelcontextprotocol/fastify";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, InMemoryServerEventBus, McpServer } from "@modelcontextprotocol/server";
import { readMessages } from "../fixtures/proxy-progress.mjs";

function listenOptions(uri, signal) {
  return {
    method: "POST", signal,
    headers: {
      "content-type": "application/json", accept: "application/json, text/event-stream",
      "mcp-method": "subscriptions/listen", "mcp-protocol-version": "2026-07-28",
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "same-id", method: "subscriptions/listen",
      params: {
        notifications: { resourceSubscriptions: [uri], toolsListChanged: true },
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "subscription-probe", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  };
}

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

// Feasibility only: caps total generated event bytes, not measured heap or a
// rolling queue. A production design also needs shared capacity and deadlines.
test("SDK feasibility: bounded event admission isolates overflow", { timeout: 10_000 }, async (t) => {
  const bus = new InMemoryServerEventBus();
  const requests = [];
  const app = createMcpFastifyApp({ host: "127.0.0.1", bodyLimit: 4_096 });
  t.after(async () => {
    for (const record of requests) record.stop();
    await Promise.all(requests.map((record) => record.closed));
    app.server.closeAllConnections();
    await app.close();
  });
  app.post("/mcp", async (request, reply) => {
    const uri = request.body?.params?.notifications?.resourceSubscriptions?.[0];
    if (request.body?.id !== "same-id" || typeof uri !== "string" || Buffer.byteLength(uri) > 512) {
      return reply.code(400).send({ error: "Probe input limit" });
    }
    let ended = false;
    let detach = () => {};
    const record = {
      admitted: 0, bytes: 0, reason: undefined,
      closed: once(reply.raw, "close"),
      stop(reason) {
        if (ended) return;
        ended = true;
        record.reason = reason;
        detach();
        reply.raw.destroy();
      },
    };
    const boundedBus = {
      publish: (event) => bus.publish(event),
      subscribe(listener) {
        detach = bus.subscribe((event) => {
          // Filter before charging capacity; an unrelated publisher cannot
          // disconnect this request or consume its allowance.
          if (ended || event.kind !== "resource_updated" || event.uri !== uri) return;
          const frame = `event: message\ndata: ${JSON.stringify({
            jsonrpc: "2.0", method: "notifications/resources/updated",
            params: { uri, _meta: { "io.modelcontextprotocol/subscriptionId": "same-id" } },
          })}\n\n`;
          const bytes = Buffer.byteLength(frame);
          if (bytes > 256) return record.stop("event-size");
          if (record.admitted === 4) return record.stop("event-count");
          record.admitted++;
          record.bytes += bytes;
          listener(event);
        });
        return () => { ended = true; detach(); };
      },
    };
    const handler = createMcpHandler(() => new McpServer(
      { name: "subscription-bounds-probe", version: "0.0.0" },
      { capabilities: { resources: { subscribe: true } }, supportedProtocolVersions: ["2026-07-28"] },
    ), { legacy: "reject", bus: boundedBus, keepAliveMs: 0, maxSubscriptions: 1 });
    record.handler = handler;
    requests.push(record);
    reply.hijack();
    try { await toNodeHandler(handler)(request.raw, reply.raw, request.body); }
    finally {
      // Observe abort before SDK cleanup, which otherwise emits "complete".
      await record.closed;
      await handler.close();
    }
  });
  await app.listen({ host: "127.0.0.1", port: 0 });
  const url = `http://127.0.0.1:${app.server.address().port}/mcp`;
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
