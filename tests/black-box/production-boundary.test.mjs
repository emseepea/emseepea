import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { createEmseepea, defineTool, serveEmseepea, structuredLogging } from "@emseepea/server";
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

test("the trusted-proxy boundary also precedes legacy execution", async () => {
  let calls = 0;
  const app = productionApp(() => { calls += 1; }, { maxRequests: 10, windowMs: 1_000, maxClients: 10 });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    assert.equal((await legacyCall(running.url, {})).status, 403);
    assert.equal((await legacyCall(
      running.url,
      validHeaders({ Origin: "https://attacker.example" }),
    )).status, 403);
    assert.equal(calls, 0);
    assert.equal((await legacyCall(running.url, validHeaders())).status, 200);
    assert.equal(calls, 1);
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

// ADR-0102, as amended: a deployment behind an ingress the platform already
// restricts has no stable peer address to enumerate. It proves the request
// came through the proxy instead, with a secret the proxy injects. Getting it
// wrong refuses every request rather than accepting every request.

const SECRET = "s3cret-value-at-least-32-chars-long!!";

test("the proxy boundary is declared exactly one way", () => {
  assert.throws(
    () => boundaryApp({}),
    /exactly one of trustedProxyAddresses or proxyBoundary/,
  );
  assert.throws(
    () => boundaryApp({ trustedProxyAddresses: ["192.0.2.200"], proxyBoundary: { header: "x-proxy-token", secret: SECRET } }),
    /exactly one of trustedProxyAddresses or proxyBoundary/,
  );
});

test("a proxy secret too short to be a secret is refused at construction", () => {
  assert.throws(
    () => boundaryApp({ proxyBoundary: { header: "x-proxy-token", secret: "short" } }),
    /proxyBoundary.secret must be at least 32 characters/,
  );
  // A forwarding header cannot carry the proof: the caller controls what
  // arrives in those, and the proxy overwrites them for its own purposes.
  assert.throws(
    () => boundaryApp({ proxyBoundary: { header: "x-forwarded-for", secret: SECRET } }),
    /proxyBoundary.header must not be a forwarding header/,
  );
  assert.throws(
    () => boundaryApp({ proxyBoundary: { header: "not a header", secret: SECRET } }),
    /proxyBoundary.header/,
  );
  // A header value arrives decoded as latin1 while a JS string hashes as
  // UTF-8, so a non-ASCII secret could never match. Refusing it at
  // construction beats refusing every request with no way to tell why.
  for (const secret of [
    `${SECRET}\u00e9`,
    ` ${SECRET}`,
    `${SECRET} `,
    `${SECRET}\u0000`,
  ]) {
    assert.throws(
      () => boundaryApp({ proxyBoundary: { header: "x-proxy-token", secret } }),
      /proxyBoundary.secret must be printable ASCII with no surrounding spaces/,
      `expected refusal for ${JSON.stringify(secret)}`,
    );
  }
});

test("a verified proxy secret admits any peer and keeps every other check", async () => {
  let calls = 0;
  const app = boundaryApp(
    { proxyBoundary: { header: "X-Proxy-Token", secret: SECRET } },
    () => { calls += 1; },
    { maxRequests: 1, windowMs: 60_000, maxClients: 10 },
  );
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const proven = (overrides = {}) => validHeaders({ "X-Proxy-Token": SECRET, ...overrides });

    // The peer is this test's own socket, which no allowlist names.
    assert.equal((await call(running.url, proven())).status, 200);
    assert.equal(calls, 1);

    // Proving the hop skips the address check and nothing else.
    assert.equal((await call(running.url, proven({ Host: "attacker.example" }))).status, 403);
    assert.equal((await call(running.url, proven({ Origin: "https://attacker.example" }))).status, 403);
    assert.equal((await call(running.url, proven({ "X-Forwarded-Proto": "http" }))).status, 403);
    assert.equal((await call(running.url, proven({ "X-Forwarded-For": "192.0.2.1, 192.0.2.2" }))).status, 403);
    assert.equal(calls, 1);

    assert.equal((await call(running.url, proven())).status, 429);
    assert.equal((await call(running.url, proven({ "X-Forwarded-For": "192.0.2.77" }))).status, 200);
    assert.equal(calls, 2);
  } finally {
    await running.close();
  }
});

test("a missing or wrong proxy secret refuses every request", async () => {
  let calls = 0;
  const app = boundaryApp({ proxyBoundary: { header: "X-Proxy-Token", secret: SECRET } }, () => { calls += 1; });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    // This is the misconfiguration case: the proxy is not injecting the
    // header. It fails closed, which is the whole point of proving the hop
    // rather than declaring it.
    assert.equal((await call(running.url, validHeaders())).status, 403);
    assert.equal((await call(running.url, validHeaders({ "X-Proxy-Token": "" }))).status, 403);
    assert.equal((await call(running.url, validHeaders({ "X-Proxy-Token": `${SECRET}x` }))).status, 403);
    assert.equal((await call(running.url, validHeaders({ "X-Proxy-Token": SECRET.slice(0, -1) }))).status, 403);
    // A caller who sends the header twice cannot slip a good value past.
    assert.equal((await call(running.url, validHeaders({ "X-Proxy-Token": [SECRET, "wrong"] }))).status, 403);
    assert.equal(calls, 0);

    const refused = await call(running.url, validHeaders({ "X-Proxy-Token": "wrong" }));
    assert.equal(refused.status, 403);
    // The response must not confirm the header name or echo any of the value.
    assert.doesNotMatch(refused.body, /proxy-token/i);
    assert.doesNotMatch(refused.body, /s3cret/i);
  } finally {
    await running.close();
  }
});

test("the proxy secret never reaches an observability adapter", async () => {
  const events = [];
  const app = boundaryApp(
    { proxyBoundary: { header: "X-Proxy-Token", secret: SECRET } },
    () => {},
    { maxRequests: 10, windowMs: 1_000, maxClients: 10 },
    [structuredLogging("capture", (event) => { events.push(event); })],
  );
  const running = await serveEmseepea(app, { port: 0 });
  try {
    await call(running.url, validHeaders({ "X-Proxy-Token": SECRET }));
    await call(running.url, validHeaders({ "X-Proxy-Token": "wrong" }));
  } finally {
    await running.close();
  }
  assert.ok(events.length >= 1);
  const serialized = JSON.stringify(events);
  assert.doesNotMatch(serialized, /s3cret/i);
  assert.doesNotMatch(serialized, /wrong/i);
});

function boundaryApp(boundary, onCall = () => {}, rateLimit = { maxRequests: 10, windowMs: 1_000, maxClients: 10 }, observability) {
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
    ...(observability ? { observability } : {}),
    deployment: {
      mode: "production-behind-proxy",
      allowedAuthorities: ["API.EXAMPLE:443"],
      allowedOrigins: ["https://api.example"],
      ...boundary,
      rateLimit,
    },
  });
}

function productionApp(onCall, rateLimit, trustedProxyAddresses = ["::ffff:127.0.0.1"], forwardedHops, observability) {
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
    ...(observability ? { observability } : {}),
    deployment: {
      mode: "production-behind-proxy",
      allowedAuthorities: ["API.EXAMPLE:443"],
      allowedOrigins: ["https://api.example"],
      trustedProxyAddresses,
      ...(forwardedHops === undefined ? {} : { forwardedHops }),
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
      let received = "";
      incoming.setEncoding("utf8");
      incoming.on("data", (chunk) => { received += chunk; });
      incoming.on("end", () => resolve({ status: incoming.statusCode, body: received }));
    });
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}

async function legacyCall(url, extraHeaders) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: "tools/call",
    params: { name: "synthetic-read", arguments: { id: "legacy-value" } },
  });
  return new Promise((resolve, reject) => {
    const outgoing = request(url, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "MCP-Protocol-Version": "2025-11-25",
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

// A load balancer that appends its own address puts the client second to
// last, so the single-entry rule refuses every request behind one. These
// cover the counted form and, more importantly, that counting from the end
// is what keeps the caller out of the rate-limit key.

test("one appending hop reads the client the balancer saw", async () => {
  let calls = 0;
  const app = productionApp(() => { calls += 1; }, { maxRequests: 10, windowMs: 1_000, maxClients: 10 }, undefined, 1);
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const accepted = await call(running.url, validHeaders({ "X-Forwarded-For": "192.0.2.1, 192.0.2.99" }));
    assert.equal(accepted.status, 200);
    assert.equal(calls, 1);
    // Not enough entries to have come through the hop it was told about.
    assert.equal((await call(running.url, validHeaders({ "X-Forwarded-For": "192.0.2.1" }))).status, 403);
    assert.equal(calls, 1);
  } finally {
    await running.close();
  }
});

test("a caller cannot prepend their way to a fresh rate-limit budget", async () => {
  // The reason this reads from the end rather than the start. A caller can
  // put anything in front of the header; only what the balancer appended,
  // and the entry just before it, are its own. With a budget of one, two
  // requests that differ ONLY in the caller-supplied prefix must still be
  // the same client.
  //
  // This holds while the declared count matches the topology. The test below
  // pins what happens when it does not, which is that the caller does reach
  // the key -- so read the two together rather than this one alone.
  let calls = 0;
  const app = productionApp(() => { calls += 1; }, { maxRequests: 1, windowMs: 60_000, maxClients: 10 }, undefined, 1);
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const first = await call(running.url, validHeaders({ "X-Forwarded-For": "198.51.100.1, 192.0.2.1, 192.0.2.99" }));
    assert.equal(first.status, 200);
    const second = await call(running.url, validHeaders({ "X-Forwarded-For": "198.51.100.2, 192.0.2.1, 192.0.2.99" }));
    assert.equal(second.status, 429);
    assert.equal(calls, 1);
  } finally {
    await running.close();
  }
});

test("the hop index is counted from the end, not pinned to the last entry", async () => {
  // Two clients behind the SAME balancer. They share the caller prefix and the
  // trailing balancer entry, and differ only at the position the hop count
  // selects. Reading the last entry instead would key both on the balancer and
  // spend one budget between them, so the second request would be refused.
  let calls = 0;
  const app = productionApp(() => { calls += 1; }, { maxRequests: 1, windowMs: 60_000, maxClients: 10 }, undefined, 1);
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const first = await call(running.url, validHeaders({ "X-Forwarded-For": "198.51.100.1, 192.0.2.1, 192.0.2.99" }));
    assert.equal(first.status, 200);
    const second = await call(running.url, validHeaders({ "X-Forwarded-For": "198.51.100.1, 192.0.2.2, 192.0.2.99" }));
    assert.equal(second.status, 200, "distinct clients behind one balancer shared a rate-limit key");
    assert.equal(calls, 2);
  } finally {
    await running.close();
  }
});

test("a count higher than the topology reads the caller's own prefix", async () => {
  // ADR-0102 names this as an accepted silent failure. This test exists
  // because the direction is easy to state backwards in prose, so it is
  // pinned here instead. One real appending hop, declared as two: a caller who prepends
  // makes the header long enough, and the entry two from the end is the one
  // they sent. They are served, on a key they chose.
  //
  // It is deliberately NOT guarded. Refusing an over-long header instead would
  // break the prefix-ignoring the correct configuration depends on, which the
  // test above pins. The count is the control, and it is the adopter's to get
  // right.
  let calls = 0;
  const app = productionApp(() => { calls += 1; }, { maxRequests: 1, windowMs: 60_000, maxClients: 10 }, undefined, 2);
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const first = await call(running.url, validHeaders({ "X-Forwarded-For": "203.0.113.9, 192.0.2.1, 192.0.2.99" }));
    assert.equal(first.status, 200, "an over-count refused a header long enough to read");
    // Proof the key came from the prefix: only the prefix differs, and the
    // budget of one is not spent, so this is a different client to the limiter.
    const second = await call(running.url, validHeaders({ "X-Forwarded-For": "203.0.113.8, 192.0.2.1, 192.0.2.99" }));
    assert.equal(second.status, 200, "the rate-limit key did not come from the caller prefix");
    assert.equal(calls, 2);
    // And the limiter is still limiting at this hop count: reusing the first
    // prefix spends the same budget, so these are keys, not a disabled check.
    const repeat = await call(running.url, validHeaders({ "X-Forwarded-For": "203.0.113.9, 192.0.2.1, 192.0.2.99" }));
    assert.equal(repeat.status, 429, "the limiter stopped limiting above one hop");
    assert.equal(calls, 2);
  } finally {
    await running.close();
  }
});

test("a hop-count mismatch is named in the server record, not in the response", async () => {
  // ADR-0102: the operator calibrating the count needs to know the header was
  // too short for what was declared. The caller must not be told, because a
  // refused caller who learns their prefix is too short can add entries until
  // they are served -- which is the over-count attack, counted out for them.
  const events = [];
  const app = productionApp(
    () => {},
    { maxRequests: 10, windowMs: 1_000, maxClients: 10 },
    undefined,
    1,
    [structuredLogging("test", (event) => { events.push(event); })],
  );
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const refused = await call(running.url, validHeaders({ "X-Forwarded-For": "192.0.2.1" }));
    assert.equal(refused.status, 403);
    assert.doesNotMatch(refused.body, /hop/i, "the response told the caller about the hop count");
    assert.equal(refused.body.includes("Invalid forwarding metadata"), true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const refusal = events.find((event) => event.statusCode === 403);
    assert.ok(refusal, "no observability event was emitted for the refusal");
    assert.equal(refusal.forwardingRefusal, "hop-count-mismatch");
  } finally {
    await running.close();
  }
});

test("a repeated forwarded-for header cannot shift the hop index", async () => {
  // ADR-0102: under hop indexing, sending the field twice is the move a caller
  // would make to push the entry the server reads. Node joins repeated fields
  // with a comma, so if the server read the joined value the index would move.
  // `singleHeader` refuses a repeated field instead, and that has to hold when
  // a hop count is declared rather than only at the default. Hop counts 0 and 1
  // are the two this release's deployments use.
  for (const forwardedHops of [0, 1]) {
    let calls = 0;
    const app = productionApp(() => { calls += 1; }, { maxRequests: 10, windowMs: 1_000, maxClients: 10 }, undefined, forwardedHops);
    const running = await serveEmseepea(app, { port: 0 });
    try {
      const repeated = await call(running.url, validHeaders({
        "X-Forwarded-For": ["198.51.100.1", "192.0.2.1, 192.0.2.99"],
      }));
      assert.equal(repeated.status, 403, `hop count ${forwardedHops} accepted a repeated header`);
      assert.equal(calls, 0);
    } finally {
      await running.close();
    }
  }
});

test("the default still refuses a header it was not told to expect", async () => {
  // The positive control for the two above: without forwardedHops, the same
  // two-entry header is refused, so those tests are exercising the new
  // behaviour rather than a boundary that was already open.
  let calls = 0;
  const app = productionApp(() => { calls += 1; }, { maxRequests: 10, windowMs: 1_000, maxClients: 10 });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    assert.equal((await call(running.url, validHeaders({ "X-Forwarded-For": "192.0.2.1, 192.0.2.99" }))).status, 403);
    assert.equal(calls, 0);
  } finally {
    await running.close();
  }
});

test("a padded single entry is read, which the previous parse refused", async () => {
  // Named because it is a real behaviour change on the path every existing
  // deployment is on. Entries in this header are conventionally separated by
  // comma AND space, so the old parse refusing " 192.0.2.1" was a wart, not a
  // boundary. Trimming makes the default stricter about nothing and more
  // correct about whitespace.
  let calls = 0;
  const app = productionApp(() => { calls += 1; }, { maxRequests: 10, windowMs: 1_000, maxClients: 10 });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    assert.equal((await call(running.url, validHeaders({ "X-Forwarded-For": " 192.0.2.1 " }))).status, 200);
    assert.equal(calls, 1);
  } finally {
    await running.close();
  }
});

test("a hop count that is not a whole number of hops is refused at construction", () => {
  for (const forwardedHops of [-1, 1.5, Number.NaN]) {
    assert.throws(
      () => productionApp(() => {}, { maxRequests: 1, windowMs: 1_000, maxClients: 1 }, undefined, forwardedHops),
      /forwardedHops must be a non-negative safe integer/,
    );
  }
});
