import assert from "node:assert/strict";
import { semanticTest } from "@emseepea/testing/semantic";

semanticTest("Strength and extraction remain separate concepts", {
  server: new URL("../dist/server.js", import.meta.url),
  question:
    "Does making coffee stronger necessarily mean that extraction is higher? " +
    "Explain the distinction for a home brewer.",
  criticalFacts: [
    "concentration",
    "extraction"
  ],
  criteria:
    "The answer says stronger coffee does not necessarily mean higher extraction. " +
    "It explains that strength is concentration while extraction is how much " +
    "material left the grounds, and it does not describe the concepts as " +
    "interchangeable.",
  requiredPaths: ["resources/read:guide://coffee/getting-started","prompts/get:brew-guide"],
  async exercise(client) {
    const result1 = await client.readResource({"uri":"guide://coffee/getting-started"});
    assert.ok(result1);
    const result2 = await client.getPrompt({"name":"brew-guide","arguments":{"topic":"brew-ratio"}});
    assert.ok(result2);
  },
});
