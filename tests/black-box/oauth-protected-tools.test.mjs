import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "oauth-black-box", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};
const resourceServerUrl = new URL("https://api.example/mcp");

test("protected tools fail startup without OAuth resource-server configuration", () => {
  const tool = protectedTool(() => {});
  assert.throws(
    () => createEmseepea({ name: "missing-oauth", version: "0.0.0", tools: [tool] }),
    /Protected tools require OAuth/,
  );
});

test("invalid OAuth metadata and verification limits fail before listening", () => {
  const tool = protectedTool(() => {});
  const verifier = { verifyAccessToken: async () => assert.fail("must not verify") };
  const options = (resourceServerUrl, issuer = "https://auth.example") => ({
    name: "invalid-oauth",
    version: "0.0.0",
    tools: [tool],
    oauth: {
      verifier,
      metadata: {
        resourceServerUrl: new URL(resourceServerUrl),
        oauthMetadata: {
          issuer,
          authorization_endpoint: "https://auth.example/authorize",
          token_endpoint: "https://auth.example/token",
          response_types_supported: ["code"],
        },
      },
    },
  });
  assert.throws(() => createEmseepea(options("http://api.example/mcp")), /must be HTTPS/);
  assert.throws(() => createEmseepea(options("https://api.example/mcp#fragment")), /must be HTTPS/);
  assert.throws(() => createEmseepea(options("https://api.example/mcp", "http://auth.example")), /Issuer URL must be HTTPS/);
  const insecureIssuer = options("https://api.example/mcp", "http://auth.example");
  insecureIssuer.oauth.metadata.dangerouslyAllowInsecureIssuerUrl = true;
  assert.throws(() => createEmseepea(insecureIssuer), /Insecure OAuth issuer URLs are not supported/);
  assert.throws(() => createEmseepea({
    ...options("https://api.example/mcp"),
    oauth: { ...options("https://api.example/mcp").oauth, verificationTimeoutMs: 0 },
  }), /positive safe integer/);
});

test("discovery stays public while protected invocation is fail-closed", async () => {
  let verifierCalls = 0;
  let protectedCalls = 0;
  let publicCalls = 0;
  let observedPrincipal;

  const verifier = {
    async verifyAccessToken(token) {
      verifierCalls += 1;
      if (token === "invalid" || token === "secret-bearer-sentinel") {
        throw new OAuthError(OAuthErrorCode.InvalidToken, `Provider echoed ${token}`);
      }
      if (token === "slow") return new Promise(() => {});
      return {
        token,
        clientId: "synthetic-client",
        scopes: token === "wrong-scope" ? ["other:read"] : ["beans:read"],
        expiresAt: token === "expired" ? 1 : Math.floor(Date.now() / 1_000) + 60,
        resource: new URL(token === "wrong-resource" ? "https://other.example/mcp" : resourceServerUrl),
      };
    },
  };
  const protectedBean = protectedTool((principal) => {
    protectedCalls += 1;
    observedPrincipal = principal;
  });
  const publicBean = defineTool({
    name: "public-bean",
    access: "public",
    description: "Return a public synthetic bean.",
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.object({ id: z.string() }),
    handler: ({ id }, { principal }) => {
      publicCalls += 1;
      assert.equal(principal, undefined);
      return { text: id, data: { id } };
    },
  });
  const app = createEmseepea({
    name: "oauth-test",
    version: "0.0.0",
    tools: [publicBean, protectedBean],
    oauth: {
      verifier,
      verificationTimeoutMs: 20,
      metadata: {
        resourceServerUrl,
        resourceName: "Synthetic bean server",
        scopesSupported: ["beans:read"],
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
    const resourceMetadata = await fetch(new URL(
      "/.well-known/oauth-protected-resource/mcp",
      running.url,
    ));
    assert.equal(resourceMetadata.status, 200);
    assert.equal(resourceMetadata.headers.get("access-control-allow-origin"), "*");
    assert.deepEqual(await resourceMetadata.json(), {
      resource: resourceServerUrl.href,
      authorization_servers: ["https://auth.example"],
      scopes_supported: ["beans:read"],
      resource_name: "Synthetic bean server",
    });
    const authorizationMetadata = await fetch(new URL(
      "/.well-known/oauth-authorization-server",
      running.url,
    ));
    assert.equal(authorizationMetadata.status, 200);
    assert.equal((await authorizationMetadata.json()).issuer, "https://auth.example");
    assert.equal(verifierCalls, 0);

    const discover = await rpc(running.url, "server/discover", {}, "invalid");
    assert.equal(discover.response.status, 200);
    const list = await rpc(running.url, "tools/list", {}, "invalid");
    assert.equal(list.response.status, 200);
    const listedProtected = list.body.result.tools.find(({ name }) => name === "protected-bean");
    assert.deepEqual(listedProtected._meta["io.emseepea/access"], {
      type: "protected",
      requiredScopes: ["beans:read"],
    });
    assert.equal(verifierCalls, 0);

    const publicCall = await rpc(
      running.url,
      "tools/call",
      { name: "public-bean", arguments: { id: "public" } },
      "invalid",
    );
    assert.equal(publicCall.response.status, 200);
    assert.equal(publicCalls, 1);
    assert.equal(verifierCalls, 0);

    const unknown = await rpc(
      running.url,
      "tools/call",
      { name: "unknown-bean", arguments: { id: "unknown" } },
      "invalid",
    );
    assert.equal(unknown.response.status, 200);
    assert.equal(unknown.body.error.code, -32602);
    assert.equal(verifierCalls, 0);

    for (const headers of [
      { "MCP-Protocol-Version": undefined },
      { "MCP-Protocol-Version": "2025-11-25" },
      { "Mcp-Method": undefined },
      { "Mcp-Method": "tools/list" },
      { "Mcp-Name": undefined },
      { "Mcp-Name": "different-tool" },
    ]) {
      const malformedProtected = await rpc(
        running.url,
        "tools/call",
        { name: "protected-bean", arguments: { id: "bad-routing-header" } },
        "valid",
        headers,
      );
      assert.equal(malformedProtected.response.status, 400);
      assert.equal(malformedProtected.body.error.code, -32020);
      assert.equal(verifierCalls, 0);
      assert.equal(protectedCalls, 0);
    }

    const missingBodyVersion = { ...requestMeta };
    delete missingBodyVersion["io.modelcontextprotocol/protocolVersion"];
    const malformedBodyMetadata = await rpc(
      running.url,
      "tools/call",
      { name: "protected-bean", arguments: { id: "missing-body-version" } },
      "valid",
      {},
      missingBodyVersion,
    );
    assert.equal(malformedBodyMetadata.response.status, 400);
    assert.equal(malformedBodyMetadata.body.error.code, -32020);
    assert.equal(verifierCalls, 0);
    assert.equal(protectedCalls, 0);

    const missing = await rpc(
      running.url,
      "tools/call",
      { name: "protected-bean", arguments: { id: "missing" } },
    );
    assert.equal(missing.response.status, 401);
    assert.match(
      missing.response.headers.get("www-authenticate"),
      /resource_metadata="https:\/\/api\.example\/\.well-known\/oauth-protected-resource\/mcp"/,
    );
    assert.equal(protectedCalls, 0);

    const invalid = await protectedCall(running.url, "invalid");
    assert.equal(invalid.response.status, 401);
    assert.equal(protectedCalls, 0);

    const secret = await protectedCall(running.url, "secret-bearer-sentinel");
    assert.equal(secret.response.status, 401);
    assert.doesNotMatch(JSON.stringify(secret.body), /secret-bearer-sentinel/);
    assert.doesNotMatch(JSON.stringify([...secret.response.headers]), /secret-bearer-sentinel/);
    assert.equal(protectedCalls, 0);

    const expired = await protectedCall(running.url, "expired");
    assert.equal(expired.response.status, 401);
    assert.equal(protectedCalls, 0);

    const wrongScope = await protectedCall(running.url, "wrong-scope");
    assert.equal(wrongScope.response.status, 403);
    assert.match(wrongScope.response.headers.get("www-authenticate"), /scope="beans:read"/);
    assert.equal(protectedCalls, 0);

    const wrongResource = await protectedCall(running.url, "wrong-resource");
    assert.equal(wrongResource.response.status, 401);
    assert.equal(protectedCalls, 0);

    const timedOut = await protectedCall(running.url, "slow");
    assert.equal(timedOut.response.status, 500);
    assert.equal(protectedCalls, 0);

    const valid = await protectedCall(running.url, "valid");
    assert.equal(valid.response.status, 200);
    assert.equal(valid.body.result.content[0].text, "protected");
    assert.equal(protectedCalls, 1);
    assert.doesNotMatch(JSON.stringify(valid.body), /valid/);
    assert.deepEqual(observedPrincipal, {
      clientId: "synthetic-client",
      scopes: ["beans:read"],
      resource: resourceServerUrl.href,
    });
    assert.doesNotMatch(JSON.stringify(observedPrincipal), /valid/);
  } finally {
    await running.close();
  }
});

test("protected example lists anonymously and requires the synthetic bearer token", async () => {
  const running = await startProtectedExample();
  try {
    const list = await rpc(running.url, "tools/list");
    assert.equal(list.response.status, 200);
    const tool = list.body.result.tools.find(
      ({ name }) => name === "get-private-inventory-report",
    );
    assert.deepEqual(tool._meta["io.emseepea/access"], {
      type: "protected",
      requiredScopes: ["inventory:read"],
    });
    assert.doesNotMatch(JSON.stringify(list.body), /example-access-token|120 on hand/);

    const params = { name: "get-private-inventory-report", arguments: {} };
    assert.equal((await rpc(running.url, "tools/call", params)).response.status, 401);
    assert.equal((await rpc(running.url, "tools/call", params, "invalid")).response.status, 401);
    assert.equal(
      (await rpc(running.url, "tools/call", params, "example-wrong-scope")).response.status,
      403,
    );

    const valid = await rpc(running.url, "tools/call", params, "example-access-token");
    assert.equal(valid.response.status, 200);
    assert.deepEqual(valid.body.result.structuredContent, {
      item: "Green coffee bags",
      onHandBags: 120,
      reservedBags: 35,
      availableToPromiseBags: 85,
      inboundBags: 40,
      inboundAvailableToPromise: false,
    });
    assert.doesNotMatch(JSON.stringify(valid.body), /example-access-token/);
  } finally {
    await running.close();
  }
});

function protectedTool(onCall) {
  return defineTool({
    name: "protected-bean",
    access: "protected",
    requiredScopes: ["beans:read"],
    description: "Return a protected synthetic bean.",
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.object({ id: z.string() }),
    handler: ({ id }, { principal }) => {
      onCall(principal);
      return { text: "protected", data: { id } };
    },
  });
}

function protectedCall(url, token) {
  return rpc(
    url,
    "tools/call",
    { name: "protected-bean", arguments: { id: "protected-request" } },
    token,
  );
}

async function rpc(url, method, params = {}, token, extraHeaders = {}, meta = requestMeta) {
  const headers = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": method,
    ...(method === "tools/call" ? { "Mcp-Name": params.name } : {}),
    ...extraHeaders,
  };
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) delete headers[name];
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: { ...params, _meta: meta },
    }),
  });
  return { response, body: await response.json() };
}

async function startProtectedExample() {
  const child = spawn(process.execPath, ["examples/protected-no-ui/dist/server.js"], {
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const url = await new Promise((resolveUrl, rejectUrl) => {
    const timeout = setTimeout(() => rejectUrl(new Error("protected example startup timed out")), 10_000);
    const inspect = () => {
      const match = stdout.match(/http:\/\/127\.0\.0\.1:\d+\/mcp/);
      if (!match) return;
      clearTimeout(timeout);
      resolveUrl(match[0]);
    };
    child.stdout.on("data", inspect);
    child.once("error", rejectUrl);
    child.once("exit", (code) => rejectUrl(new Error(`protected example exited ${code}: ${stderr}`)));
    inspect();
  });
  return {
    url,
    async close() {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolveClose) => child.once("close", resolveClose));
    },
  };
}
