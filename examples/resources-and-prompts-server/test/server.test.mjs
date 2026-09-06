import assert from "node:assert/strict";
import test from "node:test";

import { startMcpServer } from "@emseepea/testing";

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
