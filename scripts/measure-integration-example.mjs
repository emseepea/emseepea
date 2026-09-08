import assert from "node:assert/strict";
import { createConnection, createServer } from "node:net";

const root = new URL("../", import.meta.url);
const mode = process.argv[2];
assert.equal(typeof global.gc, "function", "run with node --expose-gc");
const cleanups = [];
let app;
let backendProxy;

if (mode === "database") {
  backendProxy = await createCountingProxy(new URL(process.env.DATABASE_URL));
  cleanups.push(backendProxy.close);
  const { createDatabaseSchemaExample } = await import(
    new URL("examples/database-schema-server/dist/app.js", root)
  );
  app = (await createDatabaseSchemaExample({ databaseUrl: backendProxy.url.href })).app;
} else if (mode === "mongodb") {
  backendProxy = await createCountingProxy(new URL(process.env.MONGODB_URL));
  cleanups.push(backendProxy.close);
  const { createMongoExample } = await import(
    new URL("examples/mongodb-backed-server/dist/app.js", root)
  );
  app = (await createMongoExample({ uri: backendProxy.url.href })).app;
} else if (mode === "soap") {
  const { startSoapFixture } = await import(
    new URL("examples/soap-backed-server/test-support/soap-fixture.mjs", root)
  );
  const fixture = await startSoapFixture({ after(cleanup) { cleanups.push(cleanup); } });
  backendProxy = await createCountingProxy(fixture.url);
  cleanups.push(backendProxy.close);
  const { createSoapExample } = await import(new URL("examples/soap-backed-server/dist/app.js", root));
  app = (await createSoapExample(backendProxy.url.href)).app;
} else {
  throw new Error("Expected database, mongodb, or soap");
}

let sequence = 0;
const paths = mode === "database"
  ? [
      path("list-pea-varieties", () => ({ pea_type: "snap" })),
      path("add-pea-variety", () => ({
        name: `Performance ${sequence += 1}`,
        pea_type: "snap",
        growth_habit: "bush",
        days_to_maturity: 60,
        notes: "Performance qualification.",
      })),
      path("summarize-pea-catalog", () => ({})),
    ]
  : mode === "mongodb"
    ? [
        path("list-pea-varieties", () => ({ pea_type: "snap" })),
        path("add-pea-variety", () => ({
          name: `Performance ${sequence += 1}`,
          pea_type: "snap",
          growth_habit: "bush",
          days_to_maturity: 60,
          notes: "Performance qualification.",
        })),
        path("list-pea-observations", () => ({})),
        path("record-pea-observation", () => ({
          variety_name: "Performance",
          observed_on: "2026-09-08",
          location: "Test bed",
          growth_stage: `stage-${sequence += 1}`,
          notes: "Performance qualification.",
        })),
      ]
    : [path("get-pea-variety", () => ({ name: "Sugar Ann" }))];

try {
  const results = [];
  for (const measuredPath of paths) {
    await invoke(measuredPath.request());
    const trials = [];
    for (let trial = 0; trial < 5; trial += 1) {
      global.gc?.();
      const cpuStart = process.cpuUsage();
      let maximumMcpBytes = 0;
      let maximumBackendRequestBytes = 0;
      let maximumBackendResponseBytes = 0;
      for (let index = 0; index < 100; index += 1) {
        const request = measuredPath.request();
        const backendBefore = backendProxy ? { ...backendProxy.bytes } : undefined;
        const response = await invoke(request);
        maximumMcpBytes = Math.max(
          maximumMcpBytes,
          Buffer.byteLength(JSON.stringify(request.payload)) + Buffer.byteLength(response.body),
        );
        if (backendBefore && backendProxy) {
          maximumBackendRequestBytes = Math.max(
            maximumBackendRequestBytes,
            backendProxy.bytes.request - backendBefore.request,
          );
          maximumBackendResponseBytes = Math.max(
            maximumBackendResponseBytes,
            backendProxy.bytes.response - backendBefore.response,
          );
        }
      }
      const cpu = process.cpuUsage(cpuStart);
      const heapDeltas = [];
      for (let index = 0; index < 20; index += 1) {
        global.gc?.();
        const baseline = process.memoryUsage().heapUsed;
        let peak = baseline;
        const sampler = setInterval(() => {
          peak = Math.max(peak, process.memoryUsage().heapUsed);
        }, 1);
        await invoke(measuredPath.request());
        clearInterval(sampler);
        peak = Math.max(peak, process.memoryUsage().heapUsed);
        heapDeltas.push(Math.max(0, peak - baseline));
      }
      trials.push({
        meanCpuMs: (cpu.user + cpu.system) / 100_000,
        peakHeapKiB: Math.max(...heapDeltas) / 1_024,
        maximumMcpBytes,
        maximumBackendRequestBytes,
        maximumBackendResponseBytes,
      });
    }
    const median = (key) => [...trials].sort((left, right) => left[key] - right[key])[2][key];
    const result = {
      path: measuredPath.name,
      medianMeanCpuMs: median("meanCpuMs"),
      medianPeakHeapKiB: median("peakHeapKiB"),
      maximumMcpBytes: Math.max(...trials.map(({ maximumMcpBytes }) => maximumMcpBytes)),
      ...(backendProxy ? {
        maximumBackendRequestBytes: Math.max(...trials.map(({ maximumBackendRequestBytes }) => maximumBackendRequestBytes)),
        maximumBackendResponseBytes: Math.max(...trials.map(({ maximumBackendResponseBytes }) => maximumBackendResponseBytes)),
      } : {}),
    };
    assert.ok(result.medianMeanCpuMs <= 5, `${result.path} exceeded 5 ms application CPU per call`);
    assert.ok(result.medianPeakHeapKiB <= 1_024, `${result.path} exceeded 1 MiB transient heap per call`);
    assert.ok(
      result.maximumMcpBytes <= (mode === "soap" ? 128 : 32) * 1_024,
      `${result.path} exceeded its serialized MCP traffic budget`,
    );
    if (backendProxy) {
      assert.ok(
        result.maximumBackendRequestBytes + result.maximumBackendResponseBytes <= 32 * 1_024,
        `${result.path} exceeded its measured backend traffic budget`,
      );
    }
    results.push(result);
  }
  console.log(JSON.stringify({
    mode,
    callsPerCpuTrial: 100,
    callsPerMemoryTrial: 20,
    trials: 5,
    backendTrafficBudgetBytes: mode === "soap" ? 128 * 1_024 : 32 * 1_024,
    results,
  }));
} finally {
  await app.close();
  for (const cleanup of cleanups) await cleanup();
}

async function createCountingProxy(target) {
  const sockets = new Set();
  const bytes = { request: 0, response: 0 };
  const server = createServer((client) => {
    const upstream = createConnection({ host: target.hostname, port: Number(target.port) });
    sockets.add(client).add(upstream);
    client.on("data", (chunk) => { bytes.request += chunk.byteLength; });
    upstream.on("data", (chunk) => { bytes.response += chunk.byteLength; });
    client.on("error", () => upstream.destroy());
    upstream.on("error", () => client.destroy());
    client.on("close", () => sockets.delete(client));
    upstream.on("close", () => sockets.delete(upstream));
    client.pipe(upstream).pipe(client);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Backend proxy address unavailable");
  const url = new URL(target);
  url.hostname = "127.0.0.1";
  url.port = String(address.port);
  return {
    bytes,
    url,
    close: () => new Promise((resolve, reject) => {
      for (const socket of sockets) socket.destroy();
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

function path(name, argumentsForCall) {
  return { name, request: () => call(name, argumentsForCall()) };
}

function call(name, arguments_) {
  return {
    method: "POST",
    url: "/mcp",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": "tools/call",
      "mcp-name": name,
    },
    payload: {
      jsonrpc: "2.0",
      id: "performance",
      method: "tools/call",
      params: {
        name,
        arguments: arguments_,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "performance", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    },
  };
}

async function invoke(request) {
  const response = await app.inject(request);
  assert.equal(response.statusCode, 200);
  assert.notEqual(response.json().result?.isError, true);
  return response;
}
