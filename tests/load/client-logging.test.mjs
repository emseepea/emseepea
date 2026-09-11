import assert from "node:assert/strict";
import { request } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

// These are qualification ceilings, not throughput promises. Run on CI, not an adopter's laptop.
const limits = {
  concurrency: 16,
  batches: 8,
  pauseMs: 250,
  peakRssBytes: 384 * 1024 * 1024,
  retainedHeapGrowthBytes: 24 * 1024 * 1024,
};

test("request logs stay bounded under load and paused readers", { timeout: 120_000 }, async (t) => {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "Run load qualification in GitHub Actions");
  assert.equal(typeof globalThis.gc, "function", "memory qualification requires --expose-gc");
  console.log(JSON.stringify({ profile: "request-scoped-client-logging", node: process.version, limits }));

  const tool = defineTool({
    name: "load-logs", access: "public", description: "Emit bounded synthetic request logs.",
    inputSchema: z.object({ id: z.string() }), outputSchema: z.object({ ok: z.literal(true) }),
    async handler({ id }, { reportLog }) {
      for (let index = 0; index < 32; index++) {
        await reportLog({ level: "debug", data: { id, index, padding: "x".repeat(7_800) } });
      }
      return { data: { ok: true } };
    },
  });
  const running = await serveEmseepea(createEmseepea({
    name: "client-logging-load", version: "0.0.0", tools: [tool], clientLogging: {},
  }), { port: 0 });
  t.after(() => running.close());

  for (let index = 0; index < limits.concurrency; index++) {
    await openPausedCall(running.url, `warm-${index}`).then((reader) => reader.read());
  }
  globalThis.gc();
  const baselineHeap = process.memoryUsage().heapUsed;
  let peakRss = process.memoryUsage().rss;
  let samples = 0;
  const sampler = setInterval(() => {
    samples += 1;
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 10);
  t.after(() => clearInterval(sampler));

  for (let batch = 0; batch < limits.batches; batch++) {
    const paused = await Promise.all(Array.from({ length: limits.concurrency }, (_, index) =>
      openPausedCall(running.url, `batch-${batch}-${index}`)));
    await delay(limits.pauseMs);
    assert.ok(paused.every(({ incoming }) => incoming.isPaused()), "reader resumed before measurement");
    await Promise.all(paused.map((reader) => reader.read()));
    globalThis.gc();
    const retainedHeapGrowth = process.memoryUsage().heapUsed - baselineHeap;
    console.log(JSON.stringify({ batch, peakRss, retainedHeapGrowth, samples }));
    assert.ok(peakRss <= limits.peakRssBytes, "server/client RSS exceeded limit");
    assert.ok(retainedHeapGrowth <= limits.retainedHeapGrowthBytes, "retained heap grew");
  }
  assert.ok(samples > 0);
});

function openPausedCall(url, id) {
  const body = JSON.stringify({
    jsonrpc: "2.0", id, method: "tools/call",
    params: {
      name: "load-logs", arguments: { id },
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { name: "client-logging-load", version: "0.0.0" },
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/logLevel": "debug",
      },
    },
  });
  return new Promise((resolve, reject) => {
    const outgoing = request(url, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "MCP-Protocol-Version": "2026-07-28",
        "Mcp-Method": "tools/call",
        "Mcp-Name": "load-logs",
      },
    }, (incoming) => {
      incoming.pause();
      resolve({
        incoming,
        async read() {
          const chunks = [];
          for await (const chunk of incoming) chunks.push(chunk);
          const response = Buffer.concat(chunks).toString("utf8");
          assert.equal(incoming.statusCode, 200);
          assert.equal(response.match(/"method":"notifications\/message"/g)?.length, 32);
          assert.equal(response.match(/"resultType":"complete"/g)?.length, 1);
        },
      });
    });
    outgoing.once("error", reject);
    outgoing.end(body);
  });
}
