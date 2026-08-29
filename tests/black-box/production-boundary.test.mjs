import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "production-boundary-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("loopback remains the fail-closed default", async () => {
  const app = createEmseepea({ name: "loopback-test", version: "0.0.0" });
  await assert.rejects(
    serveEmseepea(app, { host: "0.0.0.0", port: 0 }),
    /cannot bind publicly/,
  );
  await app.close();
});

test("the trusted-proxy profile rejects forwarding mistakes before tool execution", async () => {
  let calls = 0;
  const app = productionApp(() => { calls += 1; }, { maxRequests: 10, windowMs: 1_000, maxClients: 10 });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const health = await fetch(new URL("/healthz", running.url));
    assert.equal(health.status, 200);
    assert.equal(await health.text(), "ok\n");
    const readiness = await fetch(new URL("/readyz", running.url));
    assert.equal(readiness.status, 200);
    assert.equal(await readiness.text(), "ready\n");

    assert.equal((await call(running.url, {})).status, 403);
    assert.equal((await call(running.url, { "X-Forwarded-Proto": "http", "X-Forwarded-For": "192.0.2.1" })).status, 403);
    assert.equal((await call(running.url, { "X-Forwarded-Proto": "https", "X-Forwarded-For": "192.0.2.1, 192.0.2.2" })).status, 403);
    assert.equal((await call(running.url, validHeaders({ "X-Forwarded-Proto": ["https", "https"] }))).status, 403);
    assert.equal((await call(running.url, validHeaders({ "X-Forwarded-For": "not-an-ip" }))).status, 403);
    assert.equal((await call(running.url, validHeaders({ Host: "api.example:8443" }))).status, 403);
    assert.equal((await call(running.url, validHeaders({ Origin: "https://attacker.example" }))).status, 403);
    assert.equal(calls, 0);

    const accepted = await call(running.url, validHeaders());
    assert.equal(accepted.status, 200);
    assert.equal(calls, 1);
  } finally {
    await running.close();
  }
});

test("an untrusted socket peer is rejected before tool execution", async () => {
  let calls = 0;
  const app = productionApp(
    () => { calls += 1; },
    { maxRequests: 10, windowMs: 1_000, maxClients: 10 },
    ["192.0.2.200"],
  );
  const running = await serveEmseepea(app, { port: 0 });
  try {
    assert.equal((await call(running.url, validHeaders())).status, 403);
    assert.equal(calls, 0);
  } finally {
    await running.close();
  }
});

test("the anonymous limiter bounds request rate and client state", async () => {
  let calls = 0;
  const app = productionApp(() => { calls += 1; }, { maxRequests: 1, windowMs: 1_000, maxClients: 1 });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    assert.equal((await call(running.url, validHeaders())).status, 200);
    assert.equal((await call(running.url, validHeaders())).status, 429);
    assert.equal((await call(running.url, validHeaders({ "X-Forwarded-For": "192.0.2.2" }))).status, 503);
    assert.equal(calls, 1);

    await new Promise((resolve) => setTimeout(resolve, 1_050));
    assert.equal((await call(running.url, validHeaders())).status, 200);
    assert.equal(calls, 2);
  } finally {
    await running.close();
  }
});

test("invalid production configuration fails before listening", async () => {
  assert.throws(() => createEmseepea({
    name: "invalid-production-test",
    version: "0.0.0",
    deployment: {
      mode: "production-behind-proxy",
      allowedAuthorities: ["api.example"],
      allowedOrigins: ["https://api.example"],
      trustedProxyAddresses: ["10.0.0.0/8"],
      rateLimit: { maxRequests: 1, windowMs: 1_000, maxClients: 1 },
    },
  }), /Invalid trusted proxy IP address/);
});

function productionApp(onCall, rateLimit, trustedProxyAddresses = ["::ffff:127.0.0.1"]) {
  const tool = defineTool({
    name: "synthetic-read",
    access: "public",
    description: "Return a synthetic value.",
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.object({ id: z.string() }),
    handler: ({ id }) => {
      onCall();
      return { text: id, data: { id } };
    },
  });
  return createEmseepea({
    name: "production-test",
    version: "0.0.0",
    tools: [tool],
    deployment: {
      mode: "production-behind-proxy",
      allowedAuthorities: ["API.EXAMPLE:443"],
      allowedOrigins: ["https://api.example"],
      trustedProxyAddresses,
      rateLimit,
    },
  });
}

function validHeaders(overrides = {}) {
  return {
    Host: "api.example",
    Origin: "https://api.example",
    "X-Forwarded-Proto": "https",
    "X-Forwarded-For": "192.0.2.1",
    ...overrides,
  };
}

async function call(url, extraHeaders) {
  const method = "tools/call";
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method,
    params: { name: "synthetic-read", arguments: { id: "value" }, _meta: meta },
  });
  return new Promise((resolve, reject) => {
    const outgoing = request(url, {
      method: "POST",
      headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      "Mcp-Name": "synthetic-read",
      ...extraHeaders,
    },
    }, (incoming) => {
      incoming.resume();
      incoming.on("end", () => resolve({ status: incoming.statusCode }));
    });
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}
