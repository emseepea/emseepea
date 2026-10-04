import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createEmseepea, publishMcpEvent, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const resourceServerUrl = new URL("https://api.example/mcp");
const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "mcp-events-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("events are opt-in and their catalogue requires OAuth", async () => {
  const plain = await serveEmseepea(createEmseepea({ name: "plain", version: "0.0.0" }), { port: 0 });
  try {
    const discovery = await rpc(plain.url, "server/discover");
    assert.equal(discovery.body.result.capabilities.events, undefined);
    const missing = await rpc(plain.url, "events/list");
    assert.equal(missing.body.error.code, -32601);
  } finally {
    await plain.close();
  }

  let verified = 0;
  const rows = new Map();
  const queued = new Map();
  const eventApp = createEmseepea({
    name: "eventful",
    version: "0.0.0",
    cacheHints: { "server/discover": { ttlMs: 10, cacheScope: "private" } },
    authentication: {
      verifier: {
        async verifyAccessToken(token) {
          verified += 1;
          return {
            token,
            clientId: "shared-client",
            scopes: ["events:read"],
            expiresAt: Math.floor(Date.now() / 1_000) + 60,
            resource: resourceServerUrl,
          };
        },
      },
      metadata: {
        resourceServerUrl,
        oauthMetadata: {
          issuer: "https://auth.example",
          authorization_endpoint: "https://auth.example/authorize",
          token_endpoint: "https://auth.example/token",
          response_types_supported: ["code"],
        },
      },
    },
    events: {
      definitions: [{
        name: "comment.created",
        description: "A review comment was added to a document.",
        inputSchema: z.object({ document_id: z.string() }),
        payloadSchema: z.object({ document_id: z.string(), comment_id: z.string() }),
        matches: (arguments_, data) => arguments_.document_id === data.document_id,
      }],
      ownerKey: (auth) => `account:${auth.token}`,
      authorize: async ({ arguments: arguments_ }) => arguments_.document_id !== "forbidden",
      health: async () => true,
      store: {
        async get(id) { return rows.get(id) ?? null; },
        async put(record) { rows.set(record.id, structuredClone(record)); },
        async delete(id) { rows.delete(id); },
        async list(name) { return [...rows.values()].filter((row) => row.name === name); },
        async enqueue(delivery) { queued.set(delivery.id, structuredClone(delivery)); },
        async claimDue() { return []; },
        async complete(id) { queued.delete(id); },
        async reschedule(delivery) { queued.set(delivery.id, structuredClone(delivery)); },
      },
    },
  });
  const eventful = await serveEmseepea(eventApp, { port: 0 });
  try {
    const discovery = await rpc(eventful.url, "server/discover");
    assert.deepEqual(discovery.body.result.capabilities.events, {});
    assert.equal(discovery.body.result.ttlMs, 10);
    assert.equal(verified, 0);

    const unauthenticated = await rpc(eventful.url, "events/list");
    assert.equal(unauthenticated.response.status, 401);
    assert.equal(verified, 0);

    const listed = await rpc(eventful.url, "events/list", {}, "user-a");
    assert.equal(listed.response.status, 200);
    assert.equal(verified, 1);
    assert.deepEqual(listed.body.result.events.map(({ name, delivery }) => ({ name, delivery })), [
      { name: "comment.created", delivery: ["webhook"] },
    ]);
    assert.equal(listed.body.result.events[0].inputSchema.type, "object");

    const invalidCallback = await rpc(eventful.url, "events/subscribe", {
      name: "comment.created",
      arguments: { document_id: "doc-1" },
      delivery: {
        mode: "webhook",
        url: "http://127.0.0.1/private",
        secret: `whsec_${Buffer.alloc(32, 1).toString("base64")}`,
      },
      cursor: null,
    }, "user-a");
    assert.equal(invalidCallback.body.error.code, -32015);
    assert.equal(rows.size, 0);

    const denied = await rpc(eventful.url, "events/subscribe", {
      name: "comment.created",
      arguments: { document_id: "forbidden" },
      delivery: {
        mode: "webhook",
        url: "https://callback.example.com/events",
        secret: `whsec_${Buffer.alloc(32, 1).toString("base64")}`,
      },
      cursor: null,
    }, "user-a");
    assert.equal(denied.body.error.code, -32602);
    assert.equal(rows.size, 0);

    const absent = await rpc(eventful.url, "events/unsubscribe", {
      name: "comment.created",
      arguments: { document_id: "doc-1" },
      delivery: { mode: "webhook", url: "https://callback.example.com/events" },
    }, "user-a");
    assert.deepEqual(absent.body.result, {});

    rows.set("sub-existing", {
      id: "sub-existing", ownerKey: "account:user-a", name: "comment.created",
      arguments: { document_id: "doc-1" }, url: "https://callback.example.com/events",
      secret: `whsec_${Buffer.alloc(32, 1).toString("base64")}`,
      expiresAt: Date.now() + 60_000,
    });
    await publishMcpEvent(eventApp, "comment.created", { document_id: "doc-2", comment_id: "other" });
    assert.equal(queued.size, 0);
    await publishMcpEvent(eventApp, "comment.created", { document_id: "doc-1", comment_id: "matching" });
    assert.equal(queued.size, 1);
    const [delivery] = queued.values();
    assert.equal(JSON.parse(delivery.body).data.comment_id, "matching");
  } finally {
    await eventful.close();
  }
});

async function rpc(url, method, params = {}, token) {
  const headers = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": method,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: randomUUID(),
      method,
      params: { ...params, _meta: requestMeta },
    }),
  });
  return { response, body: await response.json() };
}
