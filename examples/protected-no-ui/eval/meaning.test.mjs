import { toolSelectionTest } from "@emseepea/testing/semantic";

toolSelectionTest("Inventory availability excludes reserved and inbound bags", {
  server: new URL("../dist/server.js", import.meta.url),
  authToken: "example-access-token",
  question:
    "How many green coffee bags can we promise to customers now? Show the " +
    "calculation and explain whether the inbound bags count yet.",
  criticalFacts: [
    "120",
    "35",
    "85",
    "40"
  ],
  criteria:
    "The answer calculates 85 bags available to promise as 120 on hand minus 35 " +
    "reserved. It says the 40 inbound bags are not yet available to promise and " +
    "does not add them to the current 85.",
  expectedTools: ["get-private-inventory-report"],
});
