import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { request as httpRequest } from "node:http";
import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const classes = ["accepted", "rate-limited", "capacity-exhausted", "malformed"];
const dailyRequests = 8_640_000;
const results = [];

for (const requestClass of classes) results.push(await measure(requestClass));

const report = {
  profile: {
    name: process.env.EMSEEPEA_BENCHMARK_PROFILE ?? "local",
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    cpu: cpus()[0]?.model ?? "unknown",
    logicalCpus: cpus().length,
    concurrency: 16,
    durationMs: 1_000,
    runs: 3,
  },
  projection: {
    source: "no data - worst-case assumption",
    incomingRequestsPerDay: dailyRequests,
  },
  results,
  status: results.every(({ status }) => status === "PASS") ? "PASS" : "FLAG",
};
console.log(JSON.stringify(report, null, 2));
assert.equal(report.status, "PASS", "production JSON boundary exceeded its budget");

async function measure(requestClass) {
  const child = fork(fileURLToPath(new URL("./json-boundary-server.mjs", import.meta.url)), [
    `--production-class=${requestClass}`,
  ], { execArgv: ["--expose-gc"], stdio: ["ignore", "inherit", "inherit", "ipc"] });
  let nextMessageId = 0;
  const ask = (type) => {
    const id = ++nextMessageId;
    return new Promise((resolve, reject) => {
      const onMessage = (message) => {
        if (message?.id !== id) return;
        child.off("message", onMessage);
        if (message.error) reject(new Error(message.error));
        else resolve(message.value);
      };
      child.on("message", onMessage);
      child.send({ id, type }, (error) => { if (error) reject(error); });
    });
  };
  const serverUrl = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.on("message", (message) => {
      if (message?.type === "ready") resolve(new URL(message.url));
    });
  });
  serverUrl.hostname = "127.0.0.1";
  const expectedStatus = {
    accepted: 200,
    "rate-limited": 429,
    "capacity-exhausted": 503,
    malformed: 400,
  }[requestClass];
  const request = () => send(serverUrl, requestClass);

  try {
    if (requestClass === "rate-limited") {
      const seeded = await send(serverUrl, "accepted");
      assert.equal(seeded.status, 200, seeded.body);
    }
    if (requestClass === "capacity-exhausted") {
      const seeded = await send(serverUrl, "accepted");
      assert.equal(seeded.status, 200, seeded.body);
    }
    for (let index = 0; index < 50; index += 1) {
      const warmed = await request();
      assert.equal(warmed.status, expectedStatus, warmed.body);
    }

    const throughput = [];
    for (let run = 0; run < 3; run += 1) {
      const startedAt = performance.now();
      const deadline = startedAt + 1_000;
      const completed = await Promise.all(Array.from({ length: 16 }, async () => {
        let count = 0;
        while (performance.now() < deadline) {
          assert.equal((await request()).status, expectedStatus);
          count += 1;
        }
        return count;
      }));
      throughput.push(completed.reduce((sum, value) => sum + value, 0) / ((performance.now() - startedAt) / 1_000));
    }

    const cpuMs = [];
    for (let index = 0; index < 200; index += 1) {
      await ask("cpu-start");
      assert.equal((await request()).status, expectedStatus);
      cpuMs.push(await ask("cpu-stop"));
    }
    const allocations = [];
    for (let index = 0; index < 80; index += 1) {
      await ask("allocation-start");
      assert.equal((await request()).status, expectedStatus);
      allocations.push(await ask("allocation-stop"));
    }
    const wireBytes = [];
    for (let index = 0; index < 10; index += 1) wireBytes.push((await request()).wireBytes);

    const throughputSummary = summary(throughput);
    const cpuSummary = summary(cpuMs);
    const allocationSummary = summary(allocations);
    const wireSummary = summary(wireBytes);
    const status = throughputSummary.min >= 100 && cpuSummary.p95 <= 5 &&
      allocationSummary.p95 <= 256 * 1024 && wireSummary.mean <= 2 * 1024 ? "PASS" : "FLAG";
    return {
      requestClass,
      expectedStatus,
      throughputRequestsPerSecond: throughputSummary,
      frameworkProcessCpuMsPerRequest: cpuSummary,
      sampledTransientAllocationBytesPerRequest: allocationSummary,
      frameworkAddedWireBytesPerRequest: wireSummary,
      projectedDailyCpuMsDelta: cpuSummary.p95 * dailyRequests,
      projectedDailyTransientAllocationBytesDelta: allocationSummary.p95 * dailyRequests,
      projectedDailyWireBytesDelta: wireSummary.mean * dailyRequests,
      status,
    };
  } finally {
    await ask("shutdown");
  }
}

async function send(url, requestClass) {
  const malformed = requestClass === "malformed";
  const body = malformed ? "{" : JSON.stringify({
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
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    host: "mcp.example.com",
    origin: "https://mcp.example.com",
    "mcp-method": "tools/call",
    "mcp-name": "synthetic-read",
    "mcp-param-id": "bench",
    "mcp-protocol-version": "2026-07-28",
    "x-forwarded-for": requestClass === "capacity-exhausted" ? "203.0.113.11" : "203.0.113.10",
    "x-forwarded-proto": "https",
  };
  headers["content-length"] = String(Buffer.byteLength(body));
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(url, { method: "POST", headers }, (incoming) => {
      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(chunk));
      incoming.on("end", () => {
        const responseBody = Buffer.concat(chunks);
        const headerBytes = Object.entries(headers).reduce(
          (sum, [name, value]) => sum + Buffer.byteLength(`${name}: ${value}\r\n`), 0,
        ) + incoming.rawHeaders.reduce((sum, value) => sum + Buffer.byteLength(value), 0);
        const applicationBytes = requestClass === "malformed" ? 0 :
          Buffer.byteLength(JSON.stringify({ id: "bench" })) +
          (requestClass === "accepted"
            ? Buffer.byteLength(JSON.stringify({ id: "bench", value: "synthetic" })) + Buffer.byteLength("synthetic")
            : 0);
        resolve({
          status: incoming.statusCode,
          body: responseBody.toString(),
          wireBytes: Buffer.byteLength(body) + responseBody.byteLength + headerBytes - applicationBytes,
        });
      });
    });
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}

function summary(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    min: sorted[0],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    max: sorted.at(-1),
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
  };
}
