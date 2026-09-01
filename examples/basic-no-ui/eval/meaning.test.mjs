import { toolSelectionTest } from "@emseepea/testing/semantic";

toolSelectionTest("Basic bean details keep each concept distinct", {
  server: new URL("../dist/server.js", import.meta.url),
  question:
    "For Highland Bloom, give me its origin, variety, processing method, roast, and " +
    "tasting notes. Keep those concepts distinct.",
  criticalFacts: [
    "Sample Highlands",
    "Bourbon",
    "natural",
    "medium",
    "berry",
    "cocoa"
  ],
  criteria:
    "The answer says Highland Bloom is a medium-roast, naturally processed Bourbon " +
    "from Sample Highlands with berry and cocoa tasting notes. It does not confuse " +
    "origin, variety, process, roast, or tasting notes.",
  expectedTools: ["get-bean-details"],
});
