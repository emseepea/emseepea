import assert from "node:assert/strict";
import test from "node:test";

import { startMcpServer } from "@emseepea/testing";

test("advertises and returns understandable bean details", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const client = await running.connect();

  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(({ name }) => name), ["get-bean-details"]);

  const result = await client.callTool({
    name: "get-bean-details",
    arguments: { name: "Highland Bloom" },
  });
  assert.equal(result.isError, false);
  assert.deepEqual(result.structuredContent, {
    name: "Highland Bloom",
    origin: "Sample Highlands",
    variety: "Bourbon",
    process: "natural",
    roast: "medium",
    tastingNotes: ["berry", "cocoa"],
  });
});
