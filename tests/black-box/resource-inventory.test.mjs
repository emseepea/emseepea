import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { OAuthError, OAuthErrorCode, ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { createEmseepea, defineResource, defineResourceTemplate, serveEmseepea } from "@emseepea/server";

const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "inventory-check", version: "1" },
  "io.modelcontextprotocol/clientCapabilities": {},
};
const resource = new URL("https://inventory.example/mcp");
function fixture(options = {}) {
  const rows = new Map(["alice", "bob"].map((owner) => [owner, ["10", "20", "30", "40", "50"].map((key) => ({
    key, resource: { uri: `learn://documents/${owner}-${key}`, name: `${owner} ${key}`, mimeType: "text/plain" },
  }))]));
  const calls = [];
  const blocked = new Set();
  const tokens = new Map([
    ["alice", { subject: "alice", scopes: ["documents:read"] }],
    ["bob", { subject: "bob", scopes: ["documents:read"] }],
    ["denied", { subject: "alice", scopes: [] }],
    ["broader", { subject: "alice", scopes: ["documents:read", "other:read"] }],
  ]);
  const list = (input, context) => {
    calls.push({ input, context });
    if (options.list) return options.list(input, context);
    const eligible = rows.get(context.principal.subject).filter((row) => !blocked.has(row.resource.uri) && (input.after === undefined || row.key > input.after));
    return { entries: eligible.slice(0, input.limit), hasMore: eligible.length > input.limit };
  };
  const template = defineResourceTemplate({
    name: "learner-documents", uriTemplate: "learn://documents/{id}",
    access: "protected", requiredScopes: ["documents:read"], list,
    handler: ({ uri }, context) => {
      const row = rows.get(context.principal.subject)?.find((item) => item.resource.uri === uri);
      if (!row || blocked.has(uri)) throw new Error("Unavailable");
      return { contents: [{ uri, text: `Document for ${context.principal.subject}`, mimeType: "text/plain" }] };
    },
  });
  const app = createEmseepea({
    name: "private-inventory", version: "1", operationTimeoutMs: options.timeout ?? 1000,
    resources: [template, ...(options.resources ?? [])],
    listPagination: { pageSize: options.pageSize ?? 2, maxPageBytes: options.bytes ?? 4096 },
    ...(options.cacheHints ? { cacheHints: options.cacheHints } : {}),
    authentication: {
      discovery: options.discovery ?? "public",
      verifier: { async verifyAccessToken(token) {
        const info = tokens.get(token);
        if (!info) throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid");
        return { token, clientId: "shared-client", scopes: [...info.scopes],
          resource, expiresAt: Math.floor(Date.now() / 1000) + 60,
          extra: { subject: info.subject, secret: "never-forward", rawClaims: { token } } };
      } },
      metadata: { resourceServerUrl: resource, oauthMetadata: {
        issuer: "https://auth.example", authorization_endpoint: "https://auth.example/authorize",
        token_endpoint: "https://auth.example/token", response_types_supported: ["code"],
      } },
    },
  });
  return { app, rows, calls, tokens, blocked };
}
async function rpc(url, method, params = {}, token) {
  const response = await fetch(url, { method: "POST", headers: {
    "content-type": "application/json", accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": "2026-07-28", "MCP-Method": method,
    ...(method === "resources/read" ? { "MCP-Name": params.uri } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { ...params, _meta: meta } }) });
  return { response, body: await response.json() };
}
async function connect(url, token) {
  const client = new Client({ name: "inventory-client", version: "1" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } });
  await client.connect(new StreamableHTTPClientTransport(url, { authProvider: { token: async () => token } }));
  return client;
}
const entries = (page) => page.body.result.resources;

test("inventory rejects public, suppressed, malformed, and unauthenticated startup configurations", () => {
  const definition = { name: "docs", uriTemplate: "learn://documents/{id}",
    list: () => ({ entries: [], hasMore: false }), handler: () => ({ contents: [] }) };
  assert.throws(() => defineResourceTemplate({ ...definition, access: "public" }), /protected template/);
  assert.throws(() => defineResourceTemplate({ ...definition, access: "protected", requiredScopes: ["read"], discoverable: false }), /discoverable protected/);
  assert.throws(() => defineResourceTemplate({ ...definition, access: "protected", requiredScopes: ["read"], list: 1 }), /callback/);
  const template = defineResourceTemplate({ ...definition, access: "protected", requiredScopes: ["read"] });
  assert.throws(() => createEmseepea({ name: "test", version: "1", resources: [template] }), /authentication/);
});

test("real MCP clients enumerate and read only their own inventory through a shared OAuth client", async () => {
  const f = fixture(); const running = await serveEmseepea(f.app, { port: 0 });
  const alice = await connect(running.url, "alice"); const bob = await connect(running.url, "bob");
  try {
    assert.equal(alice.getServerCapabilities().resources.listChanged, false);
    assert.equal((await rpc(running.url, "resources/templates/list")).response.status, 200);
    assert.equal((await alice.listResourceTemplates()).resourceTemplates.length, 1);
    const aliceRows = (await alice.listResources()).resources;
    const bobRows = (await bob.listResources()).resources;
    assert.deepEqual(aliceRows, f.rows.get("alice").map((row) => row.resource));
    assert.deepEqual(bobRows, f.rows.get("bob").map((row) => row.resource));
    assert.match((await alice.readResource({ uri: aliceRows[0].uri })).contents[0].text, /alice/);
    await assert.rejects(bob.readResource({ uri: aliceRows[0].uri }));
    assert.ok(f.calls.every(({ input }) => input.limit <= 2));
    assert.ok(f.calls.every(({ context }) => Object.isFrozen(context) && Object.isFrozen(context.principal)));
    assert.deepEqual(Object.keys(f.calls[0].context.principal).sort(), ["clientId", "permissions", "resource", "subject"]);
    assert.equal(JSON.stringify(f.calls.map(({ context }) => context.principal)).includes("never-forward"), false);
  } finally { await Promise.all([alice.close(), bob.close()]); await running.close(); }
});

test("listing authenticates before backend work, rechecks permissions, and disables shared caching", async () => {
  const f = fixture({ cacheHints: { "resources/list": { ttlMs: 60000, cacheScope: "public" } } });
  const running = await serveEmseepea(f.app, { port: 0 });
  try {
    for (const token of [undefined, "invalid", "denied"]) {
      const page = await rpc(running.url, "resources/list", {}, token);
      assert.equal(page.response.status, token === "denied" ? 403 : 401);
      assert.equal(f.calls.length, 0);
    }
    f.tokens.set("malformed", { subject: { token: "raw" }, scopes: ["documents:read"] });
    assert.equal((await rpc(running.url, "resources/list", {}, "malformed")).response.status, 500);
    assert.equal(f.calls.length, 0);
    const first = await rpc(running.url, "resources/list", {}, "alice");
    assert.equal(first.response.headers.get("cache-control"), "private, no-store");
    assert.equal(first.body.result.ttlMs, 0); assert.equal(first.body.result.cacheScope, "private");
    assert.equal(entries(first).length, 2);
    f.tokens.get("alice").scopes = [];
    assert.equal((await rpc(running.url, "resources/list", { cursor: first.body.result.nextCursor }, "alice")).response.status, 403);
    assert.equal(f.calls.length, 1);
    assert.equal((await rpc(running.url, "resources/read", { uri: entries(first)[0].uri }, "alice")).response.status, 403);
  } finally { await running.close(); }
});

test("cursors reject different subjects, permissions, instances, tampering, and noncanonical encodings before callbacks", async () => {
  const f = fixture(); const running = await serveEmseepea(f.app, { port: 0 });
  const other = await serveEmseepea(fixture().app, { port: 0 });
  try {
    const first = await rpc(running.url, "resources/list", {}, "alice");
    const cursor = first.body.result.nextCursor;
    assert.equal(Buffer.from(cursor, "base64url").toString().includes("alice"), false);
    for (const [url, value, token] of [[running.url, cursor, "bob"], [running.url, cursor, "broader"],
      [other.url, cursor, "alice"], [running.url, "x" + cursor, "alice"],
      [running.url, cursor + "=", "alice"], [running.url, "x".repeat(2000), "alice"]]) {
      const page = await rpc(url, "resources/list", { cursor: value }, token);
      assert.equal(page.body.error.code, -32602);
    }
    assert.equal(f.calls.length, 1);
    const second = await rpc(running.url, "resources/list", { cursor }, "alice");
    assert.deepEqual(entries(second).map(({ name }) => name), ["alice 30", "alice 40"]);
    const replay = await rpc(running.url, "resources/list", { cursor }, "alice");
    assert.deepEqual(entries(replay), entries(second));
  } finally { await Promise.all([running.close(), other.close()]); }
});

test("traversal expires fifteen minutes after its first page and advancing does not renew it", async (t) => {
  const f = fixture(); const running = await serveEmseepea(f.app, { port: 0 });
  let now = Date.now(); t.mock.method(Date, "now", () => now);
  try {
    const first = await rpc(running.url, "resources/list", {}, "alice");
    now += 14 * 60 * 1000;
    const second = await rpc(running.url, "resources/list", { cursor: first.body.result.nextCursor }, "alice");
    assert.equal(entries(second).length, 2);
    now += 60 * 1000;
    const expired = await rpc(running.url, "resources/list", { cursor: second.body.result.nextCursor }, "alice");
    assert.equal(expired.body.error.code, -32602); assert.equal(f.calls.length, 2);
    assert.equal(entries(await rpc(running.url, "resources/list", {}, "alice")).length, 2);
  } finally { t.mock.restoreAll(); await running.close(); }
});

test("live pages reflect concurrent insertions and deletions without granting later reads", async () => {
  const f = fixture(); const running = await serveEmseepea(f.app, { port: 0 });
  try {
    const first = await rpc(running.url, "resources/list", {}, "alice");
    const make = (key) => ({ key, resource: { uri: `learn://documents/alice-${key}`, name: `alice ${key}`, mimeType: "text/plain" } });
    f.rows.set("alice", [make("05"), make("25"), ...f.rows.get("alice").filter(({ key }) => key !== "10" && key !== "30")]);
    f.rows.get("alice").sort((a, b) => a.key < b.key ? -1 : 1);
    const second = await rpc(running.url, "resources/list", { cursor: first.body.result.nextCursor }, "alice");
    assert.deepEqual(entries(second).map(({ name }) => name), ["alice 25", "alice 40"]);
    const third = await rpc(running.url, "resources/list", { cursor: second.body.result.nextCursor }, "alice");
    assert.deepEqual(entries(third).map(({ name }) => name), ["alice 50"]);
    assert.equal(third.body.result.nextCursor, undefined);
    assert.ok((await rpc(running.url, "resources/read", { uri: entries(first)[0].uri }, "alice")).body.error);
  } finally { await running.close(); }
});

test("record-level revocation removes live metadata and denies reads without deleting stored records", async () => {
  const f = fixture(); const running = await serveEmseepea(f.app, { port: 0 });
  try {
    const first = await rpc(running.url, "resources/list", {}, "alice");
    f.blocked.add(entries(first)[0].uri);
    f.blocked.add("learn://documents/alice-30");
    f.blocked.add("learn://documents/alice-40");
    const second = await rpc(running.url, "resources/list", { cursor: first.body.result.nextCursor }, "alice");
    assert.deepEqual(entries(second).map(({ name }) => name), ["alice 50"]);
    assert.equal(second.body.result.nextCursor, undefined);
    assert.equal(f.rows.get("alice").length, 5);
    assert.ok((await rpc(running.url, "resources/read", { uri: entries(first)[0].uri }, "alice")).body.error);
  } finally { await running.close(); }
});

test("multiple sources and static resources share count and byte limits and exclude inaccessible sources", async () => {
  let extraCalls = 0;
  const extra = defineResourceTemplate({ name: "extra", uriTemplate: "learn://extra/{id}",
    access: "protected", requiredScopes: ["extra:read"],
    list: () => { extraCalls++; return { entries: [], hasMore: false }; }, handler: () => ({ contents: [] }) });
  const staticResource = defineResource({ name: "guide", uri: "learn://guide/start", access: "public",
    handler: () => ({ contents: [] }) });
  const f = fixture({ pageSize: 3, bytes: 380, resources: [staticResource, extra] });
  const running = await serveEmseepea(f.app, { port: 0 });
  try {
    const all = []; let cursor;
    do {
      const page = await rpc(running.url, "resources/list", cursor ? { cursor } : {}, "alice");
      assert.ok(Buffer.byteLength(JSON.stringify(page.body.result)) <= 380, JSON.stringify(page.body.result));
      assert.ok(entries(page).length <= 3); all.push(...entries(page)); cursor = page.body.result.nextCursor;
    } while (cursor);
    assert.equal(all.length, 6); assert.equal(new Set(all.map(({ uri }) => uri)).size, 6);
    assert.equal(extraCalls, 0);
    f.tokens.get("alice").scopes.push("extra:read");
    await rpc(running.url, "resources/list", {}, "alice");
    let current;
    do { const page = await rpc(running.url, "resources/list", current ? { cursor: current } : {}, "alice"); current = page.body.result.nextCursor; } while (current);
    assert.equal(extraCalls, 1);
  } finally { await running.close(); }
});

test("invalid backend pages fail safely without emitting metadata or backend details", async () => {
  const valid = { key: "10", resource: { uri: "learn://documents/alice-10", name: "Alice", mimeType: "text/plain" } };
  for (const result of [
    { entries: [], hasMore: true }, { entries: [valid, valid], hasMore: false },
    { entries: [valid, { ...valid, key: "09" }], hasMore: false },
    { entries: [{ ...valid, resource: { ...valid.resource, uri: "learn://other/10" } }], hasMore: false },
    { entries: [{ ...valid, resource: { ...valid.resource, text: "private" } }], hasMore: false },
    { entries: [valid, { ...valid, key: "20" }, { ...valid, key: "30" }], hasMore: false },
    { entries: [{ ...valid, resource: { ...valid.resource, name: "x".repeat(5000) } }], hasMore: false },
  ]) {
    const f = fixture({ list: () => result }); const running = await serveEmseepea(f.app, { port: 0 });
    try {
      const page = await rpc(running.url, "resources/list", {}, "alice");
      assert.equal(page.body.error.code, -32603);
      assert.equal(JSON.stringify(page.body).includes("private"), false);
      assert.equal(page.body.error.message, "Resource inventory listing failed");
    } finally { await running.close(); }
  }
});

test("listing deadlines abort the callback and suppress its late result", async () => {
  let signal;
  const f = fixture({ timeout: 40, list: async (_input, context) => {
    signal = context.signal; await new Promise((resolve) => setTimeout(resolve, 100));
    return { entries: [], hasMore: false };
  } });
  const running = await serveEmseepea(f.app, { port: 0 });
  try {
    const page = await rpc(running.url, "resources/list", {}, "alice");
    assert.equal(page.body.error.code, -32603); assert.equal(signal.aborted, true);
  } finally { await running.close(); }
});

test("protected discovery and legacy listing preserve inventory authentication", async () => {
  const f = fixture({ discovery: "protected" }); const running = await serveEmseepea(f.app, { port: 0 });
  try {
    assert.equal((await rpc(running.url, "resources/templates/list")).response.status, 401);
    assert.equal((await rpc(running.url, "resources/templates/list", {}, "denied")).body.error.code, -32601);
    const client = await connect(running.url, "alice");
    try { assert.equal((await client.listResources()).resources.length, 5); }
    finally { await client.close(); }
    const legacy = async (token) => {
      const response = await fetch(running.url, { method: "POST", headers: {
        "content-type": "application/json", accept: "application/json, text/event-stream",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "resources/list", params: {} }) });
      const text = await response.text();
      return { response, body: JSON.parse(text.startsWith("event:") ? text.split("\n").find((line) => line.startsWith("data:")).slice(5).trim() : text) };
    };
    assert.equal((await legacy()).response.status, 401);
    assert.equal((await legacy("alice")).body.result.resources.length, 2);
  } finally { await running.close(); }
});

test("backend protocol errors cannot expose private error details", async () => {
  for (const error of [new Error("private backend query"), new ProtocolError(ProtocolErrorCode.InvalidParams, "private backend query")]) {
    const f = fixture({ list: () => { throw error; } }); const running = await serveEmseepea(f.app, { port: 0 });
    try {
      const page = await rpc(running.url, "resources/list", {}, "alice");
      assert.equal(page.body.error.code, -32603);
      assert.equal(page.body.error.message, "Resource inventory listing failed");
      assert.equal(JSON.stringify(page.body).includes("private backend query"), false);
    } finally { await running.close(); }
  }
});
