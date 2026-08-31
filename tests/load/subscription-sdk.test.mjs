import assert from "node:assert/strict";
import { request } from "node:http";
import { setImmediate as turn, setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { readMessages } from "../fixtures/proxy-progress.mjs";
import { listenOptions, startSubscriptionProbe } from "../fixtures/subscription-sdk.mjs";

// Same-process client/server feasibility ceilings, not framework performance guarantees.
const limits = { concurrency: 16, batches: 8, events: 256, eventBytes: 8_192,
  pauseMs: 250, sampledRssBytes: 384 * 1024 * 1024, retainedHeapGrowthBytes: 24 * 1024 * 1024 };

test("SDK finite admission stays bounded with paused HTTP readers", { timeout: 120_000 }, async (t) => {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "Run load qualification in GitHub Actions");
  assert.equal(typeof globalThis.gc, "function", "memory qualification requires --expose-gc");
  const probe = await startSubscriptionProbe({ maxEvents: limits.events, maxEventBytes: limits.eventBytes,
    maxUriBytes: 8_192, maxActive: limits.concurrency + 1 });
  t.after(() => probe.close());
  let sampledPeakRss = process.memoryUsage().rss;
  let samples = 0;
  const sample = () => { samples++; sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage().rss); };
  const timer = setInterval(sample, 10);
  t.after(() => clearInterval(timer));
  console.log(JSON.stringify({ profile: "sdk-finite-admission-same-process", node: process.version, limits }));

  // Warm the actual HTTP path before the retained-heap baseline.
  for (let i = 0; i < limits.concurrency; i++) {
    const response = await fetch(probe.url, listenOptions(`probe://warm/${i}`, t.signal));
    const reading = readMessages(response);
    await probe.requests.at(-1).handler.close();
    await reading;
  }
  await Promise.all(probe.requests.map((record) => record.closed));
  probe.requests.length = 0;
  globalThis.gc();
  const baselineHeap = process.memoryUsage().heapUsed;
  for (let batch = 0; batch < limits.batches; batch++) {
    const peerUri = `probe://peer/${batch}`;
    const peerResponse = await fetch(probe.url, listenOptions(peerUri, t.signal));
    const peerRecord = probe.requests.at(-1);
    const peerMessages = readMessages(peerResponse);
    const paused = await Promise.all(Array.from({ length: limits.concurrency }, (_, index) =>
      openPaused(probe.url, `probe://batch/${batch}/${index}/${"x".repeat(7_700)}`, t.signal)));
    const records = paused.map(({ uri }) => probe.requests.find((record) => record.uri === uri));
    assert.equal(probe.active.size, limits.concurrency + 1);
    for (let event = 0; event < limits.events; event++) {
      for (const record of records) probe.bus.publish({ kind: "resource_updated", uri: record.uri });
      // Allow the HTTP bridge and sampling timer to run during production too.
      if (event % 16 === 0) { sample(); await turn(); }
    }
    const samplesBeforePause = samples;
    await delay(limits.pauseMs);
    assert.ok(samples > samplesBeforePause, "no memory samples during reader pause");
    assert.ok(paused.every(({ incoming }) => incoming.isPaused()), "reader resumed before measurement");
    let admittedBytes = 0;
    for (const record of records) {
      assert.equal(record.admitted, limits.events);
      assert.equal(record.reason, undefined);
      assert.ok(record.bytes >= limits.events * 7_168, "exercise real large frames, not just a large configured limit");
      assert.ok(record.bytes <= limits.events * limits.eventBytes);
      admittedBytes += record.bytes;
    }
    // Overflow half the readers; the rest must still receive every event and completion.
    for (const [index, record] of records.entries()) {
      if (index % 2 === 0) probe.bus.publish({ kind: "resource_updated", uri: record.uri });
      else await record.handler.close();
    }
    probe.bus.publish({ kind: "resource_updated", uri: peerUri });
    await peerRecord.handler.close();
    const peerFrames = await peerMessages;
    assert.deepEqual(peerFrames.map((frame) => frame.method ?? frame.result.resultType),
      ["notifications/subscriptions/acknowledged", "notifications/resources/updated", "complete"]);
    assert.equal(peerFrames[1].params.uri, peerUri);
    await Promise.all(paused.map(async (reader, index) => {
      if (index % 2 === 0) {
        await assert.rejects(reader.read(), (error) => ["ECONNRESET", "ERR_STREAM_PREMATURE_CLOSE"].includes(error.code));
        assert.equal(records[index].reason, "event-count");
      } else {
        const frames = await reader.read();
        assert.equal(frames.length, limits.events + 2);
        assert.equal(frames[0].method, "notifications/subscriptions/acknowledged");
        assert.ok(frames.slice(1, -1).every((frame) =>
          frame.method === "notifications/resources/updated" && frame.params.uri === reader.uri));
        assert.equal(frames.at(-1).result.resultType, "complete");
      }
    }));
    await Promise.all(probe.requests.map((record) => record.closed));
    assert.equal(probe.active.size, 0);
    assert.equal(probe.bus.listenerCount, 0);
    for (const record of records) {
      probe.bus.publish({ kind: "resource_updated", uri: record.uri });
      assert.equal(record.admitted, limits.events, "no admission after closure");
    }
    probe.requests.length = 0;
    await turn();
    globalThis.gc(); sample();
    const retainedHeapGrowth = process.memoryUsage().heapUsed - baselineHeap;
    console.log(JSON.stringify({ batch, admittedBytes, sampledPeakRss, retainedHeapGrowth, samples }));
    assert.ok(sampledPeakRss <= limits.sampledRssBytes, "sampled process RSS exceeded the test ceiling");
    assert.ok(retainedHeapGrowth <= limits.retainedHeapGrowthBytes, "retained heap exceeded the test ceiling");
  }
});

function openPaused(url, uri, signal) {
  const options = listenOptions(uri, signal);
  return new Promise((resolve, reject) => {
    let failure;
    const outgoing = request(url, options, (incoming) => {
      incoming.pause();
      incoming.once("error", (error) => { failure = error; });
      resolve({ uri, incoming,
        async read() {
          if (failure) throw failure;
          // Event allowance plus a bounded acknowledgment and terminal frame.
          return readMessages({ status: incoming.statusCode, headers: new Headers(incoming.headers), body: incoming },
            undefined, limits.events * limits.eventBytes + 65_536);
        },
      });
    });
    outgoing.once("error", (error) => { failure = error; reject(error); });
    outgoing.end(options.body);
  });
}
