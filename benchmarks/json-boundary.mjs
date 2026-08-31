import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const concurrency = 16;
const durationMs = 1_000;
const runs = 3;
const cpuSamples = 400;
const allocationSamples = 40;
const requestBody = JSON.stringify({
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
const headers = {
  Accept: "application/json, text/event-stream",
  "Content-Type": "application/json",
  "MCP-Protocol-Version": "2026-07-28",
  "Mcp-Method": "tools/call",
  "Mcp-Name": "synthetic-read",
  "Mcp-Param-Id": "bench",
};
let nextMessageId = 0;

const telemetry = process.argv.includes("--telemetry");
const child = fork(fileURLToPath(new URL("./json-boundary-server.mjs", import.meta.url)), telemetry ? ["--telemetry"] : [], {
  execArgv: ["--expose-gc"],
  stdio: ["ignore", "inherit", "inherit", "ipc"],
});
const serverUrl = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.on("message", (message) => {
    if (message?.type === "ready") resolve(new URL(message.url));
  });
});

try {
  for (let index = 0; index < 100; index += 1) await validRequest();

  const throughput = [];
  for (let run = 0; run < runs; run += 1) {
    const startedAt = performance.now();
    const deadline = startedAt + durationMs;
    const completed = await Promise.all(Array.from({ length: concurrency }, async () => {
      let count = 0;
      while (performance.now() < deadline) {
        await validRequest();
        count += 1;
      }
      return count;
    }));
    const elapsedSeconds = (performance.now() - startedAt) / 1_000;
    throughput.push(completed.reduce((sum, value) => sum + value, 0) / elapsedSeconds);
  }

  const cpuMs = [];
  const allocations = [];
  for (let index = 0; index < cpuSamples; index += 1) {
    await ask("cpu-start");
    await validRequest();
    cpuMs.push((await ask("cpu-stop")).value);
  }
  for (let index = 0; index < allocationSamples; index += 1) {
    await ask("allocation-start");
    await validRequest();
    allocations.push((await ask("allocation-stop")).value);
  }

  const overheadBytes = [];
  for (let index = 0; index < 10; index += 1) overheadBytes.push(await measureAddedBytes());
  const invalidHeap = [];
  for (let batch = 0; batch < 3; batch += 1) {
    for (let index = 0; index < 100; index += 1) await invalidRequest();
    invalidHeap.push((await ask("heap")).value);
  }

  const result = {
    profile: {
      telemetry: telemetry ? "enabled, no provider (API overhead only)" : "disabled",
      node: process.version,
      profileName: process.env.EMSEEPEA_BENCHMARK_PROFILE ?? "local",
      platform: `${process.platform}-${process.arch}`,
      cpu: cpus()[0]?.model ?? "unknown",
      logicalCpus: cpus().length,
      concurrency,
      durationMs,
      runs,
      cpuSamples,
      allocationSamples,
      requestBytes: Buffer.byteLength(requestBody),
    },
    throughputRequestsPerSecond: summary(throughput),
    frameworkProcessCpuMsPerRequest: { ...summary(cpuMs), note: "server process only; mapped synthetic adapter" },
    sampledTransientAllocationBytesPerRequest: summary(allocations),
    addedProtocolBytesPerRequest: summary(overheadBytes),
    invalidInputPostGcHeapBytes: invalidHeap,
  };
  console.log(JSON.stringify(result, null, 2));

  assert.ok(Math.min(...throughput) >= 100, "throughput fell below 100 requests/second");
  assert.ok(percentile(cpuMs, 0.95) <= 5, "p95 process CPU exceeded 5 ms/request");
  assert.ok(percentile(allocations, 0.95) <= 256 * 1024, "p95 transient allocation exceeded 256 KiB/request");
  assert.ok(summary(overheadBytes).mean <= 2 * 1024, "average added protocol bytes exceeded 2 KiB/request");
  assert.ok(Math.max(...invalidHeap) - Math.min(...invalidHeap) <= 1024 * 1024,
    "invalid-input retained heap varied by more than 1 MiB across equal batches");
} finally {
  await ask("shutdown");
}

async function validRequest() {
  const response = await fetch(serverUrl, { method: "POST", headers, body: requestBody });
  assert.equal(response.status, 200);
  return { response, bodyBytes: (await response.arrayBuffer()).byteLength };
}

async function invalidRequest() {
  const body = requestBody.replace('"id":"bench"', '"id":42');
  const response = await fetch(serverUrl, {
    method: "POST",
    headers: { ...headers, "Mcp-Param-Id": "42" },
    body,
  });
  assert.equal(response.status, 200);
  await response.arrayBuffer();
}

async function measureAddedBytes() {
  const { response, bodyBytes } = await validRequest();
  const responseHeaderBytes = [...response.headers].reduce(
    (sum, [name, value]) => sum + Buffer.byteLength(`${name}: ${value}\r\n`), 0,
  );
  const requestHeaderBytes = Object.entries(headers).reduce(
    (sum, [name, value]) => sum + Buffer.byteLength(`${name}: ${value}\r\n`), 0,
  );
  const applicationBytes = Buffer.byteLength(JSON.stringify({ id: "bench", value: "synthetic" })) +
    Buffer.byteLength("synthetic") + Buffer.byteLength(JSON.stringify({ id: "bench" }));
  return requestHeaderBytes + Buffer.byteLength(requestBody) + responseHeaderBytes + bodyBytes - applicationBytes;
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
