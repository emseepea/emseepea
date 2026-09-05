import assert from "node:assert/strict";
import test from "node:test";
import { assertReportAnswer } from "../eval/report-answer.mjs";

test("report answers require the correct counts, creator, and reuse behavior", () => {
  const correct = {
    createdByInstance: "eval-instance", totalPlants: 4,
    peaTypeCounts: { shelling: 2, snap: 2 },
    reusesOriginalReport: true, createsAnotherReport: false,
  };
  assertReportAnswer(JSON.stringify(correct));
  assertReportAnswer(JSON.stringify(correct, null, 2));
  const fenced = (value) => "```json\n" + JSON.stringify(value) + "\n```";
  assertReportAnswer(fenced(correct));
  assertReportAnswer("```\r\n" + JSON.stringify(correct) + "\r\n```");
  for (const change of [
    { createdByInstance: "another-instance" }, { totalPlants: 5 }, { totalPlants: "4" },
    { peaTypeCounts: { shelling: 3, snap: 1 } },
    { peaTypeCounts: { shelling: -1, snap: 2 } },
    { peaTypeCounts: { shelling: 1.5, snap: 2 } },
    ...["shelling", "snap"].map((peaType) => ({
      peaTypeCounts: { ...correct.peaTypeCounts, [peaType]: 0 },
    })),
    { reusesOriginalReport: false }, { createsAnotherReport: true },
    { reusesOriginalReport: "true" }, { createsAnotherReport: undefined },
  ]) assert.throws(() => assertReportAnswer(JSON.stringify({ ...correct, ...change })));
  for (const answer of [
    "not JSON", "{}", "null", "[]", "Summary:\n" + fenced(correct),
    fenced(correct) + "\nMore text", "```json\n" + JSON.stringify(correct),
    fenced(correct) + "\n" + fenced(correct), fenced({ ...correct, totalPlants: 5 }),
  ])
    assert.throws(() => assertReportAnswer(answer));
});
