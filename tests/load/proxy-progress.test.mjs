import assert from "node:assert/strict";
import { request } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { callOptions, checkMessages, checkedCall, disconnectCall, readMessages, startCluster, waitForIdle } from "../fixtures/proxy-progress.mjs";

// These are qualification ceilings, not throughput promises. Run on CI, not an adopter's laptop.
const limits = { concurrency: 16, batches: 8, pauseMs: 250, peakRssBytes: 384 * 1024 * 1024,
  retainedHeapGrowthBytes: 24 * 1024 * 1024 };

test("proxy streams stay isolated and bounded under load and paused readers", { timeout: 120_000 }, async (t) => {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "Run load qualification in GitHub Actions");
  assert.equal(typeof globalThis.gc, "function", "memory qualification requires --expose-gc");
  console.log(JSON.stringify({ profile: "two-process-http-proxy", node: process.version, limits }));
  const cluster = await startCluster();
  t.after(() => cluster.close());
  let parentPeak = process.memoryUsage().rss;
  let parentSamples = 0;
  const sample = () => { parentSamples++; parentPeak = Math.max(parentPeak, process.memoryUsage().rss); };
  const sampler = setInterval(sample, 10);
  t.after(() => clearInterval(sampler));
  const instances = new Set();
  let cancelled = 0;
  const measurements = [];

  await Promise.all(Array.from({ length: limits.concurrency }, (_, index) => checkedCall(cluster, `warm-${index}`, "burst")));
  globalThis.gc();
  const baseline = { parent: process.memoryUsage().heapUsed, children: await cluster.stats() };
  for (let batch = 0; batch < limits.batches; batch++) {
    const paused = await Promise.all(Array.from({ length: limits.concurrency }, (_, index) =>
      openPausedCall(cluster, `paused-${batch}-${index}`)));
    const beforePause = await cluster.stats();
    const samplesBeforePause = parentSamples;
    await delay(limits.pauseMs);
    const duringPause = await cluster.stats();
    assert.ok(parentSamples > samplesBeforePause, "missing proxy/client samples during pause");
    assert.ok(duringPause.every((child, index) => child.samples > beforePause[index].samples), "missing child samples during pause");
    assert.ok(paused.every((reader) => reader.incoming.isPaused()), "reader resumed before measurement");
    for (const instance of await Promise.all(paused.map((reader) => reader.read()))) instances.add(instance);
    const modes = ["normal", "event-size", "event-count", "result-size", "timeout", "disconnect"];
    await Promise.all(Array.from({ length: limits.concurrency }, async (_, index) => {
      const mode = modes[index % modes.length];
      const id = `case-${batch}-${index}`;
      if (mode === "disconnect") {
        cancelled++;
        await disconnectCall(cluster, id);
      } else {
        if (mode === "timeout") cancelled++;
        instances.add(await checkedCall(cluster, id, mode));
      }
    }));
    const children = await waitForIdle(cluster, cancelled);
    globalThis.gc(); sample();
    const parentHeap = process.memoryUsage().heapUsed;
    measurements.push({ batch, parentHeap, parentPeak, parentSamples, duringPause, children });
    console.log(JSON.stringify(measurements.at(-1)));
    assert.ok(parentPeak <= limits.peakRssBytes, "proxy/client RSS exceeded limit");
    assert.ok(parentHeap - baseline.parent <= limits.retainedHeapGrowthBytes, "proxy/client retained heap grew");
    for (const [index, child] of children.entries()) {
      assert.ok(child.peakRss <= limits.peakRssBytes, "server RSS exceeded limit");
      assert.ok(child.heap - baseline.children[index].heap <= limits.retainedHeapGrowthBytes, "server retained heap grew");
    }
  }
  assert.ok(parentSamples > 0);
  assert.deepEqual([...instances].sort(), ["one", "two"]);
});

function openPausedCall(cluster, id) {
  const options = callOptions(id, "burst");
  return new Promise((resolve, reject) => {
    let failure;
    const outgoing = request(cluster.url, options, (incoming) => {
      incoming.pause();
      incoming.once("error", (error) => { failure = error; });
      incoming.once("aborted", () => { failure = new Error("paused response aborted"); });
      resolve({ incoming,
        async read() {
          if (failure) throw failure;
          // Begin consuming only after the pause; all frames must still survive through EOF.
          const response = { status: incoming.statusCode, headers: new Headers(incoming.headers), body: incoming };
          return checkMessages(await readMessages(response), id, "burst");
        },
      });
    });
    outgoing.once("error", (error) => { failure = error; reject(error); });
    outgoing.end(options.body);
  });
}
