import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepea } from "@emseepea/server";
import { startEmseepea, startMcpServer } from "../dist/index.js";

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
