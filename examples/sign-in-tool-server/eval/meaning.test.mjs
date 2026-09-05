import { toolSelectionTest } from "@emseepea/testing/semantic";

toolSelectionTest("Inventory availability excludes reserved and inbound seed packets", {
  server: new URL("../dist/server.js", import.meta.url),
  authToken: "example-access-token",
  question:
    "How many pea seed packets can we promise to customers now? Show the " +
    "calculation and explain whether the inbound packets count yet.",
  criticalFacts: [
    "120",
    "35",
    "85",
    "40"
  ],
  criteria:
    "The answer calculates 85 packets available to promise as 120 on hand minus 35 " +
    "reserved. It says the 40 inbound packets are not yet available to promise and " +
    "does not add them to the current 85.",
  expectedTools: ["get-private-inventory-report"],
});
