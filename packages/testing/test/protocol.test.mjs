import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepea } from "@emseepea/server";
import {
  insecureTestAuthentication,
  startEmseepea,
  startMcpServer,
} from "../dist/index.js";

test("the testing helpers select a supported protocol version", async (t) => {
  const modern = await startEmseepea(t, createEmseepea({
    name: "modern-testing-helper",
    version: "0.0.0",
  }));
  const modernClient = await modern.connect();
  assert.equal(modernClient.getNegotiatedProtocolVersion(), "2026-07-28");

  const legacy = await startEmseepea(t, createEmseepea({
    name: "legacy-testing-helper",
    version: "0.0.0",
  }), { protocolVersion: "2025-11-25" });
  const legacyClient = await legacy.connect();
  assert.equal(legacyClient.getNegotiatedProtocolVersion(), "2025-11-25");

  const spawned = await startMcpServer(t, new URL("./protocol-server.mjs", import.meta.url), {
    protocolVersion: "2025-11-25",
  });
  const spawnedClient = await spawned.connect();
  assert.equal(spawnedClient.getNegotiatedProtocolVersion(), "2025-11-25");
});

test("the testing helpers support explicit idempotent cleanup", async () => {
  const running = await startEmseepea(createEmseepea({
    name: "explicit-cleanup-helper",
    version: "0.0.0",
  }), { protocolVersion: "2025-11-25" });
  const spawned = await startMcpServer(new URL("./protocol-server.mjs", import.meta.url), {
    protocolVersion: "2025-11-25",
  });
  const client = await running.connect();
  const spawnedClient = await spawned.connect();
  assert.equal(client.getNegotiatedProtocolVersion(), "2025-11-25");
  assert.equal(spawnedClient.getNegotiatedProtocolVersion(), "2025-11-25");

  await Promise.all([running.close(), running.close(), spawned.close()]);
  await assert.rejects(fetch(running.url));
  await assert.rejects(fetch(spawned.url));
});

test("the testing helpers register automatic cleanup", async (t) => {
  let cleanup;
  const running = await startMcpServer({
    after(value) { cleanup = value; },
  }, new URL("./protocol-server.mjs", import.meta.url));
  t.after(() => running.close());
  await running.connect();

  assert.equal(cleanup, running.close);
  await cleanup();
  await assert.rejects(fetch(running.url));
});

test("explicit cleanup runs after a failed assertion", async () => {
  let url;
  await assert.rejects(async () => {
    const running = await startEmseepea(createEmseepea({
      name: "failed-assertion-cleanup-helper",
      version: "0.0.0",
    }));
    url = running.url;
    try {
      assert.fail("synthetic assertion failure");
    } finally {
      await running.close();
    }
  }, /synthetic assertion failure/);

  await assert.rejects(fetch(url));
});

test("explicit cleanup runs after a failed connection attempt", async () => {
  const running = await startEmseepea(createEmseepea({
    name: "failed-connection-cleanup-helper",
    version: "0.0.0",
    access: { access: "protected", requiredScopes: ["test:read"] },
    authentication: insecureTestAuthentication(["test:read"]),
  }));

  await assert.rejects(async () => {
    try {
      await running.connect();
    } finally {
      await running.close();
    }
  });
  await assert.rejects(fetch(running.url));
});
