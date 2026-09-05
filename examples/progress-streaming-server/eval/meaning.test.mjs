import { toolSelectionTest } from "@emseepea/testing/semantic";

toolSelectionTest("Progress stages remain distinct from the final germination result", {
  server: new URL("../dist/server.js", import.meta.url),
  question:
    "Run the sample-tray pea germination trial. Name the tray, list the progress " +
    "stages, and report the final status and germination result. Keep progress and the completed result " +
    "distinct.",
  criticalFacts: [
    "sample-tray",
    "soak",
    "sow",
    "sprout",
    "complete",
    "8",
    "10"
  ],
  criteria:
    "The answer identifies soak, sow, and sprout as progress stages, then " +
    "separately reports the completed final result of 8 out of 10 germinated seeds " +
    "for sample-tray. It does not treat an intermediate progress stage as the final " +
    "result.",
  expectedTools: ["run-germination-trial"],
});
