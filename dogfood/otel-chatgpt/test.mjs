import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { createDemoAuth } from "../events/auth.mjs";
import { startTelemetryProbe } from "./probe.mjs";
import { startOwnedProbe } from "./server.mjs";

const parent = "00-1234567890abcdef1234567890abcdef-1234567890abcdef-01";
const otherParent = "00-abcdef1234567890abcdef1234567890-abcdef1234567890-01";
const canary = "private-local-canary-never-retain";

async function fixture(t, extra = {}) {
  const runId = randomUUID();
  const endpoint = new URL("https://probe.example/mcp");
  const key = Buffer.from("synthetic-local-control-signing-key");
  const auth = createDemoAuth({ issuer: "https://auth.example", resource: endpoint.href,
    pin: "synthetic-local-test-pin", signingKey: key });
  const payload = Buffer.from(JSON.stringify({ sub: "synthetic-test-account", clientId: "local-control",
    aud: endpoint.href, scope: "feedback", exp: Date.now() / 1000 + 300 })).toString("base64url");
  const token = `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
  const probe = await startTelemetryProbe({ runId, endpoint, ...extra,
    authentication: { verifier: { verifyAccessToken(value) {
      try { return auth.verifyAccessToken(value); }
      catch { throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid synthetic probe token"); }
    } },
      metadata: { resourceServerUrl: endpoint, oauthMetadata: auth.metadata } } });
  t.after(() => probe.close());
  let id = 0;
  return { probe, token, runId, async call({ mode = "immediate", headers = {}, meta = {}, authToken = token } = {}) {
    const response = await fetch(probe.url, {
      method: "POST", headers: {
        "Content-Type": "application/json", Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${authToken}`, "MCP-Protocol-Version": "2026-07-28",
        "Mcp-Method": "tools/call", "Mcp-Name": "observe-telemetry", ...headers,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: {
        name: "observe-telemetry", arguments: { runId, mode }, _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "local-probe-control", version: "1" },
          "io.modelcontextprotocol/clientCapabilities": {}, ...meta,
        },
      } }),
    });
    const body = await response.json();
    await delay(0); // Allow the response's finish observation to settle.
    return { response, body };
  } };
}

test("real immediate and awaited requests produce bounded result-frame metrics, never native proof", async (t) => {
  const f = await fixture(t);
  for (const mode of ["immediate", "awaited"]) {
    const { response, body } = await f.call({ mode });
    assert.equal(response.status, 200);
    assert.deepEqual(body.result.structuredContent, { observed: true, mode });
  }
  const evidence = await f.probe.evidence();
  assert.equal(evidence.nativeStatus, "UNKNOWN");
  assert.equal(evidence.overflow, false);
  assert.deepEqual(evidence.records.map((row) => row.mode), ["immediate", "awaited"]);
  for (const row of evidence.records) {
    assert.equal(row.provenance, "controlled-local");
    assert.equal(row.outcome, "success");
    assert.equal(row.wireMode, "json");
    assert.deepEqual(row.protocols, { httpHeader: "2026-07-28", mcpMeta: "2026-07-28" });
    const b = row.boundaries;
    const values = [b.httpReceivedAtMs, b.operationReceivedAtMs, b.handlerStartedAtMs,
      b.handlerReturnedAtMs, b.resultEmittedAtMs, b.httpFinishedAtMs];
    assert.ok(values.every(Number.isFinite));
    assert.deepEqual(values, [...values].sort((a, b) => a - b));
    assert.match(row.authenticatedClientSha256, /^[a-f0-9]{64}$/);
    assert.match(row.fixtureRequestSha256, /^[a-f0-9]{64}$/);
    assert.match(row.responseSha256, /^[a-f0-9]{64}$/);
  }
  const metrics = evidence.metrics.at(-1).scopeMetrics.flatMap((scope) => scope.metrics);
  const counter = metrics.find((metric) => metric.descriptor.name === "emseepea.probe.operations");
  const duration = metrics.find((metric) => metric.descriptor.name === "emseepea.probe.operation.duration");
  assert.equal(counter.descriptor.unit, "{operation}");
  assert.equal(duration.descriptor.unit, "s");
  assert.equal(counter.dataPoints.reduce((total, point) => total + point.value, 0), 2);
  for (const point of duration.dataPoints) {
    assert.deepEqual(Object.keys(point.attributes), ["mode"]);
    assert.equal(point.value.count, 1);
    const row = evidence.records.find((record) => record.mode === point.attributes.mode);
    const expected = (row.boundaries.resultEmittedAtMs - row.boundaries.operationReceivedAtMs) / 1_000;
    assert.ok(Math.abs(point.value.sum - expected) < 0.000001);
  }
  assert.equal(metrics.some((metric) => metric.descriptor.name.startsWith("mcp.server.")), false);
});

test("HTTP and MCP carriers are observed independently and raw values are not exported", async (t) => {
  const f = await fixture(t);
  const { response } = await f.call({
    headers: { traceparent: parent, tracestate: `private=${canary}`, "x-private": canary },
    meta: { traceparent: otherParent, tracestate: `private=${canary}`, baggage: canary, arbitrary: canary },
  });
  assert.equal(response.status, 200);
  const evidence = await f.probe.evidence();
  assert.deepEqual(evidence.records[0].carriers, {
    http: { traceparent: "valid", tracestate: "accepted" },
    meta: { traceparent: "valid", tracestate: "accepted" }, sameValidParent: false,
  });
  const text = JSON.stringify(evidence);
  for (const secret of [parent, otherParent, canary, f.token, "synthetic-local-control-signing-key", "local-control"]) {
    assert.equal(text.includes(secret), false, secret);
  }
});

test("missing, invalid and oversized carriers stay distinct from support verdicts", async (t) => {
  const f = await fixture(t);
  await f.call();
  await f.call({ headers: { traceparent: "invalid" }, meta: { traceparent: parent } });
  await f.call({ headers: { traceparent: "x".repeat(513) }, meta: { traceparent: null } });
  await f.call({ meta: { tracestate: "vendor=synthetic" } });
  const evidence = await f.probe.evidence();
  assert.deepEqual(evidence.records.map((row) => [row.carriers.http.traceparent, row.carriers.meta.traceparent]),
    [["absent", "absent"], ["invalid", "valid"], ["oversize", "invalid-type"], ["absent", "absent"]]);
  assert.equal(evidence.records[3].carriers.meta.tracestate, "unused-without-valid-parent");
  assert.equal(evidence.nativeStatus, "UNKNOWN");
});

test("a user agent and failed authentication never create authenticated native evidence", async (t) => {
  const f = await fixture(t, { provenance: "native-pending" });
  const rejected = await f.call({ authToken: "invalid", headers: { "user-agent": "ChatGPT" } });
  assert.equal(rejected.response.status, 401);
  assert.equal((await f.probe.evidence()).records.length, 0);
  assert.equal((await f.call({ headers: { "user-agent": "ChatGPT" } })).response.status, 200);
  const evidence = await f.probe.evidence();
  assert.equal(evidence.nativeStatus, "UNKNOWN");
  assert.equal(evidence.records[0].provenance, "native-pending");
});

test("the owned server exposes no Events/admin endpoint and saves private UNKNOWN evidence after cleanup", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-otel-probe-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const evidenceFile = join(directory, "evidence.json");
  const server = await startOwnedProbe({ publicMcpUrl: new URL("https://probe.example/mcp"),
    publicAuthUrl: new URL("https://auth.example/"), pin: "synthetic-control-pin",
    evidenceFile, mcpPort: 0, authPort: 0 });
  t.after(() => server.stop());
  const origin = new URL(server.mcpUrl).origin;
  for (const path of ["/demo/feedback/fixture/replies", "/demo/evidence", "/events"]) {
    assert.equal((await fetch(origin + path)).status, 404);
  }
  await server.stop();
  const evidence = JSON.parse(await readFile(evidenceFile, "utf8"));
  assert.equal(evidence.nativeStatus, "UNKNOWN");
  assert.deepEqual(evidence.records, []);
  assert.equal((await stat(evidenceFile)).mode & 0o777, 0o600);
  await assert.rejects(fetch(server.mcpUrl));
  await assert.rejects(fetch(`http://127.0.0.1:${server.authPort}/.well-known/oauth-authorization-server`));
});
