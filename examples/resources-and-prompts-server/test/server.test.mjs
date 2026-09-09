import assert from "node:assert/strict";
import test from "node:test";

import {
  insecureTestAuthentication,
  startEmseepea,
  startMcpServer,
} from "@emseepea/testing";
import { createResourcesAndPromptsServer } from "../dist/app.js";

test("lists and reads the advertised resource and prompt", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const client = await running.connect();

  assert.deepEqual((await client.listResources()).resources.map(({ uri }) => uri), [
    "guide://peas/getting-started",
  ]);
  const resource = await client.readResource({ uri: "guide://peas/getting-started" });
  assert.match(resource.contents[0].text, /Sowing depth is how deep a seed goes/);
  assert.match(resource.contents[0].text, /plant spacing is the gap between plants/);

  const listedPrompts = await client.listPrompts();
  assert.deepEqual(listedPrompts.prompts.map(({ name }) => name), ["growing-guide"]);
  assert.deepEqual(listedPrompts.prompts[0].arguments, [{
    name: "topic",
    description: "Pea-growing topic to explain.",
    required: true,
  }]);
  const prompt = await client.getPrompt({
    name: "growing-guide",
    arguments: { topic: "sowing-depth" },
  });
  assert.match(prompt.messages[0].content.text, /Explain sowing-depth/);
});

test("the same template composes protected access and observability", async (t) => {
  const events = [];
  const permissions = ["guides:read"];
  const running = await startEmseepea(t, await createResourcesAndPromptsServer({
    access: { access: "protected", requiredScopes: permissions },
    authentication: insecureTestAuthentication(permissions),
    observability: [{ id: "test-log", emit: (event) => events.push(event) }],
  }));
  const client = await running.connect("test-token");
  assert.deepEqual((await client.listResources()).resources.map(({ name }) => name), ["getting-started"]);
  assert.deepEqual((await client.listPrompts()).prompts.map(({ name }) => name), ["growing-guide"]);
  assert.ok(events.some(({ method }) => method === "resources/list"));
});
