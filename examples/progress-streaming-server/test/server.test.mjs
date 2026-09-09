import assert from "node:assert/strict";
import test from "node:test";

import {
  insecureTestAuthentication,
  startEmseepea,
  startMcpServer,
} from "@emseepea/testing";
import { createProgressStreamingServer } from "../dist/app.js";

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

test("the same template composes protected access and observability", async (t) => {
  const events = [];
  const permissions = ["trials:run"];
  const running = await startEmseepea(t, await createProgressStreamingServer({
    access: { access: "protected", requiredScopes: permissions },
    authentication: insecureTestAuthentication(permissions),
    observability: [{ id: "test-log", emit: (event) => events.push(event) }],
  }));
  const client = await running.connect("test-token");
  const result = await client.callTool({
    name: "run-germination-trial",
    arguments: { tray: "sample-tray" },
  });
  assert.equal(result.structuredContent.status, "complete");
  assert.ok(events.some(({ capability }) => capability === "run-germination-trial"));
});
