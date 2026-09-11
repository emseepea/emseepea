import assert from "node:assert/strict";
import test from "node:test";
import { fork } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import {
  createEmseepea, defineTool, defineResource, defineResourceTemplate, definePrompt,
  inputRequired, rootsResponse, serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";

const roots = [{ uri: "file:///workspace", name: "Workspace", _meta: { nested: { value: 1 } } }];
const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": { roots: {} },
};
const options = { name: "client-roots-test", version: "0.0.0", clientRoots: {} };

async function rpc(url, method, params = {}, capabilities = { roots: {} }, token) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json", accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": method,
      ...(params.name ? { "Mcp-Name": params.name } : {}),
      ...(method === "resources/read" ? { "Mcp-Name": params.uri } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: {
      ...params, _meta: { ...meta, "io.modelcontextprotocol/clientCapabilities": capabilities },
    } }),
  });
  return { response, body: await response.json() };
}

test("official client completes roots rounds for every direct handler", async () => {
  let calls = 0;
  const resume = (context, finish) => {
    calls++;
    const result = rootsResponse(context.inputResponses, "workspace");
    if (result === undefined) return inputRequired({ inputRequests: { workspace: inputRequired.roots() } });
    assert.deepEqual(result, roots);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result[0]._meta.nested));
    assert.throws(() => { result[0]._meta.nested.value = 2; }, TypeError);
    return finish(result[0].uri);
  };
  const running = await serveEmseepea(createEmseepea({
    ...options,
    tools: [defineTool({
      name: "roots", description: "Ask for client workspace roots.", access: "public",
      inputSchema: z.object({}), outputSchema: z.object({ uri: z.string() }),
      handler: (_input, context) => resume(context, (uri) => ({ data: { uri } })),
    })],
    resources: [defineResource({
      name: "static", uri: "roots://static", access: "public",
      handler: (context) => resume(context, (text) => ({ contents: [{ uri: "roots://static", text }] })),
    }), defineResourceTemplate({
      name: "template", uriTemplate: "roots://template/{id}", access: "public",
      handler: ({ uri }, context) => resume(context, (text) => ({ contents: [{ uri, text }] })),
    })],
    prompts: [definePrompt({
      name: "prompt", access: "public", argsSchema: z.object({}),
      handler: (_args, context) => resume(context, (text) => ({
        messages: [{ role: "user", content: { type: "text", text } }],
      })),
    })],
  }), { port: 0 });
  const client = new Client({ name: "roots-client", version: "0.0.0" }, {
    capabilities: { roots: {} }, inputRequired: { maxRounds: 2 },
    versionNegotiation: { mode: { pin: "2026-07-28" } },
  });
  client.setRequestHandler("roots/list", async () => ({ roots }));
  try {
    await client.connect(new StreamableHTTPClientTransport(running.url));
    assert.deepEqual((await client.callTool({ name: "roots", arguments: {} })).structuredContent, { uri: roots[0].uri });
    assert.equal((await client.readResource({ uri: "roots://static" })).contents[0].text, roots[0].uri);
    assert.equal((await client.readResource({ uri: "roots://template/one" })).contents[0].text, roots[0].uri);
    assert.equal((await client.getPrompt({ name: "prompt", arguments: {} })).messages[0].content.text, roots[0].uri);
    assert.equal(calls, 8);
    const missingCapability = await rpc(running.url, "tools/call", { name: "roots", arguments: {} }, {});
    assert.equal(missingCapability.response.status, 400);
    assert.equal(missingCapability.body.error.code, -32021);
    const discovery = await rpc(running.url, "server/discover");
    assert.equal(discovery.body.result.capabilities.roots, undefined);
  } finally {
    await client.close();
    await running.close();
  }
});

test("protected roots rounds reauthorize and signed state resumes on another server", async () => {
  let calls = 0;
  const authentication = {
    verifier: { async verifyAccessToken(token) {
      if (token === "invalid") throw new OAuthError(OAuthErrorCode.InvalidToken, "invalid");
      return { token, clientId: token === "other" ? "other" : "client", scopes: token === "denied" ? [] : ["read"],
        expiresAt: Math.floor(Date.now() / 1000) + 60, resource: new URL("https://api.example/mcp") };
    } },
    metadata: { resourceServerUrl: new URL("https://api.example/mcp"), oauthMetadata: {
      issuer: "https://auth.example", authorization_endpoint: "https://auth.example/authorize",
      token_endpoint: "https://auth.example/token", response_types_supported: ["code"],
    } },
  };
  const resume = async (context, finish) => {
    calls++;
    const value = rootsResponse(context.inputResponses, "workspace");
    if (value !== undefined) {
      assert.equal(context.requestState.key, "workspace");
      return finish(String(value.length));
    }
    return inputRequired({
      inputRequests: { workspace: inputRequired.roots() },
      requestState: await context.mintRequestState({ key: "workspace" }),
    });
  };
  const access = { access: "protected", requiredScopes: ["read"] };
  const appOptions = {
    ...options, authentication, requestState: { key: "0123456789abcdef0123456789abcdef", ttlSeconds: 60 },
    tools: [defineTool({ ...access, name: "roots", description: "Inspect protected roots.",
      inputSchema: z.object({}), outputSchema: z.object({ count: z.string() }),
      handler: (_input, context) => resume(context, (count) => ({ data: { count } })),
    })],
    resources: [defineResource({ ...access, name: "static", uri: "roots://static",
      handler: (context) => resume(context, (text) => ({ contents: [{ uri: "roots://static", text }] })),
    }), defineResourceTemplate({ ...access, name: "template", uriTemplate: "roots://template/{id}",
      handler: ({ uri }, context) => resume(context, (text) => ({ contents: [{ uri, text }] })),
    })],
    prompts: [definePrompt({ ...access, name: "prompt", argsSchema: z.object({}),
      handler: (_args, context) => resume(context, (text) => ({ messages: [{ role: "user", content: { type: "text", text } }] })),
    })],
  };
  const first = await serveEmseepea(createEmseepea(appOptions), { port: 0 });
  const second = await serveEmseepea(createEmseepea(appOptions), { port: 0 });
  try {
    const requests = [
      ["tools/call", { name: "roots", arguments: {} }],
      ["resources/read", { uri: "roots://static" }],
      ["resources/read", { uri: "roots://template/one" }],
      ["prompts/get", { name: "prompt", arguments: {} }],
    ];
    for (const [method, params] of requests) {
      const begin = await rpc(first.url, method, params, undefined, "valid");
      assert.equal(begin.body.result.resultType, "input_required");
      const continuation = { ...params, requestState: begin.body.result.requestState, inputResponses: { workspace: { roots } } };
      for (const token of [undefined, "invalid", "denied", "other"]) {
        const before = calls;
        const denied = await rpc(second.url, method, continuation, undefined, token);
        assert.ok(denied.body.error || denied.body.result?.isError);
        assert.equal(calls, before);
      }
      const before = calls;
      const malformed = await rpc(second.url, method, { ...continuation, inputResponses: { workspace: { roots: [{ uri: "https://bad" }] } } }, undefined, "valid");
      assert.ok(malformed.body.error || malformed.body.result?.isError);
      assert.equal(calls, before);
      const resumed = await rpc(second.url, method, continuation, undefined, "valid");
      assert.equal(resumed.body.result.resultType, "complete");
      assert.notEqual(resumed.body.result.isError, true);
      assert.equal(calls, before + 1);
    }
    const client = new Client({ name: "protected-roots", version: "0.0.0" }, {
      capabilities: { roots: {} }, inputRequired: { maxRounds: 2 },
      versionNegotiation: { mode: { pin: "2026-07-28" } },
    });
    client.setRequestHandler("roots/list", async () => ({ roots }));
    try {
      await client.connect(new StreamableHTTPClientTransport(second.url, {
        requestInit: { headers: { authorization: "Bearer valid" } },
      }));
      assert.equal((await client.callTool({ name: "roots", arguments: {} })).structuredContent.count, "1");
      assert.equal((await client.readResource({ uri: "roots://static" })).contents[0].text, "1");
      assert.equal((await client.readResource({ uri: "roots://template/one" })).contents[0].text, "1");
      assert.equal((await client.getPrompt({ name: "prompt", arguments: {} })).messages[0].content.text, "1");
    } finally { await client.close(); }
  } finally { await first.close(); await second.close(); }
});

test("roots continuations retain deadline, cancellation, and legacy boundaries", async () => {
  let started;
  let cancelled;
  const begin = new Promise((resolve) => { started = resolve; });
  const end = new Promise((resolve) => { cancelled = resolve; });
  const tool = defineTool({
    name: "slow", access: "public", description: "Cancel roots continuation work.",
    inputSchema: z.object({}), outputSchema: z.object({}),
    async handler(_input, context) {
      if (context.inputResponses === undefined) return inputRequired({ inputRequests: { workspace: inputRequired.roots() } });
      assert.equal(rootsResponse(context.inputResponses, "workspace").length, 1);
      started();
      try { await delay(5000, undefined, { signal: context.signal }); }
      finally { cancelled(context.signal.aborted); }
      return { data: {} };
    },
  });
  const running = await serveEmseepea(createEmseepea({ ...options, tools: [tool], operationTimeoutMs: 100 }), { port: 0 });
  try {
    const timedOut = await rpc(running.url, "tools/call", { name: "slow", arguments: {}, inputResponses: { workspace: { roots } } });
    assert.equal(timedOut.body.result.isError, true);
    assert.equal(await end, true);
    const client = new Client({ name: "cancel-roots", version: "0.0.0" }, {
      capabilities: { roots: {} }, inputRequired: { maxRounds: 2 },
      versionNegotiation: { mode: { pin: "2026-07-28" } },
    });
    let reportStarted;
    let reportCancelled;
    const nextStarted = new Promise((resolve) => { reportStarted = resolve; });
    const nextCancelled = new Promise((resolve) => { reportCancelled = resolve; });
    started = reportStarted;
    cancelled = reportCancelled;
    client.setRequestHandler("roots/list", async () => ({ roots }));
    try {
      await client.connect(new StreamableHTTPClientTransport(running.url));
      const controller = new AbortController();
      const call = client.callTool({ name: "slow", arguments: {} }, { signal: controller.signal });
      const rejected = assert.rejects(call, /abort/i);
      await Promise.race([nextStarted, delay(2000).then(() => { throw new Error("Continuation did not start"); })]);
      controller.abort();
      await rejected;
      assert.equal(await nextCancelled, true);
    } finally { await client.close(); }
    const legacy = await fetch(running.url, {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "slow", arguments: {} } }),
    });
    const text = await legacy.text();
    const body = legacy.headers.get("content-type")?.startsWith("text/event-stream")
      ? text.split("\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6))).at(-1)
      : JSON.parse(text);
    assert.ok(body.error || body.result?.isError);
    await begin;
  } finally { await running.close(); }
});

test("default root count permits 100 roots and configured larger counts work", async () => {
  for (const clientRoots of [{}, { maxRoots: 101 }]) {
    let calls = 0;
    const running = await serveEmseepea(createEmseepea({ ...options, clientRoots,
      tools: [defineTool({ name: "count", access: "public", description: "Count roots.",
        inputSchema: z.object({}), outputSchema: z.object({ count: z.number() }),
        handler: (_input, context) => { calls++; return { data: { count: rootsResponse(context.inputResponses, "workspace").length } }; },
      })],
    }), { port: 0 });
    try {
      for (const count of [100, 101]) {
        const result = await rpc(running.url, "tools/call", { name: "count", arguments: {},
          inputResponses: { workspace: { roots: Array.from({ length: count }, (_, i) => ({ uri: `file:///root/${i}` })) } },
        });
        if (count <= (clientRoots.maxRoots ?? 100)) assert.equal(result.body.result.structuredContent.count, count);
        else assert.equal(result.body.result.isError, true);
      }
      assert.equal(calls, clientRoots.maxRoots ? 2 : 1);
    } finally { await running.close(); }
  }
});

test("roots validation rejects malformed data before handlers and accessors check keys", async () => {
  let calls = 0;
  const config = { maxRoots: 1 };
  const running = await serveEmseepea(createEmseepea({
    ...options, clientRoots: config, maxRequestBytes: 2048,
    tools: [defineTool({
      name: "inspect", description: "Inspect checked roots.", access: "public",
      inputSchema: z.object({ key: z.string().default("workspace") }),
      outputSchema: z.object({ count: z.number() }),
      handler({ key }, context) {
        calls++;
        const value = rootsResponse(context.inputResponses, key);
        return { data: { count: value?.length ?? -1 } };
      },
    })],
  }), { port: 0 });
  config.maxRoots = 1000;
  const call = (inputResponses, capabilities, key = "workspace") => rpc(running.url, "tools/call", {
    name: "inspect", arguments: { key }, inputResponses,
  }, capabilities);
  try {
    for (const invalid of [
      { roots: "wrong" }, { roots: [{ uri: "https://example.com" }] },
      { roots: [{ uri: "file://[" }] }, { roots: [{ uri: 1 }] },
      { roots: [{ uri: "file:///a", name: 1 }] }, { roots: [...roots, ...roots] },
      { roots, action: "accept" }, { method: "roots/list", result: { roots } },
      null, { nonsense: true },
    ]) {
      const before = calls;
      const result = await call({ workspace: invalid });
      assert.ok(result.body.error || result.body.result?.isError, JSON.stringify(invalid));
      assert.equal(calls, before);
    }
    for (const capabilities of [{}, { roots: null }, { roots: "yes" }]) {
      const before = calls;
      const result = await call({ workspace: { roots } }, capabilities);
      assert.ok(result.body.error || result.body.result?.isError);
      assert.equal(calls, before);
    }
    const oversized = await call({ workspace: { roots: [{ uri: `file:///${"x".repeat(3000)}` }] } });
    assert.equal(oversized.response.status, 413);
    assert.deepEqual((await call({ workspace: { roots } })).body.result.structuredContent, { count: 1 });
    assert.deepEqual((await call({ workspace: { roots: [] } })).body.result.structuredContent, { count: 0 });
    assert.deepEqual((await call({ other: { roots } })).body.result.structuredContent, { count: -1 });
    assert.equal((await call({ workspace: { action: "decline" } })).body.result.isError, true);
    const sensitiveKey = JSON.parse('{"__proto__":{"roots":[]}}');
    const before = calls;
    assert.ok((await call(sensitiveKey, undefined, "__proto__")).body.error);
    assert.equal(calls, before);
    assert.throws(() => rootsResponse({ workspace: { roots } }, "workspace"), /not been checked/);
  } finally { await running.close(); }
});

test("roots configuration is checked and disabled applications still reject roots requests", async () => {
  for (const clientRoots of [null, true, [], { maxRoots: null }, { maxRoots: 0 }, { maxRoots: -1 }, { maxRoots: 1.5 },
    { maxRoots: NaN }, { maxRoots: Infinity }, { maxRoots: "2" }, { maxRoots: 2 ** 53 }]) {
    assert.throws(() => createEmseepea({ ...options, clientRoots }), /clientRoots/);
  }
  const running = await serveEmseepea(createEmseepea({
    ...options, clientRoots: undefined,
    tools: [defineTool({
      name: "roots", description: "Reject disabled roots.", access: "public",
      inputSchema: z.object({}), outputSchema: z.object({}),
      handler: () => inputRequired({ inputRequests: { workspace: inputRequired.roots() } }),
    })],
  }), { port: 0 });
  try {
    assert.equal((await rpc(running.url, "tools/call", { name: "roots", arguments: {} })).body.result.isError, true);
  } finally { await running.close(); }
});

test("signed roots continuation survives process shutdown and restart", async () => {
  const start = async () => {
    const child = fork(new URL("../fixtures/client-roots-server.mjs", import.meta.url), [], {
      stdio: ["ignore", "ignore", "inherit", "ipc"],
    });
    const [url] = await once(child, "message", { signal: AbortSignal.timeout(10_000) });
    return { child, url };
  };
  const stop = async ({ child }) => {
    const exit = once(child, "exit", { signal: AbortSignal.timeout(5000) });
    child.send("close");
    await exit;
  };
  let running = await start();
  try {
    const begin = await rpc(running.url, "tools/call", { name: "roots", arguments: {} });
    assert.equal(begin.body.result.resultType, "input_required");
    await stop(running);
    running = await start();
    const resumed = await rpc(running.url, "tools/call", {
      name: "roots", arguments: {}, requestState: begin.body.result.requestState,
      inputResponses: { workspace: { roots } },
    });
    assert.deepEqual(resumed.body.result.structuredContent, { uri: "file:///workspace", value: "survived" });
  } finally { if (running.child.exitCode === null) await stop(running); }
});
