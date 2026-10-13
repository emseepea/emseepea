import assert from "node:assert/strict";

export const productionBoundaryCohortCount = 3;

export async function measureProductionBoundaryClass(requestClass, measure) {
  const cohorts = [];
  for (let cohort = 1; cohort <= productionBoundaryCohortCount; cohort += 1) {
    cohorts.push(await measure(requestClass, cohort));
  }
  return classifyProductionBoundaryCohorts(requestClass, cohorts);
}

export function productionBoundaryTraceName(requestClass, cohort) {
  assert.match(requestClass, /^(?:accepted|rate-limited|capacity-exhausted|malformed)$/);
  assert.ok(Number.isInteger(cohort) && cohort >= 1 && cohort <= productionBoundaryCohortCount);
  return `production-${requestClass}-cohort-${cohort}.cpuprofile`;
}

export function classifyProductionBoundaryCohorts(requestClass, cohorts) {
  assert.equal(
    cohorts.length,
    productionBoundaryCohortCount,
    `production boundary requires exactly ${productionBoundaryCohortCount} complete cohorts`,
  );
  assert.equal(new Set(cohorts.map(({ cohort }) => cohort)).size, cohorts.length, "cohort identities must be unique");
  assert.deepEqual(
    cohorts.map(({ cohort }) => cohort).sort((left, right) => left - right),
    Array.from({ length: productionBoundaryCohortCount }, (_, index) => index + 1),
    "cohort identities must be complete",
  );

  for (const item of cohorts) {
    assert.equal(item.requestClass, requestClass, "cohort request class changed");
    assert.ok(Number.isInteger(item.expectedStatus), "cohort expected status is missing");
    assert.equal(item.expectedStatus, cohorts[0].expectedStatus, "cohort expected status changed");
    assertMeasurements(item.throughputSamples, "throughput");
    assertMeasurements(item.cpuSamples.map(({ cpuMs }) => cpuMs), "CPU");
    assertMeasurements(item.allocationSamples, "allocation");
    assertMeasurements(item.wireSamples, "wire");
  }

  const throughput = cohorts.flatMap(({ throughputSamples }) => throughputSamples);
  const cpuSamples = cohorts.flatMap(({ cohort, cpuSamples: samples }) =>
    samples.map((sample) => ({ cohort, ...sample })));
  const allocations = cohorts.flatMap(({ allocationSamples }) => allocationSamples);
  const wireBytes = cohorts.flatMap(({ wireSamples }) => wireSamples);
  const throughputSummary = summarize(throughput);
  const cpuSummary = summarize(cpuSamples.map(({ cpuMs }) => cpuMs));
  const allocationSummary = summarize(allocations);
  const wireSummary = summarize(wireBytes);
  const status = throughputSummary.min >= 100 && cpuSummary.p95 <= 5
    && allocationSummary.p95 <= 256 * 1024 && wireSummary.mean <= 2 * 1024 ? "PASS" : "FLAG";

  return {
    requestClass,
    expectedStatus: cohorts[0].expectedStatus,
    cohorts: cohorts.map(({ throughputSamples, allocationSamples, wireSamples, ...item }) => ({
      ...item,
      throughputRequestsPerSecond: summarize(throughputSamples),
      frameworkProcessCpuMsPerRequest: summarize(item.cpuSamples.map(({ cpuMs }) => cpuMs)),
      sampledTransientAllocationBytesPerRequest: summarize(allocationSamples),
      frameworkAddedWireBytesPerRequest: summarize(wireSamples),
    })),
    throughputRequestsPerSecond: throughputSummary,
    frameworkProcessCpuMsPerRequest: cpuSummary,
    cpuSamples,
    sampledTransientAllocationBytesPerRequest: allocationSummary,
    frameworkAddedWireBytesPerRequest: wireSummary,
    status,
  };
}

export function summarize(values) {
  assertMeasurements(values, "summary");
  const sorted = [...values].sort((left, right) => left - right);
  return {
    min: sorted[0],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    max: sorted.at(-1),
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
  };
}

function assertMeasurements(values, label) {
  assert.ok(Array.isArray(values) && values.length > 0, `${label} measurements are incomplete`);
  assert.ok(values.every((value) => Number.isFinite(value) && value >= 0), `${label} measurements are invalid`);
}
