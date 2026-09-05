import { toolSelectionTest } from "@emseepea/testing/semantic";
import { assertReportAnswer } from "./report-answer.mjs";

toolSelectionTest("Reusing a request ID returns the original shared report", {
  server: new URL("../dist/server.js", import.meta.url),
  environment: {"EMSEEPEA_INSTANCE":"eval-instance"},
  question:
    "Call the report tool twice with daily-harvest-report, as if the second call " +
    "came from another server instance. Which server instance originally created it, " +
    "what are the pea type counts, and what happens if another server instance uses " +
    "the same request ID? Return only a JSON object with createdByInstance " +
    "(string), totalPlants (number), peaTypeCounts (an object with shelling and " +
    "snap numbers), reusesOriginalReport (boolean), and createsAnotherReport " +
    "(boolean). The booleans describe what happens when another server uses " +
    "the same request ID.",
  criticalFacts: ["eval-instance"],
  assertAnswer: assertReportAnswer,
  criteria:
    "The JSON answer identifies eval-instance as the original creator and " +
    "reports four pea plants: two shelling and two snap. " +
    "reusesOriginalReport is true and createsAnotherReport is false: another " +
    "server using the same request ID receives the original stored report " +
    "without creating a second report.",
  expectedTools: ["create-shared-harvest-report", "create-shared-harvest-report"],
});
