import { toolSelectionTest } from "@emseepea/testing/semantic";

toolSelectionTest("Native UI preview is not mistaken for a completed effect", {
  server: new URL("../dist/server.js", import.meta.url),
  question:
    "Summarize the dark-roast preview. Was a report sent or stored, and did this " +
    "operation change anything?",
  criticalFacts: [
    "Forest Ember",
    "Sample Range",
    "preview-only",
    "false",
    /\b(?:no|not|nothing|neither|never|wasn't|weren't|didn't)\b[^.!?\n]{0,80}\b(?:sent|delivered)\b/i,
    /\b(?:no|not|nothing|neither|never|wasn't|weren't|didn't)\b[^.!?\n]{0,80}\b(?:stored|saved|persisted)\b/i
  ],
  criteria:
    "The answer identifies Forest Ember from Sample Range as the one dark-roast " +
    "match. It says the result is preview-only, effectPerformed is false, no report " +
    "was sent or stored, and no external action or data change occurred.",
  expectedTools: ["preview-bean-report"],
});
