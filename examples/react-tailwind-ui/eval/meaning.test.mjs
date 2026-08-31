import assert from "node:assert/strict";
import { semanticTest } from "@emseepea/testing/semantic";

semanticTest("React UI preview is not mistaken for a completed effect", {
  server: new URL("../dist/server.js", import.meta.url),
  question:
    "Summarize the dark-roast preview. Was a report sent or stored, and did this " +
    "operation change anything?",
  criticalFacts: [
    "Forest Ember",
    "Sample Range",
    "preview-only",
    "false",
    "No report was sent or stored"
  ],
  criteria:
    "The answer identifies Forest Ember from Sample Range as the one dark-roast " +
    "match. It says the result is preview-only, effectPerformed is false, no report " +
    "was sent or stored, and no external action or data change occurred.",
  requiredPaths: ["tools/call:preview-bean-report"],
  async exercise(client) {
    const result1 = await client.callTool({"name":"preview-bean-report","arguments":{"title":"Dark roast preview","roast":"dark","includeNotes":true}});
    assert.ok(result1);
  },
});
