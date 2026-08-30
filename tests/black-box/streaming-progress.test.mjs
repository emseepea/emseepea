import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import {
  createEmseepea,
  defineStreamingTool,
  defineTool,
  serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";

const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "streaming-progress-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("streaming configuration is bounded and public streaming permits a trusted proxy", async () => {
  const tool = streamingTool(() => {});
  assert.throws(
    () => createEmseepea({ name: "bad-count", version: "0.0.0", tools: [tool], maxProgressEvents: 0 }),
    /maxProgressEvents must be a positive safe integer/,
  );
  assert.throws(
    () => createEmseepea({ name: "bad-size", version: "0.0.0", tools: [tool], maxProgressEventBytes: 0 }),
    /maxProgressEventBytes must be a positive safe integer/,
  );
  const app = createEmseepea({
    name: "production-streaming",
    version: "0.0.0",
    tools: [tool],
    deployment: {
      mode: "production-behind-proxy",
      allowedAuthorities: ["api.example"],
      allowedOrigins: ["https://api.example"],
      trustedProxyAddresses: ["127.0.0.1"],
      rateLimit: { maxRequests: 1, windowMs: 1_000, maxClients: 1 },
    },
  });
  await app.close();
});

test("production rejects signed-in streaming even with valid OAuth configuration", () => {
  const tool = defineStreamingTool({
    name: "signed-in-stream", access: "protected", requiredScopes: ["read"],
    description: "Stream after sign-in.", inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.literal(true) }),
    handler: () => ({ text: "ok", data: { ok: true } }),
  });
  assert.throws(() => createEmseepea({
    name: "signed-in-stream-test", version: "0.0.0", tools: [tool],
    oauth: {
      verifier: { async verifyAccessToken() { throw new Error("must not be called"); } },
      metadata: {
        resourceServerUrl: new URL("https://api.example/mcp"),
        oauthMetadata: {
          issuer: "https://auth.example", authorization_endpoint: "https://auth.example/authorize",
          token_endpoint: "https://auth.example/token", response_types_supported: ["code"],
        },
      },
    },
    deployment: {
      mode: "production-behind-proxy", allowedAuthorities: ["api.example"],
      allowedOrigins: ["https://api.example"], trustedProxyAddresses: ["127.0.0.1"],
      rateLimit: { maxRequests: 10, windowMs: 1_000, maxClients: 1 },
    },
  }), /Protected streaming tools currently require the loopback deployment profile/);
});

test("POST-scoped progress stays checked, bounded, and terminal", async () => {
  let retainedReport;
  let disconnectStarted;
  const started = new Promise((resolve) => { disconnectStarted = resolve; });
  let observeCancellation;
  const cancelled = new Promise((resolve) => { observeCancellation = resolve; });
  let validRuns = 0;
  const stream = defineStreamingTool({
    name: "brew-plan",
    access: "public",
    description: "Run a synthetic three-step brew plan with bounded progress.",
    inputSchema: z.object({
      mode: z.enum(["valid", "unawaited", "invalid", "equal", "caught-invalid", "oversized", "overflow", "timeout", "disconnect"]),
    }),
    outputSchema: z.object({ status: z.literal("complete"), steps: z.number().int() }),
    async handler({ mode }, { reportProgress, signal }) {
      retainedReport = reportProgress;
      const run = mode === "valid" ? ++validRuns : 0;
      const message = (value) => run ? `run ${run}: ${value}` : value;
      if (mode === "unawaited") {
        void reportProgress({ progress: 1, total: 1, message: "dose" });
        return { text: "Brew plan complete", data: { status: "complete", steps: 3 } };
      }
      await reportProgress({ progress: 1, total: 3, message: message("dose") });
      if (mode === "invalid") await reportProgress({ progress: 0, total: 3, message: "rewind" });
      if (mode === "equal") await reportProgress({ progress: 1, total: 3, message: "same" });
      if (mode === "caught-invalid") {
        try {
          await reportProgress({ progress: 0, total: 3, message: "rewind" });
        } catch {}
        return { text: "Brew plan complete", data: { status: "complete", steps: 3 } };
      }
      if (mode === "oversized") await reportProgress({ progress: 2, total: 3, message: "x".repeat(300) });
      if (mode === "overflow") {
        await reportProgress({ progress: 2, total: 3, message: "pour" });
        await reportProgress({ progress: 3, total: 3, message: "draw down" });
        await reportProgress({ progress: 3, total: 3, message: "extra" });
      }
      if (mode === "disconnect") {
        disconnectStarted();
        try {
          await delay(5_000, undefined, { signal });
        } catch (error) {
          observeCancellation(signal.aborted);
          throw error;
        }
      }
      if (mode === "timeout") await delay(5_000, undefined, { signal });
      await reportProgress({ progress: 2, total: 3, message: message("pour") });
      await reportProgress({ progress: 3, total: 3, message: message("draw down") });
      return { text: "Brew plan complete", data: { status: "complete", steps: 3 } };
    },
  });
  const ordinary = defineTool({
    name: "ordinary",
    access: "public",
    description: "Return a result without progress.",
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.literal(true) }),
    handler: () => ({ text: "ok", data: { ok: true } }),
  });
  const app = createEmseepea({
    name: "streaming-progress",
    version: "0.0.0",
    tools: [stream, ordinary],
    maxProgressEvents: 3,
    maxProgressEventBytes: 256,
    operationTimeoutMs: 100,
  });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const listed = await rpc(running.url, "tools/list");
    assert.deepEqual(listed.body.result.tools.map(({ name }) => name), ["brew-plan", "ordinary"]);
    assert.equal(listed.body.result.tools.some((tool) => (
      Object.keys(tool).some((key) => key.toLowerCase().includes("progress"))
    )), false);

    const ordinaryWithToken = await rpc(
      running.url,
      "tools/call",
      { name: "ordinary", arguments: {} },
      "ordinary-token",
    );
    assert.match(ordinaryWithToken.response.headers.get("content-type"), /^application\/json/);

    const json = await rpc(
      running.url,
      "tools/call",
      { name: "brew-plan", arguments: { mode: "valid" } },
    );
    assert.match(json.response.headers.get("content-type"), /^application\/json/);
    assert.deepEqual(json.body.result.structuredContent, { status: "complete", steps: 3 });

    const streamed = await rpc(
      running.url,
      "tools/call",
      { name: "brew-plan", arguments: { mode: "valid" } },
      "progress-token",
      undefined,
      undefined,
    );
    assert.match(streamed.response.headers.get("content-type"), /^text\/event-stream/);
    assert.equal(streamed.response.headers.get("x-accel-buffering"), "no");
    assert.equal(streamed.messages.length, 4);
    assert.deepEqual(streamed.messages.slice(0, 3).map(({ params }) => params.progress), [1, 2, 3]);
    assert.ok(streamed.messages.slice(0, 3).every(({ params }) => params.progressToken === "progress-token"));
    assert.equal(streamed.messages[3].result.resultType, "complete");
    assert.deepEqual(streamed.messages[3].result, json.body.result);
    await assert.rejects(retainedReport({ progress: 3, total: 3 }), /no longer available/);

    const runsBeforeStaleHeader = validRuns;
    const nonResumed = await rpc(
      running.url,
      "tools/call",
      { name: "brew-plan", arguments: { mode: "valid" } },
      "new-progress-token",
      undefined,
      undefined,
      { "Last-Event-ID": "stale-event" },
    );
    assert.equal(validRuns, runsBeforeStaleHeader + 1);
    assert.deepEqual(nonResumed.messages.slice(0, 3).map(({ params }) => params.progress), [1, 2, 3]);
    assert.ok(nonResumed.messages.slice(0, 3).every(({ params }) => (
      params.progressToken === "new-progress-token" && params.message.startsWith(`run ${validRuns}:`)
    )));
    assert.equal(nonResumed.messages.length, 4);

    const unawaited = await rpc(
      running.url,
      "tools/call",
      { name: "brew-plan", arguments: { mode: "unawaited" } },
      "unawaited-token",
    );
    assert.equal(unawaited.messages.length, 2);
    assert.equal(unawaited.messages[0].params.progress, 1);
    assert.equal(unawaited.messages[1].result.isError, false);

    const invalid = await rpc(
      running.url,
      "tools/call",
      { name: "brew-plan", arguments: { mode: "invalid" } },
      "invalid-token",
    );
    assert.equal(invalid.messages.length, 2);
    assert.equal(invalid.messages[1].result.isError, true);

    const equal = await rpc(
      running.url,
      "tools/call",
      { name: "brew-plan", arguments: { mode: "equal" } },
      "equal-token",
    );
    assert.equal(equal.messages.length, 2);
    assert.equal(equal.messages[1].result.isError, true);

    const caughtInvalid = await rpc(
      running.url,
      "tools/call",
      { name: "brew-plan", arguments: { mode: "caught-invalid" } },
      "caught-invalid-token",
    );
    assert.equal(caughtInvalid.messages.length, 2);
    assert.equal(caughtInvalid.messages[1].result.isError, true);

    const oversized = await rpc(
      running.url,
      "tools/call",
      { name: "brew-plan", arguments: { mode: "oversized" } },
      "oversized-token",
    );
    assert.equal(oversized.messages.length, 2);
    assert.equal(oversized.messages[1].result.isError, true);

    const overflow = await rpc(
      running.url,
      "tools/call",
      { name: "brew-plan", arguments: { mode: "overflow" } },
      "overflow-token",
    );
    assert.equal(overflow.messages.length, 4);
    assert.deepEqual(overflow.messages.slice(0, 3).map(({ params }) => params.progress), [1, 2, 3]);
    assert.equal(overflow.messages[3].result.isError, true);

    const timedOut = await rpc(
      running.url,
      "tools/call",
      { name: "brew-plan", arguments: { mode: "timeout" } },
      "timeout-token",
    );
    assert.equal(timedOut.messages.length, 2);
    assert.equal(timedOut.messages[1].result.isError, true);

    const progress = [];
    const client = new Client(
      { name: "streaming-independent-client", version: "0.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await client.connect(new StreamableHTTPClientTransport(running.url));
    try {
      const result = await client.callTool(
        { name: "brew-plan", arguments: { mode: "valid" } },
        { onprogress: (update) => progress.push(update) },
      );
      assert.deepEqual(progress.map(({ progress }) => progress), [1, 2, 3]);
      assert.deepEqual(result.structuredContent, { status: "complete", steps: 3 });
    } finally {
      await client.close();
    }

    const controller = new AbortController();
    const disconnecting = rpc(
      running.url,
      "tools/call",
      { name: "brew-plan", arguments: { mode: "disconnect" } },
      "disconnect-token",
      controller.signal,
    );
    await started;
    controller.abort();
    await assert.rejects(disconnecting, /abort/i);
    assert.equal(await Promise.race([cancelled, delay(250).then(() => false)]), true);
  } finally {
    await running.close();
  }
});

test("authorization finishes before protected streaming begins", async () => {
  let calls = 0;
  const tool = defineStreamingTool({
    name: "protected-stream",
    access: "protected",
    requiredScopes: ["brew:read"],
    description: "Return protected synthetic progress.",
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.literal(true) }),
    async handler(_input, { reportProgress }) {
      calls += 1;
      await reportProgress({ progress: 1, total: 1 });
      return { text: "ok", data: { ok: true } };
    },
  });
  const app = createEmseepea({
    name: "protected-streaming",
    version: "0.0.0",
    tools: [tool],
    oauth: {
      verifier: {
        async verifyAccessToken() {
          throw new OAuthError(OAuthErrorCode.InvalidToken, "invalid");
        },
      },
      metadata: {
        resourceServerUrl: new URL("https://api.example/mcp"),
        oauthMetadata: {
          issuer: "https://auth.example",
          authorization_endpoint: "https://auth.example/authorize",
          token_endpoint: "https://auth.example/token",
          response_types_supported: ["code"],
        },
      },
    },
  });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const denied = await rpc(
      running.url,
      "tools/call",
      { name: "protected-stream", arguments: {} },
      "protected-token",
      undefined,
      "invalid",
    );
    assert.equal(denied.response.status, 401);
    assert.match(denied.response.headers.get("content-type"), /^application\/json/);
    assert.equal(calls, 0);
  } finally {
    await running.close();
  }
});

function streamingTool(onCall) {
  return defineStreamingTool({
    name: "stream",
    access: "public",
    description: "Stream synthetic progress.",
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.literal(true) }),
    handler: (_input, context) => {
      onCall(context);
      return { text: "ok", data: { ok: true } };
    },
  });
}

async function rpc(url, method, params = {}, progressToken, signal, bearerToken, extraHeaders = {}) {
  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(method === "tools/call" ? { "Mcp-Name": params.name } : {}),
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: {
        ...params,
        _meta: {
          ...meta,
          ...(progressToken === undefined ? {} : { progressToken }),
        },
      },
    }),
  });
  if (response.headers.get("content-type")?.startsWith("text/event-stream")) {
    const messages = (await response.text())
      .split("\n\n")
      .filter((frame) => frame.startsWith("event: message\n"))
      .map((frame) => JSON.parse(frame.slice(frame.indexOf("data: ") + 6)));
    return { response, messages };
  }
  return { response, body: await response.json(), messages: [] };
}
