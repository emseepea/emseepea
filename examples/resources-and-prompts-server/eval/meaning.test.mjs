import assert from "node:assert/strict";
import { semanticTest } from "@emseepea/testing/semantic";

semanticTest("Sowing depth and plant spacing remain separate concepts", {
  server: new URL("../dist/server.js", import.meta.url),
  question:
    "If I sow pea seeds deeper, should I also space the plants farther apart? " +
    "Explain the distinction for a home gardener.",
  criticalFacts: [
    "sowing depth",
    "plant spacing"
  ],
  criteria:
    "The answer says sowing peas deeper does not mean spacing the plants farther " +
    "apart. It explains that sowing depth is how deep a seed goes while plant " +
    "spacing is the gap between plants, and it does not treat the measurements as " +
    "interchangeable.",
  requiredPaths: ["resources/read:guide://peas/getting-started","prompts/get:growing-guide"],
  async exercise(client) {
    const result1 = await client.readResource({"uri":"guide://peas/getting-started"});
    assert.ok(result1);
    const result2 = await client.getPrompt({"name":"growing-guide","arguments":{"topic":"sowing-depth"}});
    assert.ok(result2);
  },
});
