import assert from "node:assert/strict";
import test from "node:test";

import {
  insecureTestAuthentication,
  startEmseepea,
  startMcpServer,
} from "@emseepea/testing";
import { createToolServer } from "../dist/app.js";

test("advertises and returns understandable pea variety details", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const client = await running.connect();

  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(({ name }) => name), ["get-pea-variety"]);
  const tool = listed.tools[0];
  assert.equal(tool.inputSchema.properties.name.description, "Sample pea variety to look up.");
  assert.equal(tool.outputSchema.properties.name.description, "Name of the pea variety.");
  assert.equal(tool.outputSchema.properties.peaType.description, "Whether the variety is grown for shelled peas or edible pods.");
  assert.equal(tool.outputSchema.properties.growthHabit.description, "Whether the plant grows as a compact bush or a climbing vine.");
  assert.equal(tool.outputSchema.properties.daysToMaturity.description, "Approximate days from sowing until the first harvest.");
  assert.equal(tool.outputSchema.properties.traits.description, "Notable growing or eating qualities of the variety.");

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
  assert.equal(result.content[0].text, JSON.stringify(result.structuredContent));
});

test("the same template composes protected access and observability", async (t) => {
  const events = [];
  const permissions = ["varieties:read"];
  const running = await startEmseepea(t, await createToolServer({
    access: { access: "protected", requiredScopes: permissions },
    authentication: insecureTestAuthentication(permissions),
    observability: [{ id: "test-log", emit: (event) => events.push(event) }],
  }));
  const client = await running.connect("test-token");
  assert.deepEqual((await client.listTools()).tools.map(({ name }) => name), ["get-pea-variety"]);
  const result = await client.callTool({
    name: "get-pea-variety",
    arguments: { name: "Harbour Gem" },
  });
  assert.equal(result.structuredContent.name, "Harbour Gem");
  assert.ok(events.some(({ capability }) => capability === "get-pea-variety"));
});
