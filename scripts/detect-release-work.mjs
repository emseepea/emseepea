import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function hasReleaseWork(plan) {
  const releaseTypes = new Set(["none", "patch", "minor", "major"]);
  assert.ok(plan && typeof plan === "object" && !Array.isArray(plan), "Changesets status must be an object");
  assert.ok(Array.isArray(plan.releases), "Changesets status releases must be an array");
  for (const release of plan.releases) {
    assert.ok(release && typeof release === "object" && !Array.isArray(release), "Changesets release must be an object");
    assert.equal(typeof release.type, "string", "Changesets release type must be a string");
    assert.ok(releaseTypes.has(release.type), `Unknown Changesets release type: ${release.type}`);
  }
  return plan.releases.some(({ type }) => type !== "none");
}

export async function detectReleaseWork(path) {
  assert.ok(path, "Changesets status path is required");
  const plan = JSON.parse(await readFile(path, "utf8"));
  return hasReleaseWork(plan);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.stdout.write(`has_changesets=${await detectReleaseWork(process.argv[2])}\n`);
}
