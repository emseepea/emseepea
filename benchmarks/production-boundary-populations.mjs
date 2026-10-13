import assert from "node:assert/strict";
import { classifyProductionBoundaryCohorts } from "./production-boundary-classification.mjs";

export const productionBoundaryPopulationCount = 3;
export const productionBoundaryRequestClasses = ["accepted", "rate-limited", "capacity-exhausted", "malformed"];
const expectedStatuses = [200, 429, 503, 400];

export async function measureProductionBoundaryPopulations(measure, { signal } = {}) {
  const populations = [];
  for (let population = 1; population <= productionBoundaryPopulationCount; population += 1) {
    try {
      if (signal?.aborted) throw new Error("Population not measured after external cancellation");
      populations.push({ population, report: await measure(population) });
    } catch (error) {
      populations.push({ population, error: { name: error?.name ?? "Error",
        message: String(error?.message ?? error).slice(0, 256) } });
    }
  }
  return { ...classifyProductionBoundaryPopulations(populations), populations };
}

export function classifyProductionBoundaryPopulations(populations) {
  if (!Array.isArray(populations)) return { status: "INCOMPLETE", diagnosticOnly: null,
    qualifies: false, reasons: ["population collection is not an array"] };
  const reasons = [];
  const statuses = [];
  try {
    assert.equal(populations.length, productionBoundaryPopulationCount, "missing complete population");
    assert.deepEqual(populations.map((item) => item.population), [1, 2, 3], "population identities must be ordered and unique");
    const profile = populations[0]?.report?.profile;
    for (const { report } of populations) {
      assert.ok(report, "population execution did not complete");
      assert.equal(report.diagnosticOnly, populations[0].report.diagnosticOnly, "population instrumentation changed");
      assert.equal(typeof report.diagnosticOnly, "boolean", "missing instrumentation provenance");
      for (const key of ["name", "node", "platform", "cpu", "logicalCpus"]) {
        assert.ok(profile?.[key], "missing runner provenance");
        if (key === "logicalCpus") assert.ok(Number.isInteger(profile[key]) && profile[key] > 0);
        else assert.ok(typeof profile[key] === "string" && profile[key].trim());
        assert.equal(report.profile?.[key], profile[key], "runner profile changed between populations");
      }
      for (const [key, value] of Object.entries({ concurrency: 16, durationMs: 1000, cohortCount: 3,
        throughputRunsPerCohort: 3, cpuSamplesPerCohort: 200, allocationSamplesPerCohort: 80, wireSamplesPerCohort: 10 })) {
        assert.equal(report.profile[key], value, "measurement profile changed");
      }
      assert.deepEqual(report.results.map((result) => result.requestClass), productionBoundaryRequestClasses,
        "population request classes are incomplete or reordered");
      for (const [index, result] of report.results.entries()) {
        assert.equal(result.expectedStatus, expectedStatuses[index], "request status changed");
        for (const cohort of result.cohorts) {
          assert.equal(cohort.throughputSamples.length, 3, "incomplete throughput samples");
          assert.equal(cohort.cpuSamples.length, 200, "incomplete CPU samples");
          assert.equal(cohort.allocationSamples.length, 80, "incomplete allocation samples");
          assert.equal(cohort.wireSamples.length, 10, "incomplete wire samples");
          assert.deepEqual(cohort.cpuSamples.map((sample) => sample.index), Array.from({ length: 200 }, (_, i) => i),
            "CPU sample identities changed");
        }
        const checked = classifyProductionBoundaryCohorts(result.requestClass, result.cohorts);
        assert.equal(checked.expectedStatus, result.expectedStatus, "retained cohort HTTP status changed");
        for (const key of ["status", "throughputRequestsPerSecond", "frameworkProcessCpuMsPerRequest",
          "sampledTransientAllocationBytesPerRequest", "frameworkAddedWireBytesPerRequest"]) {
          assert.deepEqual(result[key], checked[key], "population summary disagrees with retained samples");
        }
      }
      const status = report.results.every((result) => result.status === "PASS") ? "PASS" : "FLAG";
      assert.equal(report.status, status, "population status disagrees with measurements");
      statuses.push(status);
    }
  } catch (error) {
    reasons.push(String(error.message).split("\n")[0]);
  }
  const status = reasons.length ? "INCOMPLETE"
    : statuses.every((value) => value === "PASS") ? "PASS"
      : statuses.every((value) => value === "FLAG") ? "FLAG" : "INCONCLUSIVE";
  const diagnosticOnly = populations.length !== productionBoundaryPopulationCount ? null
    : populations.every((item) => item?.report?.diagnosticOnly === true) ? true
      : populations.every((item) => item?.report?.diagnosticOnly === false) ? false : null;
  return { status, diagnosticOnly, qualifies: status === "PASS" && diagnosticOnly === false, reasons };
}
