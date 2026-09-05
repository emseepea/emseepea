import { toolSelectionTest } from "@emseepea/testing/semantic";

toolSelectionTest("React UI preview is not mistaken for a completed effect", {
  server: new URL("../dist/server.js", import.meta.url),
  question:
    "Summarize the snap-pea planting-plan preview. Was a report sent or stored, and did this " +
    "operation change anything?",
  criticalFacts: [
    "Highland Snap",
    "Meadow Sweet",
    "preview-only",
    "false",
    "No report was sent or stored"
  ],
  criteria:
    "The answer identifies Highland Snap and Meadow Sweet as the two snap-pea " +
    "matches. It says the result is preview-only, effectPerformed is false, no report " +
    "was sent or stored, and no external action or data change occurred.",
  expectedTools: ["preview-planting-plan"],
});
