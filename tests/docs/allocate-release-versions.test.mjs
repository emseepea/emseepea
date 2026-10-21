import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { inc } from "semver";
import { allocateReleaseVersions, applyVersionAllocations } from "../../scripts/allocate-release-versions.mjs";
import { versionPackages } from "../../scripts/version-packages.mjs";
import { readPlannedReleaseStatus, assertReleaseReadiness } from "../../scripts/verify-release-readiness.mjs";
import { publicPackages } from "../../scripts/public-packages.mjs";

const plan = { releases: [
  { name: "@emseepea/server", type: "minor", oldVersion: "0.23.1", newVersion: "0.24.0" },
  { name: "@emseepea/testing", type: "patch", oldVersion: "0.26.0", newVersion: "0.26.1" },
  { name: "@emseepea/website", type: "patch", oldVersion: "0.0.11", newVersion: "0.0.12" },
] };

test("generation skips all occupied patches and verification reuses the frozen selection", async () => {
  const calls = [];
  const { plan: allocated, allocations } = await allocateReleaseVersions(plan, {
    readRegistry: async (name) => {
      calls.push(name);
      return { versions: name === "@emseepea/server" ? { "0.24.0": {}, "0.24.1": {} } : {} };
    },
  });
  assert.deepEqual(calls, ["@emseepea/server", "@emseepea/testing"]);
  assert.deepEqual(allocated.releases.map(({ newVersion }) => newVersion), ["0.24.2", "0.26.1", "0.0.12"]);
  assert.deepEqual(applyVersionAllocations(plan, allocations), allocated);
  assert.equal(plan.releases[0].newVersion, "0.24.0");
  const review = "- `@emseepea/server@0.24.0`\n- Result: PASS\n- Final result: within appetite.\n";
  const registry = { packages: [{ name: "@emseepea/server", version: "0.24.2", present: false }] };
  assert.doesNotThrow(() => assertReleaseReadiness(registry, review, allocations));
  assert.throws(() => assertReleaseReadiness(registry, review), /package set/);
  for (const mutate of [
    (a) => { a.push(a[0]); },
    (a) => { a[0].name = "@emseepea/website"; },
    (a) => { a[0].plannedVersion = "0.25.0"; },
    (a) => { a[0].occupiedVersions = []; },
    (a) => { a[0].occupiedVersions = ["0.24.1"]; },
    (a) => { a[0].newVersion = "0.25.0"; },
    (a) => { a[0].newVersion = "0.24.3"; },
  ]) {
    const changed = structuredClone(allocations);
    mutate(changed);
    assert.throws(() => applyVersionAllocations(plan, changed));
  }
  await assert.rejects(() => allocateReleaseVersions(plan, { readRegistry: async () => undefined }), /unavailable/);
  await assert.rejects(() => allocateReleaseVersions(plan, { readRegistry: async () => { throw new Error("registry unavailable"); } }), /registry unavailable/);
});

test("automatic allocation generates consistent manifests, starter pins, changelogs, lockfile and origin", { timeout: 900_000 }, async (t) => {
  const exec = promisify(execFile);
  const run = async (args) => (await exec("git", args, { encoding: "utf8" })).stdout.trim();
  const root = await mkdtemp(join(tmpdir(), "emseepea-auto-version-"));
  await run(["worktree", "add", "--detach", root, "HEAD"]);
  t.after(async () => {
    await run(["worktree", "remove", "--force", root]);
    await rm(root, { recursive: true, force: true });
  });
  const configPath = join(root, ".changeset/config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.changelog = ["@changesets/changelog-git", {}];
  await writeFile(configPath, JSON.stringify(config));
  const sha = await run(["-C", root, "rev-parse", "HEAD"]);
  const original = await readPlannedReleaseStatus(root);
  const versions = new Map(original.releases.map(({ name, newVersion }) => [name, newVersion]));
  await versionPackages({ root, env: { ...process.env, GITHUB_SHA: sha, GITHUB_RUN_ID: "123" },
    readRegistry: async (name) => ({ versions: { [versions.get(name)]: { gitHead: "a".repeat(40) } } }),
  });
  const origin = JSON.parse(await readFile(join(root, ".release/origin.json"), "utf8"));
  assert.equal(origin.sha, sha);
  const selected = applyVersionAllocations(original, origin.versionAllocations);
  const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  for (const item of publicPackages.filter(({ name }) => versions.has(name))) {
    const expected = inc(versions.get(item.name), "patch");
    const manifest = JSON.parse(await readFile(join(root, item.path, "package.json"), "utf8"));
    assert.equal(manifest.version, expected);
    assert.equal(selected.releases.find(({ name }) => name === item.name).newVersion, expected);
    assert.equal(lock.packages[item.path].version, expected);
    assert.ok((await readFile(join(root, item.path, "CHANGELOG.md"), "utf8")).includes(`## ${expected}`));
    for (const dependency of manifest.starterDependencies ?? []) {
      if (versions.has(dependency)) assert.equal(manifest.devDependencies[dependency], inc(versions.get(dependency), "patch"));
    }
  }
  await assert.rejects(readFile(join(root, ".release/recovery.json")), { code: "ENOENT" });
});
