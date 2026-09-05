import assert from "node:assert/strict";
import test from "node:test";

import { startMcpServer } from "@emseepea/testing";

test("reports bounded progress before returning the final germination result", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const client = await running.connect();
  const progress = [];
  const result = await client.callTool(
    { name: "run-germination-trial", arguments: { tray: "sample-tray" } },
    { onprogress: (update) => progress.push(update) },
  );

  assert.deepEqual(progress.map(({ message }) => message), ["soak", "sow", "sprout"]);
  assert.deepEqual(result.structuredContent, {
    tray: "sample-tray",
    status: "complete",
    germinatedSeeds: 8,
    totalSeeds: 10,
    stages: ["soak", "sow", "sprout"],
  });
});
