import assert from "node:assert/strict";
import test from "node:test";

import { startMcpServer } from "@emseepea/testing";

test("advertises and returns understandable pea variety details", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const client = await running.connect();

  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(({ name }) => name), ["get-pea-variety"]);

  const result = await client.callTool({
    name: "get-pea-variety",
    arguments: { name: "Highland Snap" },
  });
  assert.equal(result.isError, false);
  assert.deepEqual(result.structuredContent, {
    name: "Highland Snap",
    peaType: "snap",
    growthHabit: "climbing",
    daysToMaturity: 70,
    traits: ["edible pods", "needs support"],
  });
});
