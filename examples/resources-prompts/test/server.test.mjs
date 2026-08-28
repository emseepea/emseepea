import assert from "node:assert/strict";
import test from "node:test";

import { startMcpServer } from "@emseepea/testing";

test("lists and reads the advertised resource and prompt", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const client = await running.connect();

  assert.deepEqual((await client.listResources()).resources.map(({ uri }) => uri), [
    "guide://coffee/getting-started",
  ]);
  const resource = await client.readResource({ uri: "guide://coffee/getting-started" });
  assert.match(resource.contents[0].text, /Strength is concentration/);
  assert.match(resource.contents[0].text, /extraction is how much material left the grounds/);

  assert.deepEqual((await client.listPrompts()).prompts.map(({ name }) => name), ["brew-guide"]);
  const prompt = await client.getPrompt({
    name: "brew-guide",
    arguments: { topic: "brew-ratio" },
  });
  assert.match(prompt.messages[0].content.text, /Explain brew-ratio/);
});
