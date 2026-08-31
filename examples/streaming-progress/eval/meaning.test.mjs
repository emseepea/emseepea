import assert from "node:assert/strict";
import { semanticTest } from "@emseepea/testing/semantic";

semanticTest("Progress stages remain distinct from the final roast result", {
  server: new URL("../dist/server.js", import.meta.url),
  question:
    "Run sample-batch. Name the batch, list the progress stages, and report the " +
    "final status and final roasted mass. Keep progress and the completed result " +
    "distinct.",
  criticalFacts: [
    "sample-batch",
    "charge",
    "first crack",
    "cool",
    "complete",
    "820"
  ],
  criteria:
    "The answer identifies charge, first crack, and cool as progress stages, then " +
    "separately reports the completed final result of 820 roasted grams for " +
    "sample-batch. It does not treat an intermediate progress stage as the final " +
    "result.",
  requiredPaths: ["tools/call:roast-sample-batch"],
  async exercise(client) {
    const result1 = await client.callTool({"name":"roast-sample-batch","arguments":{"batch":"sample-batch"}});
    assert.ok(result1);
  },
});
