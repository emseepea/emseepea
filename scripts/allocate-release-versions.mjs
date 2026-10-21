import assert from "node:assert/strict";
import { inc } from "semver";
import { publicPackages } from "./public-packages.mjs";
import { fetchPackage } from "./verify-registry-release.mjs";

export function applyVersionAllocations(plan, allocations = []) {
  assert.ok(Array.isArray(allocations), "generated version allocations must be an array");
  assert.equal(new Set(allocations.map(({ name }) => name)).size, allocations.length, "duplicate version allocation");
  const versions = new Map();
  for (const { name, plannedVersion, occupiedVersions, newVersion } of allocations) {
    const release = plan.releases.find((item) => item.name === name && item.type !== "none");
    assert.ok(release && publicPackages.some((item) => item.name === name), "allocation is outside the public release plan");
    assert.equal(plannedVersion, release.newVersion, "allocated version does not match source release intent");
    assert.ok(Array.isArray(occupiedVersions) && occupiedVersions.length > 0, "allocation must skip occupied versions");
    let next = plannedVersion;
    for (const occupied of occupiedVersions) {
      assert.equal(occupied, next, "allocation must skip consecutive occupied patches");
      next = inc(next, "patch");
      assert.ok(next, "cannot allocate another patch version");
    }
    assert.equal(newVersion, next, "allocation must use the first unused patch");
    versions.set(name, newVersion);
  }
  return { ...plan, releases: plan.releases.map((release) => versions.has(release.name)
    ? { ...release, newVersion: versions.get(release.name) } : release) };
}

export async function allocateReleaseVersions(plan, { readRegistry = fetchPackage } = {}) {
  const allocations = [];
  for (const release of plan.releases.filter(({ name, type }) => type !== "none" && publicPackages.some((item) => item.name === name))) {
    const metadata = await readRegistry(release.name);
    assert.ok(metadata && metadata.versions && typeof metadata.versions === "object" && !Array.isArray(metadata.versions), `${release.name}: registry versions are unavailable`);
    let next = release.newVersion;
    const occupiedVersions = [];
    while (Object.hasOwn(metadata.versions, next)) {
      occupiedVersions.push(next);
      next = inc(next, "patch");
      assert.ok(next, "cannot allocate another patch version");
    }
    if (occupiedVersions.length) allocations.push({ name: release.name, plannedVersion: release.newVersion, occupiedVersions, newVersion: next });
  }
  return { plan: applyVersionAllocations(plan, allocations), allocations };
}
