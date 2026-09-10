import assert from "node:assert/strict";
import { request } from "node:http";
import { setImmediate as turn, setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import {
  createEmseepea,
  defineResourceTemplate,
  notifyResourceUpdated,
  serveEmseepea,
} from "@emseepea/server";
import { readMessages } from "../fixtures/proxy-progress.mjs";

// Same-process client/server safety ceilings, not framework performance guarantees.
const limits = { concurrency: 16, batches: 8, events: 256, eventBytes: 8_192,
  pauseMs: 250, sampledRssBytes: 384 * 1024 * 1024, retainedHeapGrowthBytes: 24 * 1024 * 1024 };

test("framework subscriptions stay bounded with paused HTTP readers", { timeout: 120_000 }, async (t) => {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "Run load qualification in GitHub Actions");
  assert.equal(typeof globalThis.gc, "function", "memory qualification requires --expose-gc");
  const app = createEmseepea({
    name: "subscription-load-test",
    version: "0.0.0",
    resources: [defineResourceTemplate({
      access: "public",
      name: "record",
      uriTemplate: "probe://records/{id}",
      handler: ({ uri }) => ({ contents: [{ uri, text: "record" }] }),
    })],
    resourceSubscriptions: {
      maxActive: limits.concurrency + 1,
      maxEvents: limits.events,
      maxEventBytes: limits.eventBytes,
      maxUriBytes: limits.eventBytes,
    },
  });
  const running = await serveEmseepea(app, { port: 0 });
  t.after(() => running.close());
  let sampledPeakRss = process.memoryUsage().rss;
  let samples = 0;
  const sample = () => { samples++; sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage().rss); };
  const timer = setInterval(sample, 10);
  t.after(() => clearInterval(timer));
  console.log(JSON.stringify({ profile: "framework-resource-subscriptions", node: process.version, limits }));

  for (let index = 0; index < limits.concurrency; index++) {
    const controller = new AbortController();
    const warm = await open(running.url, `probe://records/warm-${index}`, controller.signal);
    controller.abort();
    await assert.rejects(warm.outcome, { name: "AbortError" });
    await turn();
  }
  globalThis.gc();
  const baselineHeap = process.memoryUsage().heapUsed;

  for (let batch = 0; batch < limits.batches; batch++) {
    const peerController = new AbortController();
    const peerUri = `probe://records/peer-${batch}`;
    const peer = await open(running.url, peerUri, peerController.signal);
    const paused = await Promise.all(Array.from({ length: limits.concurrency }, (_, index) =>
      openPaused(running.url, `probe://records/${batch}-${index}-${"x".repeat(7_700)}`, t.signal)));

    for (let event = 0; event < limits.events; event++) {
      for (const reader of paused) notifyResourceUpdated(app, reader.uri);
      if (event % 16 === 0) { sample(); await turn(); }
    }
    const samplesBeforePause = samples;
    await delay(limits.pauseMs);
    assert.ok(samples > samplesBeforePause, "no memory samples during reader pause");
    assert.ok(paused.every(({ incoming }) => incoming.isPaused()), "reader resumed before measurement");

    for (const reader of paused) notifyResourceUpdated(app, reader.uri);
    await Promise.all(paused.map(async (reader) => {
      await assert.rejects(reader.read(), (error) =>
        ["ECONNRESET", "ERR_STREAM_PREMATURE_CLOSE"].includes(error.code));
    }));

    notifyResourceUpdated(app, peerUri);
    await peer.updated;
    peerController.abort();
    await assert.rejects(peer.outcome, { name: "AbortError" });
    await turn();

    const reopenedController = new AbortController();
    const reopened = await open(running.url, `probe://records/reopened-${batch}`, reopenedController.signal);
    reopenedController.abort();
    await assert.rejects(reopened.outcome, { name: "AbortError" });
    for (const reader of paused) notifyResourceUpdated(app, reader.uri);

    globalThis.gc(); sample();
    const retainedHeapGrowth = process.memoryUsage().heapUsed - baselineHeap;
    console.log(JSON.stringify({ batch, sampledPeakRss, retainedHeapGrowth, samples }));
    assert.ok(sampledPeakRss <= limits.sampledRssBytes, "sampled process RSS exceeded the test ceiling");
    assert.ok(retainedHeapGrowth <= limits.retainedHeapGrowthBytes, "retained heap exceeded the test ceiling");
  }
});

async function open(url, uri, signal) {
  const response = await fetch(url, listenOptions(uri, signal));
  const acknowledged = Promise.withResolvers();
  const updated = Promise.withResolvers();
  const reading = readMessages(response, (message) => {
    if (message.method === "notifications/subscriptions/acknowledged") acknowledged.resolve();
    if (message.method === "notifications/resources/updated") updated.resolve();
  });
  const outcome = reading.then(() => ({ ended: true }));
  await Promise.race([acknowledged.promise, outcome.then(() => assert.fail("missing acknowledgment"))]);
  return { outcome, updated: updated.promise };
}

function openPaused(url, uri, signal) {
  const options = listenOptions(uri, signal);
  return new Promise((resolve, reject) => {
    let failure;
    const outgoing = request(url, options, (incoming) => {
      incoming.pause();
      incoming.once("error", (error) => { failure = error; });
      resolve({
        uri,
        incoming,
        async read() {
          if (failure) throw failure;
          return readMessages(
            { status: incoming.statusCode, headers: new Headers(incoming.headers), body: incoming },
            undefined,
            limits.events * limits.eventBytes + 65_536,
          );
        },
      });
    });
    outgoing.once("error", reject);
    outgoing.end(options.body);
  });
}

function listenOptions(uri, signal) {
  return {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-method": "subscriptions/listen",
      "mcp-protocol-version": "2026-07-28",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "subscriptions/listen",
      params: {
        notifications: { resourceSubscriptions: [uri] },
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "subscription-load-test", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  };
}
