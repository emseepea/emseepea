import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { cpus } from "node:os";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import {
  measureProductionBoundaryClass,
  productionBoundaryCohortCount,
  productionBoundaryTraceName,
} from "./production-boundary-classification.mjs";

import { measureProductionBoundaryPopulations, productionBoundaryRequestClasses } from "./production-boundary-populations.mjs";

import { readBenchmarkResponse } from "./benchmark-http.mjs";
import { trackBenchmarkChild } from "./benchmark-child.mjs";

const classes = productionBoundaryRequestClasses;
const dailyRequests = 8_640_000;
const reportDirectory = process.env.EMSEEPEA_BENCHMARK_REPORT_DIR;
const traceDirectory = process.env.EMSEEPEA_BENCHMARK_TRACE_DIR;
const checkpointPrefix = traceDirectory ? "diagnostic-production" : "production";
const stopped = new AbortController();
const children = new Set();
const cancel = () => {
  stopped.abort();
  for (const child of children) child.kill("SIGTERM");
};
process.once("SIGINT", cancel);
process.once("SIGTERM", cancel);
if (reportDirectory) await mkdir(reportDirectory, { recursive: true });
if (traceDirectory) await mkdir(traceDirectory, { recursive: true });

const report = await measureProductionBoundaryPopulations(async (population) => {
  const results = [];
  for (const requestClass of classes) {
    const result = await measureProductionBoundaryClass(requestClass, async (kind, cohort) => {
      const measured = await measure(kind, cohort, population);
      if (reportDirectory) await writeFile(resolve(reportDirectory,
        `${checkpointPrefix}-population-${population}-${kind}-cohort-${cohort}.json`), `${JSON.stringify(measured, null, 2)}\n`);
      return measured;
    });
    results.push({
      ...result,
      projectedDailyCpuMsDelta: result.frameworkProcessCpuMsPerRequest.p95 * dailyRequests,
      projectedDailyTransientAllocationBytesDelta:
        result.sampledTransientAllocationBytesPerRequest.p95 * dailyRequests,
      projectedDailyWireBytesDelta: result.frameworkAddedWireBytesPerRequest.mean * dailyRequests,
    });
  }
  const populationReport = {
    diagnosticOnly: Boolean(traceDirectory),
    profile: {
      name: process.env.EMSEEPEA_BENCHMARK_PROFILE ?? "local",
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      cpu: cpus()[0]?.model ?? "unknown",
      logicalCpus: cpus().length,
      concurrency: 16,
      durationMs: 1_000,
      cohortCount: productionBoundaryCohortCount,
      throughputRunsPerCohort: 3,
      cpuSamplesPerCohort: 200,
      allocationSamplesPerCohort: 80,
      wireSamplesPerCohort: 10,
    },
    projection: {
      source: "no data - worst-case assumption",
      incomingRequestsPerDay: dailyRequests,
    },
    results,
    status: results.every(({ status }) => status === "PASS") ? "PASS" : "FLAG",
  };
  if (reportDirectory) await writeFile(resolve(reportDirectory,
    `${checkpointPrefix}-population-${population}.json`), `${JSON.stringify(populationReport, null, 2)}\n`);
  return populationReport;
}, { signal: stopped.signal });
console.log(JSON.stringify(report, null, 2));
if (reportDirectory) {
  await writeFile(resolve(reportDirectory, traceDirectory
    ? "production-diagnostic.json" : "production-boundary.json"), `${JSON.stringify(report, null, 2)}\n`);
}
assert.equal(report.status, "PASS", "production JSON boundary populations did not all pass");
if (!traceDirectory) assert.equal(report.qualifies, true, "production boundary qualification is incomplete");

async function measure(requestClass, cohort, population) {
  stopped.signal.throwIfAborted();
  const child = fork(fileURLToPath(new URL("./json-boundary-server.mjs", import.meta.url)), [
    `--production-class=${requestClass}`,
  ], { execArgv: ["--expose-gc", ...(traceDirectory ? [
    "--cpu-prof",
    `--cpu-prof-dir=${resolve(traceDirectory)}`,
    `--cpu-prof-name=${productionBoundaryTraceName(requestClass, cohort, population)}`,
    "--trace-gc-nvp",
  ] : [])], stdio: ["ignore", "inherit", "inherit", "ipc"] });
  const lifecycle = trackBenchmarkChild(child);
  const ask = lifecycle.ask;
  const throughput = [], cpuSamples = [], allocations = [], wireBytes = [];
  let currentPhase = "starting";
  let measurementError;
  children.add(child);
  child.once("exit", () => children.delete(child));
  const phase = (name) => {
    currentPhase = name;
    if (traceDirectory) console.error(JSON.stringify({
      requestClass, cohort, population, pid: child.pid, phase: name, timestampMs: Date.now(),
    }));
  };
  const expectedStatus = { accepted: 200, "rate-limited": 429, "capacity-exhausted": 503, malformed: 400 }[requestClass];
  try {
    const ready = await lifecycle.ready();
    const serverUrl = new URL(ready.url);
    serverUrl.hostname = "127.0.0.1";
    const request = () => { stopped.signal.throwIfAborted(); return send(serverUrl, requestClass); };
    phase("warmup");
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

    phase("throughput");
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

    phase("cpu");
    for (let index = 0; index < 200; index += 1) {
      const startedAtMs = Date.now();
      await ask("cpu-start");
      assert.equal((await request()).status, expectedStatus);
      const cpuMsPerRequest = await ask("cpu-stop");
      cpuSamples.push({ index, startedAtMs, endedAtMs: Date.now(), cpuMs: cpuMsPerRequest });
    }
    phase("allocations");
    for (let index = 0; index < 80; index += 1) {
      await ask("allocation-start");
      assert.equal((await request()).status, expectedStatus);
      allocations.push(await ask("allocation-stop"));
    }
    phase("wire");
    for (let index = 0; index < 10; index += 1) wireBytes.push((await request()).wireBytes);

    return {
      cohort,
      requestClass,
      expectedStatus,
      throughputSamples: throughput,
      cpuSamples,
      allocationSamples: allocations,
      wireSamples: wireBytes,
    };
  } catch (error) {
    measurementError = error;
    throw error;
  } finally {
    let shutdownError;
    try {
      const clock = await lifecycle.shutdown();
      if (traceDirectory) {
        assert.equal(clock?.diagnosticOnly, true, "missing diagnostic clock observations");
        await writeFile(resolve(traceDirectory,
          `production-${requestClass}-population-${population}-cohort-${cohort}.clock.json`), `${JSON.stringify(clock, null, 2)}\n`);
      }
    } catch (error) { shutdownError = error; }
    if (reportDirectory && (measurementError || shutdownError)) {
      try { await writeFile(resolve(reportDirectory,
        `${checkpointPrefix}-population-${population}-${requestClass}-cohort-${cohort}-incomplete.json`), `${JSON.stringify({
          complete: false, population, requestClass, cohort, phase: currentPhase,
          error: String((measurementError ?? shutdownError).message).slice(0, 256),
          throughputSamples: throughput, cpuSamples, allocationSamples: allocations, wireSamples: wireBytes,
        }, null, 2)}\n`); } catch (error) {
        if (!measurementError) throw error;
        measurementError.message += "; incomplete checkpoint could not be written";
      }
    }
    if (!measurementError && shutdownError) throw shutdownError;
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
    const outgoing = httpRequest(url, { method: "POST", headers, signal: stopped.signal }, (incoming) => {
      readBenchmarkResponse(incoming).then((responseBody) => {
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
      }).catch(reject);
    });
    outgoing.setTimeout(5_000, () => outgoing.destroy(new Error("Benchmark HTTP request timed out")));
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}
