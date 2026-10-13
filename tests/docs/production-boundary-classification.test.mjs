import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyProductionBoundaryCohorts,
  measureProductionBoundaryClass,
  productionBoundaryCohortCount,
  productionBoundaryTraceName,
} from "../../benchmarks/production-boundary-classification.mjs";

const cohort = (id, { cpu = 1, throughput = 200, allocation = 1024, wire = 512 } = {}) => ({
  cohort: id,
  requestClass: "accepted",
  expectedStatus: 200,
  throughputSamples: [throughput, throughput + 1, throughput + 2],
  cpuSamples: Array.from({ length: 20 }, (_, index) => ({ index, requestCount: 20, cpuMs: cpu })),
  allocationSamples: Array.from({ length: 20 }, () => allocation),
  wireSamples: Array.from({ length: 10 }, () => wire),
});

test("classifies the complete repeated-run population against unchanged budgets", () => {
  const result = classifyProductionBoundaryCohorts("accepted", [cohort(1), cohort(2), cohort(3)]);
  assert.equal(result.status, "PASS");
  assert.equal(result.cohorts.length, productionBoundaryCohortCount);
  assert.equal(result.cpuSamples.length, 60);
  assert.equal(result.frameworkProcessCpuMsPerRequest.p95, 1);
  assert.equal(result.throughputRequestsPerSecond.min, 200);
});

test("retains a noisy cohort while applying the p95 ceiling to the pooled population", () => {
  const noisy = cohort(1);
  noisy.cpuSamples[0].cpuMs = 8;
  noisy.cpuSamples[1].cpuMs = 8;
  const result = classifyProductionBoundaryCohorts("accepted", [noisy, cohort(2), cohort(3)]);
  assert.equal(result.status, "PASS");
  assert.equal(result.cohorts[0].frameworkProcessCpuMsPerRequest.p95, 8);
  assert.equal(result.frameworkProcessCpuMsPerRequest.p95, 1);
  assert.deepEqual(result.cpuSamples.filter(({ cpuMs }) => cpuMs === 8).map(({ cohort }) => cohort), [1, 1]);
});

test("fails when the pooled CPU, throughput, allocation, or wire contract is exceeded", () => {
  for (const override of [
    { cpu: 5.01 },
    { throughput: 99 },
    { allocation: (256 * 1024) + 1 },
    { wire: (2 * 1024) + 1 },
  ]) {
    const result = classifyProductionBoundaryCohorts("accepted", [
      cohort(1, override), cohort(2, override), cohort(3, override),
    ]);
    assert.equal(result.status, "FLAG");
  }
});

test("rejects missing, duplicate, or incomplete cohorts", () => {
  assert.throws(
    () => classifyProductionBoundaryCohorts("accepted", [cohort(1), cohort(2)]),
    /exactly 3 complete cohorts/,
  );
  assert.throws(
    () => classifyProductionBoundaryCohorts("accepted", [cohort(1), cohort(1), cohort(3)]),
    /identities must be unique/,
  );
  assert.throws(
    () => classifyProductionBoundaryCohorts("accepted", [cohort(1), cohort(2), cohort(4)]),
    /identities must be complete/,
  );
  const changedStatus = cohort(3);
  changedStatus.expectedStatus = 202;
  assert.throws(
    () => classifyProductionBoundaryCohorts("accepted", [cohort(1), cohort(2), changedStatus]),
    /expected status changed/,
  );
  const invalidCpuBatch = cohort(3);
  invalidCpuBatch.cpuSamples[0].requestCount = 0;
  assert.throws(
    () => classifyProductionBoundaryCohorts("accepted", [cohort(1), cohort(2), invalidCpuBatch]),
    /CPU sample request counts are invalid/,
  );
  for (const [field, message] of [
    ["throughputSamples", "throughput"],
    ["cpuSamples", "CPU"],
    ["allocationSamples", "allocation"],
    ["wireSamples", "wire"],
  ]) {
    const incomplete = cohort(3);
    incomplete[field] = [];
    assert.throws(
      () => classifyProductionBoundaryCohorts("accepted", [cohort(1), cohort(2), incomplete]),
      new RegExp(`${message} measurements are incomplete`),
    );
  }
});

test("always runs exactly three fresh cohorts and propagates failed or cancelled measurements", async () => {
  const calls = [];
  const result = await measureProductionBoundaryClass("accepted", async (requestClass, id) => {
    calls.push({ requestClass, id });
    return cohort(id);
  });
  assert.equal(result.status, "PASS");
  assert.deepEqual(calls, [
    { requestClass: "accepted", id: 1 },
    { requestClass: "accepted", id: 2 },
    { requestClass: "accepted", id: 3 },
  ]);

  for (const error of [new Error("failed cohort"), new Error("cancelled cohort")]) {
    let attempts = 0;
    await assert.rejects(
      () => measureProductionBoundaryClass("accepted", async (requestClass, id) => {
        attempts += 1;
        if (id === 2) throw error;
        return cohort(id);
      }),
      error,
    );
    assert.equal(attempts, 2);
  }
});

test("uses a unique trace name for every request-class cohort", () => {
  const names = ["accepted", "rate-limited", "capacity-exhausted", "malformed"].flatMap(
    (requestClass) => Array.from(
      { length: productionBoundaryCohortCount },
      (_, index) => productionBoundaryTraceName(requestClass, index + 1),
    ),
  );
  assert.equal(new Set(names).size, names.length);
  assert.equal(names[0], "production-accepted-cohort-1.cpuprofile");
});
