#!/usr/bin/env node

// A promotion-only repair must keep using the release pull request that built
// the immutable tarballs, not the repair pull request's merge parent.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const execute = async (command, args) => (await exec(command, args, { encoding: "utf8" })).stdout.trim();
const fullSha = /^[a-f0-9]{40}$/;
const allowedRepairFiles = new Set([
  ".github/workflows/publish.yml",
  "scripts/promote-release.mjs",
  "scripts/bind-promotion-release.mjs",
  "tests/docs/promote-release.test.mjs",
  "tests/docs/bind-promotion-release.test.mjs",
]);

async function successfulRuns(sha, repository, run = execute) {
  const response = JSON.parse(await run("gh", [
    "api", "-X", "GET", `repos/${repository}/actions/workflows/release.yml/runs`,
    "-f", `head_sha=${sha}`, "-f", "status=success",
  ]));
  return response.workflow_runs ?? [];
}

export async function bindPromotionRelease({
  run = execute,
  listRuns,
  env = process.env,
} = {}) {
  assert.match(env.GITHUB_REPOSITORY, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "GitHub repository is missing");
  const resolveRuns = listRuns ?? ((sha) => successfulRuns(sha, env.GITHUB_REPOSITORY, run));
  const head = await run("git", ["rev-parse", "HEAD"]);
  assert.match(head, fullSha);
  assert.equal(head, env.GITHUB_SHA, "publish workflow head changed");

  const runsAt = async (sha) => {
    assert.match(sha, fullSha);
    return (await resolveRuns(sha)).filter((item) =>
      item.head_sha === sha
      && item.head_branch === "changeset-release/publish"
      && item.event === "workflow_dispatch"
      && item.conclusion === "success");
  };
  let releaseSha = await run("git", ["rev-parse", "HEAD^2"]);
  let runs = await runsAt(releaseSha);
  assert.ok(runs.length <= 1, "expected exactly one successful Release run");
  const repair = runs.length === 0;
  if (repair) {
    const repairBase = await run("git", ["rev-parse", "HEAD^1"]);
    assert.match(env.EMSEEPEA_REPAIR_BASE_SHA, fullSha, "original publish merge is missing");
    assert.equal(repairBase, env.EMSEEPEA_REPAIR_BASE_SHA, "repair does not follow the expected publish merge");
    let originalMerge = repairBase;
    if (env.EMSEEPEA_ORIGINAL_PUBLISH_SHA) {
      assert.match(env.EMSEEPEA_ORIGINAL_PUBLISH_SHA, fullSha, "original publish merge is missing");
      originalMerge = await run("git", ["rev-parse", "HEAD^1^1"]);
      assert.equal(originalMerge, env.EMSEEPEA_ORIGINAL_PUBLISH_SHA, "repair does not follow the original publish merge");
    }
    releaseSha = await run("git", ["rev-parse", originalMerge === repairBase ? "HEAD^1^2" : "HEAD^1^1^2"]);
    runs = await runsAt(releaseSha);
    assert.equal(runs.length, 1, "expected exactly one successful Release run for the original pull request head");
    assert.equal(
      await run("git", ["diff", "--name-only", releaseSha, originalMerge]),
      "",
      "original publish merge changed release source",
    );
  }
  assert.equal(runs.length, 1, "expected exactly one successful Release run");
  assert.match(String(runs[0].id), /^[0-9]+$/, "successful Release run ID is invalid");
  await run("git", ["merge-base", "--is-ancestor", releaseSha, head]);

  const changed = (await run("git", ["diff", "--name-only", releaseSha, head])).split("\n").filter(Boolean);
  assert.ok(
    changed.every((path) => repair && allowedRepairFiles.has(path)),
    "publish merge is not a promotion-only repair of the checked release head",
  );
  const currentOrigin = JSON.parse(await run("git", ["show", "HEAD:.release/origin.json"]));
  const releaseOrigin = JSON.parse(await run("git", ["show", `${releaseSha}:.release/origin.json`]));
  assert.match(releaseOrigin.sha, fullSha, "release source is missing");
  assert.equal(currentOrigin.sha, releaseOrigin.sha, "publish merge changed the release source");
  await run("git", ["merge-base", "--is-ancestor", releaseOrigin.sha, releaseSha]);
  if (repair) {
    const sourceWebsite = JSON.parse(await run("git", ["show", `${releaseOrigin.sha}:website/package.json`]));
    const releasedWebsite = JSON.parse(await run("git", ["show", `${releaseSha}:website/package.json`]));
    assert.equal(releasedWebsite.version, sourceWebsite.version, "a website release needs its measured artifact and cannot use this repair path");
  }
  return { releaseSha, releaseRunId: String(runs[0].id) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { releaseSha, releaseRunId } = await bindPromotionRelease();
  process.stdout.write(`EMSEEPEA_RELEASE_SHA=${releaseSha}\nEMSEEPEA_RELEASE_RUN_ID=${releaseRunId}\n`);
}
