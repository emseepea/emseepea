#!/usr/bin/env node

import assert from "node:assert/strict";
import { assembleReleasePlan } from "@changesets/assemble-release-plan";
import { readConfig } from "@changesets/config";
import { readPreState } from "@changesets/pre";
import { readChangesets } from "@changesets/read";
import { getPackages } from "@manypkg/get-packages";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { initializerPackages } from "./public-packages.mjs";

export function assertReleaseReadiness(registryBefore, review) {
  const pending = registryBefore.packages
    .filter(({ present }) => !present)
    .map(({ name, version }) => `${name}@${version}`)
    .sort();
  if (pending.length === 0) return;
  assert.match(review, /^- Result: PASS$/m);
  assert.match(
    review,
    /^- Final result: within appetite(?:, subject to the required exact-commit gates)?\.$/m,
  );
  const reviewed = [...new Set([...review.matchAll(/^- `([^`]+@[^`]+)`$/gm)]
    .map(([, spec]) => spec))]
    .sort();
  const targets = new Set(registryBefore.packages.map(({ name, version }) => `${name}@${version}`));
  assert.deepEqual(
    reviewed.filter((spec) => !targets.has(spec)),
    [],
    "release-readiness package set does not match publication",
  );
  assert.deepEqual(
    pending.filter((spec) => !reviewed.includes(spec)),
    [],
    "release-readiness package set does not match publication",
  );
}

export function assertPlannedReleaseReadiness(status, review, { requireReleases = false } = {}) {
  const releases = status.releases.filter(({ type }) => type !== "none");
  if (requireReleases) assert.notEqual(releases.length, 0, "release pull request has no planned releases");
  if (releases.length === 0) return;
  assertReleaseReadiness({
    packages: releases
      .map(({ name, newVersion }) => ({ name, version: newVersion, present: false })),
  }, review);
}

export async function readPlannedReleaseStatus(cwd = process.cwd()) {
  const packages = await getPackages(cwd);
  const result = await readConfig(cwd, packages);
  assert.equal(result.errors, undefined, `Invalid Changesets config: ${result.errors?.join("; ")}`);
  return assembleReleasePlan(
    await readChangesets(packages.rootDir),
    packages,
    result.config,
    await readPreState(packages.rootDir),
  );
}

export function assertReleasePullRequestPlan(status, baseLock, headLock, changedFiles, manifests) {
  const initializerNames = new Set(initializerPackages.map(({ name }) => name));
  const workspaceFiles = new Set(Object.keys(baseLock.packages)
    .filter((packagePath) => packagePath && !packagePath.startsWith("node_modules/"))
    .flatMap((packagePath) => [`${packagePath}/package.json`, `${packagePath}/CHANGELOG.md`]));
  assert.deepEqual(
    changedFiles.filter((file) => file !== "package.json"
      && file !== "package-lock.json"
      && !/^\.changeset\/[^/]+\.md$/.test(file)
      && !workspaceFiles.has(file)),
    [],
    "release pull request contains non-generated files",
  );
  const planned = status.releases
    .filter(({ type }) => type !== "none")
    .map(({ name, newVersion }) => `${name}@${newVersion}`)
    .sort();
  const plannedNames = new Set(status.releases
    .filter(({ type }) => type !== "none")
    .map(({ name }) => name));
  const actual = Object.entries(headLock.packages)
    .filter(([packagePath, manifest]) => manifest.name && manifest.version !== baseLock.packages[packagePath]?.version)
    .map(([, manifest]) => `${manifest.name}@${manifest.version}`)
    .sort();
  assert.deepEqual(actual, planned, "release pull request package versions do not match the Changesets plan");
  const manifestVersions = manifests
    .map(({ base, head }) => {
      assert.equal(head.name, base.name, "release pull request changed a package name");
      const { version: baseVersion, ...baseManifest } = base;
      const { version: headVersion, ...headManifest } = head;
      if (initializerNames.has(base.name) && base.private !== true && !plannedNames.has(base.name)) {
        assert.deepEqual(
          headManifest,
          baseManifest,
          "release pull request changed an initializer manifest without a planned release",
        );
      }
      return headVersion === baseVersion ? undefined : `${head.name}@${headVersion}`;
    })
    .filter(Boolean)
    .sort();
  assert.deepEqual(manifestVersions, planned, "release pull request manifests do not match the Changesets plan");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [registryPath, reviewPath] = process.argv.slice(2);
  if (!registryPath || !reviewPath) {
    throw new Error("Usage: verify-release-readiness <registry-before.json> <review.md>");
  }
  assertReleaseReadiness(
    JSON.parse(await readFile(registryPath, "utf8")),
    await readFile(reviewPath, "utf8"),
  );
}
