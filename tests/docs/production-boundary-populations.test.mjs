import assert from "node:assert/strict";
import test from "node:test";
import { classifyProductionBoundaryCohorts, productionBoundaryTraceName } from "../../benchmarks/production-boundary-classification.mjs";
import { classifyProductionBoundaryPopulations, measureProductionBoundaryPopulations,
  productionBoundaryRequestClasses } from "../../benchmarks/production-boundary-populations.mjs";

function population(id, flagged = false, diagnosticOnly = false) {
  const results = productionBoundaryRequestClasses.map((requestClass, classIndex) => {
    const cohorts = [1, 2, 3].map((cohort) => ({
      cohort, requestClass, expectedStatus: [200, 429, 503, 400][classIndex],
      throughputSamples: [200, 201, 202],
      // Synthetic regression preserves the original failure's 31/600 above-limit
      // count and pooled p95, without importing confidential adopter evidence.
      cpuSamples: Array.from({ length: 200 }, (_, index) => ({ index,
        cpuMs: flagged && classIndex === 0 && index < [10, 10, 11][cohort - 1] ? 5.312 : 1 })),
      allocationSamples: Array(80).fill(1024), wireSamples: Array(10).fill(512),
    }));
    return classifyProductionBoundaryCohorts(requestClass, cohorts);
  });
  return { population: id, report: { diagnosticOnly,
    profile: { name: "fixed-test-runner", node: "test-runtime", platform: "test", cpu: "test", logicalCpus: 4,
      concurrency: 16, durationMs: 1000, cohortCount: 3, throughputRunsPerCohort: 3,
      cpuSamplesPerCohort: 200, allocationSamplesPerCohort: 80, wireSamplesPerCohort: 10 },
    results, status: flagged ? "FLAG" : "PASS" } };
}

test("qualifies only when all complete uninstrumented populations pass", () => {
  assert.equal(classifyProductionBoundaryPopulations([population(1), population(2), population(3)]).qualifies, true);
  const flagged = [population(1, true), population(2, true), population(3, true)];
  assert.equal(flagged[0].report.results[0].frameworkProcessCpuMsPerRequest.p95, 5.312);
  assert.equal(classifyProductionBoundaryPopulations(flagged).status, "FLAG");
});

test("a later passing population cannot erase the original complete failure", () => {
  for (const failed of [1, 2, 3]) {
    const result = classifyProductionBoundaryPopulations([1, 2, 3].map((id) => population(id, id === failed)));
    assert.equal(result.status, "INCONCLUSIVE");
    assert.equal(result.qualifies, false);
  }
});

test("missing, duplicated, incomplete, malformed or altered populations never qualify", () => {
  for (const rows of [undefined, null, {}, [null, null, null]]) {
    assert.equal(classifyProductionBoundaryPopulations(rows).status, "INCOMPLETE");
  }
  const changes = [
    (rows) => rows.pop(),
    (rows) => { rows[1].population = 1; },
    (rows) => { delete rows[1].report; },
    (rows) => { rows[1].report.results.pop(); },
    (rows) => { rows[1].report.results[0].cohorts.pop(); },
    (rows) => { rows[1].report.results[0].cohorts[0].cpuSamples.pop(); },
    (rows) => { rows[1].report.results[0].cohorts[0].allocationSamples.pop(); },
    (rows) => { rows[1].report.results[0].cohorts[0].wireSamples.pop(); },
    (rows) => { rows[1].report.results[0].cohorts[0].throughputSamples.pop(); },
    (rows) => { rows[1].report.results[0].cohorts[0].cpuSamples[0].cpuMs = NaN; },
    (rows) => { rows[1].report.results[0].frameworkProcessCpuMsPerRequest.p95 = 0; },
    (rows) => { rows[1].report.results[0].status = "FLAG"; },
    (rows) => { rows[1].report.profile.cpu = "different-runner"; },
    (rows) => { rows[1].report.profile.cpuSamplesPerCohort = 20; },
    (rows) => { rows[1].report.results[0].cohorts[0].cpuSamples[0].index = 1; },
    (rows) => { rows[1].report.diagnosticOnly = true; },
    (rows) => { delete rows[1].report.diagnosticOnly; },
  ];
  for (const change of changes) {
    const rows = [population(1), population(2), population(3)]; change(rows);
    const result = classifyProductionBoundaryPopulations(rows);
    assert.equal(result.status, "INCOMPLETE"); assert.equal(result.qualifies, false);
  }
});

test("instrumented passing populations remain nonqualifying", () => {
  const result = classifyProductionBoundaryPopulations([1, 2, 3].map((id) => population(id, false, true)));
  assert.equal(result.status, "PASS"); assert.equal(result.qualifies, false);
});

test("collection always attempts the fixed three populations and retains execution failures", async () => {
  const calls = [];
  const result = await measureProductionBoundaryPopulations(async (id) => {
    calls.push(id); if (id === 1) throw new Error("cancelled population");
    return population(id).report;
  });
  assert.deepEqual(calls, [1, 2, 3]);
  assert.equal(result.populations[0].error.message, "cancelled population");
  assert.equal(result.status, "INCOMPLETE"); assert.equal(result.qualifies, false);
});

test("every population and cohort retains a unique profile filename", () => {
  const names = [1, 2, 3].flatMap((p) => [1, 2, 3].map((c) => productionBoundaryTraceName("accepted", c, p)));
  assert.equal(new Set(names).size, 9);
});

test("external cancellation prevents further measurements and leaves explicit incomplete evidence", async () => {
  const controller = new AbortController(); const calls = [];
  const result = await measureProductionBoundaryPopulations(async (id) => {
    calls.push(id); controller.abort(); throw new Error("interrupted cohort");
  }, { signal: controller.signal });
  assert.deepEqual(calls, [1]);
  assert.equal(result.populations.length, 3);
  assert.match(result.populations[1].error.message, /external cancellation/);
  assert.equal(result.status, "INCOMPLETE"); assert.equal(result.qualifies, false);
});
