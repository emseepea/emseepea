import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Run the copied public recipe against dependencies installed in the given project.
const project = path.resolve(process.argv[2] ?? fileURLToPath(new URL("../", import.meta.url)));
const stalled = process.argv[3] === "stalled";
const guide = await readFile(new URL("../website/src/content/docs/tracing.md", import.meta.url), "utf8");
const directory = await mkdtemp(path.join(project, ".telemetry-guide-"));
const traceBatches = [];
let latestMetrics;
let receiverFailed = false;
const remoteTrace = "1234567890abcdef1234567890abcdef";
const remoteSpan = "1234567890abcdef";
const privateValue = "telemetry-guide-private-canary";
const receiver = createServer(async (request, response) => {
  try {
    assert.ok(["/v1/traces", "/v1/metrics"].includes(request.url));
    let body = "";
    for await (const chunk of request) { body += chunk; assert.ok(body.length < 1_000_000); }
    assert.ok(!body.includes(privateValue), "private request data reached the collector");
    const parsed = JSON.parse(body);
    if (request.url === "/v1/traces") {
      assert.ok(traceBatches.length < 16);
      traceBatches.push(parsed);
    } else {
      // Metrics are cumulative; traces are independent batches.
      latestMetrics = parsed;
    }
    if (!stalled) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    }
  } catch {
    receiverFailed = true;
    response.writeHead(400); response.end();
  }
});
let child;
try {
  for (const name of ["telemetry.mjs", "tracing-server.mjs"]) {
    const code = guide.match(new RegExp('```js title="' + name.replaceAll(".", "\\.") + '"\\n([\\s\\S]*?)```'))?.[1];
    assert.ok(code, `missing ${name} in the public guide`);
    await writeFile(path.join(directory, name), code);
  }
  await new Promise((resolve) => receiver.listen(0, "127.0.0.1", resolve));
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) if (key.startsWith("OTEL_")) delete environment[key];
  delete environment.NODE_TEST_CONTEXT;
  Object.assign(environment, {
    PORT: "0",
    OTEL_TRACES_EXPORTER: "otlp", OTEL_METRICS_EXPORTER: "otlp",
    OTEL_EXPORTER_OTLP_PROTOCOL: "http/json",
    OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${receiver.address().port}`,
    OTEL_EXPORTER_OTLP_TIMEOUT: "1000", OTEL_BSP_EXPORT_TIMEOUT: "1000",
    OTEL_METRIC_EXPORT_TIMEOUT: "1000", OTEL_METRIC_EXPORT_INTERVAL: "60000",
  });
  child = spawn(process.execPath, ["--import", "./telemetry.mjs", "tracing-server.mjs"], {
    cwd: directory, env: environment, stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = once(child, "exit");
  let output = "";
  let shutdownFailureReported = false;
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("guide server did not start")), 15_000);
    child.once("exit", () => { clearTimeout(timer); reject(new Error("guide server exited before readiness")); });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      assert.ok(output.length < 8192);
      const match = output.match(/MCP endpoint: (http:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    // Keep stderr drained without retaining SDK or runtime configuration.
    child.stderr.on("data", (chunk) => {
      if (chunk.toString().includes("Server or telemetry shutdown failed.")) shutdownFailureReported = true;
    });
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Accept: "application/json, text/event-stream", "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call", "Mcp-Name": "read-status",
      traceparent: `00-${remoteTrace}-${remoteSpan}-01`, baggage: `private=${privateValue}`,
      Authorization: `Bearer ${privateValue}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: privateValue, method: "tools/call", params: {
      name: "read-status", arguments: { private: privateValue }, _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { name: "guide-check", version: "1" },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    } }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.structuredContent.status, "ready");
  const stoppedAt = performance.now();
  child.kill("SIGTERM");
  const deadline = setTimeout(() => child.kill("SIGKILL"), 10_000);
  const [code, signal] = await exited;
  clearTimeout(deadline);
  assert.equal(code, stalled ? 1 : 0); assert.equal(signal, null);
  assert.equal(shutdownFailureReported, stalled);
  assert.ok(performance.now() - stoppedAt < 10_000, "configured recipe did not finish shutdown");
  assert.equal(receiverFailed, false, "collector rejected an export");
  for (const entry of [...traceBatches.flatMap((batch) => batch.resourceSpans), ...(latestMetrics?.resourceMetrics ?? [])]) {
      const attrs = entry.resource.attributes;
      assert.deepEqual(attrs.map((a) => a.key).sort(), ["service.name", "telemetry.sdk.language", "telemetry.sdk.name", "telemetry.sdk.version"]);
      assert.equal(attrs.find((a) => a.key === "service.name").value.stringValue, "status-service");
  }
  const spans = traceBatches.flatMap((batch) => batch.resourceSpans.flatMap((r) => r.scopeSpans.flatMap((s) => s.spans)));
  const parent = spans?.find((s) => s.name === "mcp.request");
  const backend = spans?.find((s) => s.name === "backend.read");
  assert.equal(parent?.traceId, remoteTrace); assert.equal(parent.parentSpanId, remoteSpan);
  assert.equal(backend?.traceId, remoteTrace); assert.equal(backend.parentSpanId, parent.spanId);
  const instruments = latestMetrics?.resourceMetrics.flatMap((r) => r.scopeMetrics.flatMap((s) => s.metrics));
  const count = instruments?.find((m) => m.name === "emseepea.http.requests");
  const duration = instruments?.find((m) => m.name === "emseepea.http.response.duration");
  assert.equal(count?.unit, "{request}"); assert.equal(duration?.unit, "s");
  assert.equal(count.sum.aggregationTemporality, 2);
  assert.equal(count.sum.isMonotonic, true);
  assert.equal(duration.histogram.aggregationTemporality, 2);
  const selected = (points) => points.filter((p) => p.attributes.some((a) => a.key === "mcp.capability.name" && a.value.stringValue === "read-status"));
  const counts = selected(count.sum.dataPoints); const points = selected(duration.histogram.dataPoints);
  assert.equal(counts.length, 1); assert.equal(counts[0].asDouble ?? counts[0].asInt, 1);
  assert.equal(points.length, 1);
  const point = points[0];
  assert.deepEqual(point.explicitBounds, [.005, .01, .025, .05, .075, .1, .25, .5, .75, 1, 2.5, 5, 7.5, 10]);
  assert.equal(Number(point.count), 1);
  assert.equal(point.bucketCounts.length, point.explicitBounds.length + 1);
  assert.ok(point.bucketCounts.every((n) => Number.isFinite(Number(n)) && Number(n) >= 0));
  assert.equal(point.bucketCounts.reduce((a, b) => a + Number(b), 0), 1);
  assert.ok(Number.isFinite(point.sum) && point.sum >= 0 && point.sum < 10);
  const allowed = new Set(["mcp.method", "mcp.capability.name", "http.request.method", "http.response.status_code", "emseepea.protocol.outcome", "emseepea.transport.outcome"]);
  for (const p of [...counts, ...points]) assert.ok(p.attributes.every((a) => allowed.has(a.key)));
  if (!stalled) console.log("Copied Node SDK guide: real OTLP traces, parentage, metrics, seconds/buckets, resource policy and shutdown PASS");
  if (stalled) console.log("Stalled collector: tool response succeeded; timed-out shutdown reported failure with exit 1 as expected (wire arrival is not export acknowledgement)");
} finally {
  if (child && child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await once(child, "exit").catch(() => {}); }
  receiver.closeAllConnections();
  await new Promise((resolve) => receiver.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
