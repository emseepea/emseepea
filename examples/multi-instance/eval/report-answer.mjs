import assert from "node:assert/strict";

export function assertReportAnswer(answer) {
  const json = answer.trim().replace(/^```(?:json)?\r?\n([\s\S]*?)\r?\n```$/i, "$1");
  assert.deepEqual(JSON.parse(json), {
    createdByInstance: "eval-instance",
    totalBeans: 4,
    roastCounts: { light: 1, medium: 2, dark: 1 },
    reusesOriginalReport: true,
    createsAnotherReport: false,
  });
}
