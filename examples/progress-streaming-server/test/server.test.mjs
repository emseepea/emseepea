import assert from "node:assert/strict";
import test from "node:test";

import { startMcpServer } from "@emseepea/testing";

test("reports bounded progress before returning the final germination result", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const client = await running.connect();
  const tool = (await client.listTools()).tools[0];
  assert.equal(tool.inputSchema.properties.tray.description, "Sample germination tray to test.");
  assert.equal(tool.outputSchema.properties.tray.description, "Germination tray that was tested.");
  assert.equal(tool.outputSchema.properties.status.description, "Final state of the germination trial.");
  assert.equal(tool.outputSchema.properties.germinatedSeeds.description, "Number of seeds that germinated.");
  assert.equal(tool.outputSchema.properties.totalSeeds.description, "Total number of seeds in the trial.");
  assert.equal(tool.outputSchema.properties.stages.description, "Trial stages completed in order.");
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
  assert.equal(result.content[0].text, JSON.stringify(result.structuredContent));
});
