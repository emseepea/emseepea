import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepeaFetch, defineTool } from "@emseepea/server";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { z } from "zod";

const endpoint = "https://worker.example/mcp";
const protocolVersion = "2026-07-28";

function request(method, params = {}, { url = endpoint, headers = {}, body, duplex } = {}) {
  return new Request(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": protocolVersion,
      "mcp-method": method,
      ...(params.name ? { "mcp-name": params.name } : {}),
      ...headers,
    },
    body: body ?? JSON.stringify({
      jsonrpc: "2.0", id: 1, method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": protocolVersion,
          "io.modelcontextprotocol/clientInfo": { name: "workers-fetch-test", version: "1" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
    ...(duplex ? { duplex } : {}),
  });
}

function fixture(discovery = "public") {
  const calls = { public: 0, protected: 0, protectedInput: 0, verifier: 0 };
  const publicTool = defineTool({
    name: "public-echo", description: "Echo synthetic public input.", access: "public",
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    handler({ value }, { principal }) {
      assert.equal(principal, undefined);
      calls.public++;
      return { data: { value: value === "invalid-output" ? 42 : value } };
    },
  });
  const protectedTool = defineTool({
    name: "protected-echo", description: "Echo synthetic input for the verified caller.",
    access: "protected", requiredScopes: ["tools:call"],
    inputSchema: z.object({ value: z.string() }).refine(() => {
      calls.protectedInput++;
      return true;
    }),
    outputSchema: z.object({ value: z.string(), client: z.string() }),
    handler({ value }, { principal }) {
      calls.protected++;
      return { data: { value, client: principal.clientId } };
    },
  });
  const handle = createEmseepeaFetch({
    name: "workers-fetch-test", version: "1",
    tools: [publicTool, protectedTool],
    allowedAuthorities: ["worker.example"],
    allowedOrigins: ["https://browser.example"],
    maxRequestBytes: 1024,
    authentication: {
      discovery,
      verifier: {
        async verifyAccessToken(token) {
          calls.verifier++;
          if (token === "invalid") throw new OAuthError(OAuthErrorCode.InvalidToken, "private-verifier-sentinel");
          if (token === "unavailable") throw new Error("private-verifier-sentinel");
          return {
            token, clientId: "verified-client",
            scopes: token === "unscoped" ? [] : ["tools:call"],
            expiresAt: token === "expired" ? 1 : Math.floor(Date.now() / 1000) + 60,
            resource: new URL(token === "wrong-resource" ? "https://other.example/mcp" : endpoint),
          };
        },
      },
      metadata: {
        resourceServerUrl: new URL(endpoint), scopesSupported: ["tools:call"],
        oauthMetadata: {
          issuer: "https://issuer.example",
          authorization_endpoint: "https://issuer.example/authorize",
          token_endpoint: "https://issuer.example/token",
          response_types_supported: ["code"],
        },
      },
    },
  });
  return { handle, calls };
}

const echo = (name, value = "hello") => ({ name, arguments: { value } });

test("the Fetch entry point discovers and lists tools, and validates calls", async () => {
  const { handle, calls } = fixture();
  const discovery = await handle(request("server/discover"));
  assert.deepEqual((await discovery.json()).result.capabilities.tools, { listChanged: false });
  const list = await handle(request("tools/list"));
  assert.equal((await list.json()).result.tools.length, 2);

  const call = (value) => handle(request("tools/call", echo("public-echo", value), {
    headers: { authorization: "Bearer invalid" },
  }));
  assert.deepEqual((await (await call("hello")).json()).result.structuredContent, { value: "hello" });
  assert.equal((await (await call(42)).json()).result.isError, true);
  assert.equal((await (await call("invalid-output")).json()).result.isError, true);
  assert.deepEqual(calls, { public: 2, protected: 0, protectedInput: 0, verifier: 0 });
});

test("Fetch rejects disallowed authority, Origin, and request bytes before verifier or tool execution", async () => {
  const { handle, calls } = fixture();
  const args = echo("protected-echo");
  const call = (options) => handle(request("tools/call", args, options));
  assert.equal((await call({ url: "https://wrong.example/mcp", headers: {
    host: "worker.example", forwarded: "host=worker.example", "x-forwarded-host": "worker.example",
  } })).status, 403);
  assert.equal((await call({ headers: { origin: "https://wrong.example" } })).status, 403);
  assert.equal((await call({ headers: { "content-length": "1025" } })).status, 413);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(600));
      controller.enqueue(new Uint8Array(600));
      controller.close();
    },
  });
  assert.equal((await call({ body: stream, duplex: "half" })).status, 413);
  const legacyBatch = JSON.stringify([
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: args },
  ]);
  const batch = await handle(new Request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: legacyBatch,
  }));
  assert.equal(batch.status, 400);
  assert.deepEqual(calls, { public: 0, protected: 0, protectedInput: 0, verifier: 0 });
});

test("Fetch requires verified credentials and scopes without exposing verifier errors", async () => {
  const { handle, calls } = fixture();
  const call = (authorization, headers = {}) => handle(request("tools/call", echo("protected-echo"), {
    headers: { ...(authorization ? { authorization } : {}), ...headers },
  }));
  for (const [authorization, status] of [
    [undefined, 401], ["Bearer invalid", 401], ["Bearer expired", 401],
    ["Bearer wrong-resource", 401], ["Bearer unscoped", 403], ["Bearer unavailable", 500],
    ["Bearer valid, Bearer invalid", 401], ["Bearer valid trailing", 401],
  ]) {
    const response = await call(authorization);
    assert.equal(response.status, status, authorization);
    assert.doesNotMatch(await response.text(), /private-verifier-sentinel/);
  }
  assert.equal(calls.protected, 0);
  assert.equal(calls.protectedInput, 0);
  const authorised = await call("bEaReR  valid", { origin: "https://browser.example", "x-forwarded-user": "unverified-user" });
  assert.deepEqual((await authorised.json()).result.structuredContent, { value: "hello", client: "verified-client" });
  assert.equal(calls.protected, 1);
});

test("protected Fetch discovery filters tools and keeps OAuth metadata public", async () => {
  const { handle, calls } = fixture("protected");
  const metadata = await handle(new Request(new URL("/.well-known/oauth-protected-resource/mcp", endpoint)));
  assert.equal(metadata.status, 200);
  assert.equal((await metadata.json()).resource, endpoint);
  assert.equal((await handle(request("server/discover"))).status, 401);

  const restricted = await handle(request("tools/list", {}, { headers: { authorization: "Bearer unscoped" } }));
  assert.equal(restricted.headers.get("cache-control"), "private, no-store");
  assert.deepEqual((await restricted.json()).result.tools.map(({ name }) => name), ["public-echo"]);
  const denied = await handle(request("tools/call", echo("protected-echo"), {
    headers: { authorization: "Bearer unscoped" },
  }));
  assert.equal((await denied.json()).error.code, -32602);
  assert.equal(calls.protected, 0);
  assert.equal(calls.protectedInput, 0);
});
