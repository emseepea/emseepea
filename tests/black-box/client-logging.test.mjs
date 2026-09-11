import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import {
  createEmseepea,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  defineTool,
  serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";

const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "client-logging-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("request-scoped client logging is opt-in, filtered, bounded, and terminal", async () => {
  let retainedReport;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  let markCancelled;
  const cancelled = new Promise((resolve) => { markCancelled = resolve; });
  const tool = defineTool({
    name: "log",
    access: "public",
    description: "Exercise client-visible request logging.",
    inputSchema: z.object({ mode: z.string(), label: z.string().optional() }),
    outputSchema: z.object({ ok: z.literal(true) }),
    async handler({ mode, label = "one" }, { reportLog, signal }) {
      retainedReport = reportLog;
      assert.equal(typeof reportLog, "function");
      if (mode === "invalid-level") await reportLog({ level: "loud", data: label });
      if (mode === "invalid-logger") await reportLog({ level: "info", logger: 42, data: label });
      if (mode === "non-json") await reportLog({ level: "info", data: undefined });
      if (mode === "oversized") await reportLog({ level: "info", data: "x".repeat(512) });
      if (mode === "unawaited") {
        void reportLog({ level: "info", data: "x".repeat(512) });
        return { data: { ok: true } };
      }
      if (mode === "caught-invalid") {
        try { await reportLog({ level: "loud", data: label }); } catch {}
        return { data: { ok: true } };
      }
      await reportLog({ level: "debug", logger: "worker", data: `debug:${label}` });
      if (mode === "disconnect") {
        markStarted();
        try {
          await delay(5_000, undefined, { signal });
        } catch (error) {
          markCancelled(signal.aborted);
          throw error;
        }
      }
      await reportLog({ level: "warning", logger: "worker", data: `warning:${label}` });
      if (mode === "overflow") await reportLog({ level: "error", data: label });
      return { data: { ok: true } };
    },
  });
  const resource = defineResource({
    name: "logged-resource", access: "public", uri: "log://static",
    async handler({ reportLog }) {
      await reportLog({ level: "info", data: "resource" });
      return { contents: [{ uri: "log://static", text: "resource" }] };
    },
  });
  const template = defineResourceTemplate({
    name: "logged-template", access: "public", uriTemplate: "log://template/{id}",
    async handler({ uri }, { reportLog }) {
      await reportLog({ level: "info", data: "template" });
      return { contents: [{ uri, text: "template" }] };
    },
  });
  const prompt = definePrompt({
    name: "logged-prompt", access: "public", argsSchema: z.object({}),
    async handler(_args, { reportLog }) {
      await reportLog({ level: "info", data: "prompt" });
      return { messages: [{ role: "user", content: { type: "text", text: "prompt" } }] };
    },
  });
  const app = createEmseepea({
    name: "client-logging",
    version: "0.0.0",
    tools: [tool],
    resources: [resource, template],
    prompts: [prompt],
    clientLogging: { maxEvents: 2, maxEventBytes: 256 },
  });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const discovery = await rpc(running.url, "server/discover");
    assert.deepEqual(discovery.body.result.capabilities.logging, {});

    const withoutLevel = await rpc(running.url, "tools/call", {
      name: "log", arguments: { mode: "valid" },
    });
    assert.match(withoutLevel.response.headers.get("content-type"), /^application\/json/);
    assert.equal(withoutLevel.body.result.isError, false);

    const notifications = [];
    const client = new Client(
      { name: "official-client-logging-test", version: "0.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    client.setNotificationHandler("notifications/message", ({ params }) => {
      notifications.push(params);
    });
    await client.connect(new StreamableHTTPClientTransport(running.url));
    try {
      const result = await client.callTool({
        name: "log",
        arguments: { mode: "valid" },
        _meta: { "io.modelcontextprotocol/logLevel": "warning" },
      });
      assert.deepEqual(notifications.map(({ level, data }) => [level, data]), [
        ["warning", "warning:one"],
      ]);
      assert.deepEqual(result.structuredContent, { ok: true });
    } finally {
      await client.close();
    }
    const legacyClient = new Client(
      { name: "legacy-client-logging-test", version: "0.0.0" },
      { supportedProtocolVersions: ["2025-06-18"], versionNegotiation: { mode: "legacy" } },
    );
    await legacyClient.connect(new StreamableHTTPClientTransport(running.url));
    try {
      assert.equal(legacyClient.getServerCapabilities()?.logging, undefined);
    } finally {
      await legacyClient.close();
    }

    const [left, right] = await Promise.all([
      rpc(running.url, "tools/call", {
        name: "log", arguments: { mode: "valid", label: "left" },
      }, "debug"),
      rpc(running.url, "tools/call", {
        name: "log", arguments: { mode: "valid", label: "right" },
      }, "debug"),
    ]);
    assert.deepEqual(left.messages.slice(0, 2).map(({ params }) => params.data), [
      "debug:left", "warning:left",
    ]);
    assert.deepEqual(right.messages.slice(0, 2).map(({ params }) => params.data), [
      "debug:right", "warning:right",
    ]);

    for (const [method, params, expected] of [
      ["resources/read", { uri: "log://static" }, "resource"],
      ["resources/read", { uri: "log://template/7" }, "template"],
      ["prompts/get", { name: "logged-prompt", arguments: {} }, "prompt"],
    ]) {
      const logged = await rpc(running.url, method, params, "info");
      assert.equal(logged.messages[0].params.data, expected);
      assert.equal(logged.messages.at(-1).result.resultType, "complete");
    }

    for (const mode of [
      "invalid-level", "invalid-logger", "non-json", "oversized", "overflow",
      "unawaited", "caught-invalid",
    ]) {
      const failed = await rpc(running.url, "tools/call", {
        name: "log", arguments: { mode },
      }, "debug");
      const terminal = failed.messages.at(-1) ?? failed.body;
      assert.equal(terminal.result.isError, true, mode);
    }
    await assert.rejects(retainedReport({ level: "info", data: "late" }), /no longer available/);

    const controller = new AbortController();
    const disconnecting = rpc(
      running.url,
      "tools/call",
      { name: "log", arguments: { mode: "disconnect" } },
      "debug",
      undefined,
      controller.signal,
    );
    await started;
    controller.abort();
    await assert.rejects(disconnecting, /abort/i);
    assert.equal(await Promise.race([cancelled, delay(250).then(() => false)]), true);

    const modernSetLevel = await rpc(running.url, "logging/setLevel", { level: "debug" });
    assert.equal(modernSetLevel.response.status, 404);
    assert.equal(modernSetLevel.body.error.code, -32601);
    const legacySetLevel = await legacyRpc(running.url, "logging/setLevel", { level: "debug" });
    assert.equal(legacySetLevel.response.status, 404);
    assert.equal(legacySetLevel.body.error.code, -32601);
  } finally {
    await running.close();
  }
});

test("disabled and unauthorized logging cannot expose a reporter or start a stream", async () => {
  let disabledContext;
  let protectedCalls = 0;
  const disabled = createEmseepea({
    name: "disabled-client-logging", version: "0.0.0",
    tools: [defineTool({
      name: "plain", access: "public", description: "Return a plain result.",
      inputSchema: z.object({}), outputSchema: z.object({ ok: z.literal(true) }),
      handler(_input, context) {
        disabledContext = context;
        return { data: { ok: true } };
      },
    })],
  });
  const protectedApp = createEmseepea({
    name: "protected-client-logging", version: "0.0.0", clientLogging: {},
    tools: [defineTool({
      name: "protected", access: "protected", requiredScopes: ["read"],
      description: "Return a protected result.", inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.literal(true) }),
      async handler(_input, { principal, reportLog }) {
        protectedCalls += 1;
        await reportLog({ level: "info", data: principal.clientId });
        return { data: { ok: true } };
      },
    })],
    authentication: {
      verifier: {
        async verifyAccessToken(token) {
          if (token === "invalid") throw new OAuthError(OAuthErrorCode.InvalidToken, "invalid");
          return {
            token,
            clientId: token.startsWith("left") ? "left-client" : "right-client",
            scopes: token === "wrong-scope" ? ["other"] : ["read"],
            expiresAt: Math.floor(Date.now() / 1_000) + 60,
            resource: new URL("https://api.example/mcp"),
          };
        },
      },
      metadata: {
        resourceServerUrl: new URL("https://api.example/mcp"),
        oauthMetadata: {
          issuer: "https://auth.example", authorization_endpoint: "https://auth.example/authorize",
          token_endpoint: "https://auth.example/token", response_types_supported: ["code"],
        },
      },
    },
  });
  const [plainServer, protectedServer] = await Promise.all([
    serveEmseepea(disabled, { port: 0 }), serveEmseepea(protectedApp, { port: 0 }),
  ]);
  try {
    const discovery = await rpc(plainServer.url, "server/discover");
    assert.equal(discovery.body.result.capabilities.logging, undefined);
    const plain = await rpc(plainServer.url, "tools/call", { name: "plain", arguments: {} }, "debug");
    assert.match(plain.response.headers.get("content-type"), /^application\/json/);
    assert.equal("reportLog" in disabledContext, false);

    const denied = await rpc(
      protectedServer.url,
      "tools/call",
      { name: "protected", arguments: {} },
      "debug",
      "invalid",
    );
    assert.equal(denied.response.status, 401);
    assert.match(denied.response.headers.get("content-type"), /^application\/json/);
    assert.equal(protectedCalls, 0);

    const forbidden = await rpc(
      protectedServer.url,
      "tools/call",
      { name: "protected", arguments: {} },
      "info",
      "wrong-scope",
    );
    assert.equal(forbidden.response.status, 403);
    assert.match(forbidden.response.headers.get("content-type"), /^application\/json/);
    assert.equal(protectedCalls, 0);

    const [left, right] = await Promise.all([
      rpc(protectedServer.url, "tools/call", { name: "protected", arguments: {} }, "info", "left-secret"),
      rpc(protectedServer.url, "tools/call", { name: "protected", arguments: {} }, "info", "right-secret"),
    ]);
    assert.equal(left.messages[0].params.data, "left-client");
    assert.equal(right.messages[0].params.data, "right-client");
    assert.doesNotMatch(JSON.stringify(left.messages), /right-client|left-secret|right-secret/);
    assert.doesNotMatch(JSON.stringify(right.messages), /left-client|left-secret|right-secret/);
    assert.equal(protectedCalls, 2);
  } finally {
    await Promise.all([plainServer.close(), protectedServer.close()]);
  }
});

test("client logging configuration is bounded at startup", () => {
  const tool = defineTool({
    name: "plain", access: "public", description: "Return a plain result.",
    inputSchema: z.object({}), outputSchema: z.object({ ok: z.literal(true) }),
    handler: () => ({ data: { ok: true } }),
  });
  assert.throws(() => createEmseepea({
    name: "bad", version: "0.0.0", tools: [tool], clientLogging: { maxEvents: 0 },
  }), /clientLogging.maxEvents must be a positive safe integer/);
  assert.throws(() => createEmseepea({
    name: "bad", version: "0.0.0", tools: [tool], clientLogging: { maxEventBytes: 0 },
  }), /clientLogging.maxEventBytes must be a positive safe integer/);
});

async function rpc(url, method, params = {}, logLevel, bearerToken, signal) {
  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(method === "tools/call" ? { "Mcp-Name": params.name } : {}),
      ...(method === "resources/read" ? { "Mcp-Name": params.uri } : {}),
      ...(method === "prompts/get" ? { "Mcp-Name": params.name } : {}),
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: crypto.randomUUID(), method,
      params: {
        ...params,
        _meta: { ...meta, ...(logLevel ? { "io.modelcontextprotocol/logLevel": logLevel } : {}) },
      },
    }),
  });
  if (response.headers.get("content-type")?.startsWith("text/event-stream")) {
    const messages = (await response.text()).split("\n\n")
      .filter((frame) => frame.startsWith("event: message\n"))
      .map((frame) => JSON.parse(frame.slice(frame.indexOf("data: ") + 6)));
    return { response, messages };
  }
  return { response, body: await response.json(), messages: [] };
}

async function legacyRpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
  });
  return { response, body: await response.json() };
}
