import assert from "node:assert/strict";

export function assertReportAnswer(answer) {
  const json = answer.trim().replace(/^```(?:json)?\r?\n([\s\S]*?)\r?\n```$/i, "$1");
  assert.deepEqual(JSON.parse(json), {
    createdByInstance: "eval-instance",
    totalPlants: 4,
    peaTypeCounts: { shelling: 2, snap: 2 },
    reusesOriginalReport: true,
    createsAnotherReport: false,
  });
}
