import assert from "node:assert/strict";
import test from "node:test";
import { assertReportAnswer } from "../eval/report-answer.mjs";

test("report answers require the correct counts, creator, and reuse behavior", () => {
  const correct = {
    createdByInstance: "eval-instance", totalBeans: 4,
    roastCounts: { light: 1, medium: 2, dark: 1 },
    reusesOriginalReport: true, createsAnotherReport: false,
  };
  assertReportAnswer(JSON.stringify(correct));
  assertReportAnswer(JSON.stringify(correct, null, 2));
  const fenced = (value) => "```json\n" + JSON.stringify(value) + "\n```";
  assertReportAnswer(fenced(correct));
  assertReportAnswer("```\r\n" + JSON.stringify(correct) + "\r\n```");
  for (const change of [
    { createdByInstance: "another-instance" }, { totalBeans: 5 }, { totalBeans: "4" },
    { roastCounts: { light: 2, medium: 1, dark: 1 } },
    { roastCounts: { light: -1, medium: 2, dark: 1 } },
    { roastCounts: { light: 1.5, medium: 2, dark: 1 } },
    ...["light", "medium", "dark"].map((roast) => ({
      roastCounts: { ...correct.roastCounts, [roast]: 0 },
    })),
    { reusesOriginalReport: false }, { createsAnotherReport: true },
    { reusesOriginalReport: "true" }, { createsAnotherReport: undefined },
  ]) assert.throws(() => assertReportAnswer(JSON.stringify({ ...correct, ...change })));
  for (const answer of [
    "not JSON", "{}", "null", "[]", "Summary:\n" + fenced(correct),
    fenced(correct) + "\nMore text", "```json\n" + JSON.stringify(correct),
    fenced(correct) + "\n" + fenced(correct), fenced({ ...correct, totalBeans: 5 }),
  ])
    assert.throws(() => assertReportAnswer(answer));
});
