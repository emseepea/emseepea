import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const concurrency = 16;
const durationMs = 1_000;
const runs = 3;
const cpuMeasuredRequests = 400;
const cpuBatchCount = 40;
const cpuRequestsPerBatch = 10;
const allocationSamples = 40;
const modernRequestBody = JSON.stringify({
  jsonrpc: "2.0",
  id: "benchmark",
  method: "tools/call",
  params: {
    name: "synthetic-read",
    arguments: { id: "bench" },
    _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { name: "emseepea-benchmark", version: "0.0.0" },
      "io.modelcontextprotocol/clientCapabilities": {},
    },
  },
});
const modernHeaders = {
  Accept: "application/json, text/event-stream",
  "Content-Type": "application/json",
  "MCP-Protocol-Version": "2026-07-28",
  "Mcp-Method": "tools/call",
  "Mcp-Name": "synthetic-read",
  "Mcp-Param-Id": "bench",
};
const richRequestBody = modernRequestBody.replaceAll("synthetic-read", "synthetic-rich-read");
const richHeaders = {
  ...modernHeaders,
  "Mcp-Name": "synthetic-rich-read",
};
const convenienceApplicationBytes = Buffer.byteLength(JSON.stringify({ id: "bench", value: "synthetic" })) +
  Buffer.byteLength("synthetic") + Buffer.byteLength(JSON.stringify({ id: "bench" }));
const profiles = [
  {
    name: "modern-2026-07-28",
    requestBody: modernRequestBody,
    headers: modernHeaders,
    applicationBytes: convenienceApplicationBytes,
    note: "server process only; mapped synthetic adapter",
  },
  {
    name: "modern-2026-07-28-protocol-native-result",
    requestBody: richRequestBody,
    headers: richHeaders,
    applicationBytes: Buffer.byteLength(JSON.stringify([{ type: "text", text: "synthetic" }])) +
      Buffer.byteLength(JSON.stringify(["bench", "synthetic"])) +
      Buffer.byteLength(JSON.stringify({ "benchmark/kind": "protocol-native" })) +
      Buffer.byteLength(JSON.stringify({ id: "bench" })),
    note: "server process only; checked protocol-native result",
  },
  {
    name: "legacy-2025-11-25",
    requestBody: JSON.stringify({
      jsonrpc: "2.0",
      id: "benchmark",
      method: "tools/call",
      params: { name: "synthetic-read", arguments: { id: "bench" } },
    }),
    headers: {
      Accept: "application/json, text/event-stream",
      Connection: "close",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2025-11-25",
    },
    applicationBytes: convenienceApplicationBytes,
    note: "server process only; mapped synthetic adapter",
  },
];
let nextMessageId = 0;

const observabilityEnabled = process.argv.includes("--observability");
let child;
let serverUrl;

try {
  const measurements = {};
  for (const profile of profiles) {
    ({ child, serverUrl } = await startServer());
    measurements[profile.name] = await measureProfile(profile);
    await ask("shutdown");
    child = undefined;
  }
  const result = {
    profile: {
      observability: observabilityEnabled ? "OpenTelemetry adapter, no exporter" : "disabled",
      node: process.version,
      profileName: process.env.EMSEEPEA_BENCHMARK_PROFILE ?? "local",
      platform: `${process.platform}-${process.arch}`,
      cpu: cpus()[0]?.model ?? "unknown",
      logicalCpus: cpus().length,
      concurrency,
      durationMs,
      runs,
      cpuMeasuredRequests,
      cpuBatchCount,
      cpuRequestsPerBatch,
      cpuP95: "batch-amortized per-request samples",
      allocationSamples,
    },
    measurements,
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (child?.connected) await ask("shutdown");
}

async function startServer() {
  const serverChild = fork(
    fileURLToPath(new URL("./json-boundary-server.mjs", import.meta.url)),
    observabilityEnabled ? ["--observability"] : [],
    { execArgv: ["--expose-gc"], stdio: ["ignore", "inherit", "inherit", "ipc"] },
  );
  const url = await new Promise((resolve, reject) => {
    serverChild.once("error", reject);
    serverChild.on("message", (message) => {
      if (message?.type === "ready") resolve(new URL(message.url));
    });
  });
  return { child: serverChild, serverUrl: url };
}

async function measureProfile(profile) {
  for (let index = 0; index < 100; index += 1) await validRequest(profile);
  const throughput = [];
  for (let run = 0; run < runs; run += 1) {
    const startedAt = performance.now();
    const deadline = startedAt + durationMs;
    const completed = await Promise.all(Array.from({ length: concurrency }, async () => {
      let count = 0;
      while (performance.now() < deadline) {
        await validRequest(profile);
        count += 1;
      }
      return count;
    }));
    throughput.push(completed.reduce((sum, value) => sum + value, 0) /
      ((performance.now() - startedAt) / 1_000));
  }
  const cpuMs = [];
  const allocations = [];
  for (let index = 0; index < cpuBatchCount; index += 1) {
    await ask("cpu-start");
    for (let request = 0; request < cpuRequestsPerBatch; request += 1) await validRequest(profile);
    cpuMs.push((await ask("cpu-stop")).value / cpuRequestsPerBatch);
  }
  for (let index = 0; index < allocationSamples; index += 1) {
    await ask("allocation-start");
    await validRequest(profile);
    allocations.push((await ask("allocation-stop")).value);
  }
  const overheadBytes = [];
  for (let index = 0; index < 10; index += 1) overheadBytes.push(await measureAddedBytes(profile));
  const invalidHeap = [];
  for (let batch = 0; batch < 3; batch += 1) {
    for (let index = 0; index < 100; index += 1) await invalidRequest(profile);
    invalidHeap.push((await ask("heap")).value);
  }
  assert.ok(Math.min(...throughput) >= 100, `${profile.name} throughput fell below 100 requests/second`);
  assert.ok(percentile(cpuMs, 0.95) <= 5, `${profile.name} p95 process CPU exceeded 5 ms/request`);
  assert.ok(percentile(allocations, 0.95) <= 256 * 1024,
    `${profile.name} p95 transient allocation exceeded 256 KiB/request`);
  assert.ok(summary(overheadBytes).mean <= 2 * 1024,
    `${profile.name} average added protocol bytes exceeded 2 KiB/request`);
  assert.ok(Math.max(...invalidHeap) - Math.min(...invalidHeap) <= 1024 * 1024,
    `${profile.name} invalid-input retained heap varied by more than 1 MiB across equal batches`);
  return {
    requestBytes: Buffer.byteLength(profile.requestBody),
    throughputRequestsPerSecond: summary(throughput),
    frameworkProcessCpuMsPerRequest: { ...summary(cpuMs), note: profile.note },
    sampledTransientAllocationBytesPerRequest: summary(allocations),
    addedProtocolBytesPerRequest: summary(overheadBytes),
    invalidInputPostGcHeapBytes: invalidHeap,
  };
}

async function validRequest(profile) {
  const response = await fetch(serverUrl, {
    method: "POST",
    headers: profile.headers,
    body: profile.requestBody,
  });
  const body = await response.arrayBuffer();
  assert.equal(response.status, 200, `${profile.name}: ${new TextDecoder().decode(body)}`);
  return { response, bodyBytes: body.byteLength };
}

async function invalidRequest(profile) {
  const body = profile.requestBody.replace('"id":"bench"', '"id":42');
  const response = await fetch(serverUrl, {
    method: "POST",
    headers: { ...profile.headers, ...(profile.name.startsWith("modern") ? { "Mcp-Param-Id": "42" } : {}) },
    body,
  });
  assert.equal(response.status, 200);
  await response.arrayBuffer();
}

async function measureAddedBytes(profile) {
  const { response, bodyBytes } = await validRequest(profile);
  const responseHeaderBytes = [...response.headers].reduce(
    (sum, [name, value]) => sum + Buffer.byteLength(`${name}: ${value}\r\n`), 0,
  );
  const requestHeaderBytes = Object.entries(profile.headers).reduce(
    (sum, [name, value]) => sum + Buffer.byteLength(`${name}: ${value}\r\n`), 0,
  );
  return requestHeaderBytes + Buffer.byteLength(profile.requestBody) + responseHeaderBytes + bodyBytes -
    profile.applicationBytes;
}

function ask(type) {
  const id = ++nextMessageId;
  return new Promise((resolve, reject) => {
    const onMessage = (message) => {
      if (message?.id !== id) return;
      child.off("message", onMessage);
      if (message.error) reject(new Error(message.error));
      else resolve(message);
    };
    child.on("message", onMessage);
    child.send({ id, type }, (error) => { if (error) reject(error); });
  });
}
function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}
function summary(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { min: Math.min(...values), mean, max: Math.max(...values), p95: percentile(values, 0.95) };
}
