#!/usr/bin/env node

// ADR-0098: the release pull request's manifests and lockfile must match the
// Changesets plan, and it must carry nothing but generated files. This gate
// used to live only in `release:watch`; it runs in CI now, at the build, so a
// release cannot publish without it.
//
// It is a base-versus-head comparison and the base is the `main` commit the
// head derives from, NOT the pull request's base branch. `publish` lags the
// trunk by a whole release, so diffing against it would carry every source
// change since the last release and trip the no-non-generated-files assertion.
// The plan is read from the undrained changesets on that base commit, which is
// the only place they still exist.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { parse } from "yaml";

import {
  assertPlannedReleaseReadiness,
  assertReleasePullRequestPlan,
  readPlannedReleaseStatus,
} from "./verify-release-readiness.mjs";
import { assertRecoveryEligible } from "./release-recovery.mjs";

const exec = promisify(execFile);

async function execute(command, args, options = {}) {
  const { stdout } = await exec(command, args, { encoding: "utf8", ...options });
  return stdout.trim();
}

export function fullQualityJobNames(workflow) {
  return ["vulnerability-scan", "test", "initializer-qualification", "website-performance"].flatMap((id) => {
    const job = workflow.jobs[id];
    assert.ok(job?.name, `missing full Quality job ${id}`);
    const matrix = job.strategy?.matrix;
    if (!matrix) return [job.name];
    const axes = Object.entries(matrix);
    assert.equal(axes.length, 1, `unsupported Quality matrix for ${id}`);
    const [axis, values] = axes[0];
    assert.ok(Array.isArray(values) && values.length > 0);
    return values.map((value) => job.name.replace(`\${{ matrix.${axis} }}`, value));
  });
}

export async function assertFullSourceQuality(baseSha, headSha, { run = execute, qualityRunId, requireCompleted = true } = {}) {
  const origin = JSON.parse(await run("git", ["show", `${headSha}:.release/origin.json`]));
  assert.equal(origin.sha, baseSha, "release Quality source changed");
  const expectedQuality = qualityRunId ?? process.env.EMSEEPEA_SOURCE_QUALITY_RUN_ID ?? origin.qualityRunId;
  assert.match(String(expectedQuality), /^\d+$/, "checked Quality run is missing");
  assert.equal(String(origin.qualityRunId), String(expectedQuality), "candidate Quality run changed");
  const endpoint = `repos/emseepea/emseepea/actions/runs/${expectedQuality}`;
  const quality = JSON.parse(await run("gh", ["api", endpoint]));
  assert.equal(quality.head_sha, baseSha, "release Quality source changed");
  assert.equal(quality.path, ".github/workflows/quality.yml");
  assert.equal(quality.event, "push");
  assert.equal(quality.head_branch, "main");
  assert.ok(Number.isSafeInteger(quality.run_attempt) && quality.run_attempt > 0, "Quality attempt is missing");
  if (requireCompleted) {
    assert.equal(quality.status, "completed", "source Quality has not completed");
    assert.equal(quality.conclusion, "success", "source Quality did not pass");
  } else {
    assert.ok(quality.status === "in_progress" || (quality.status === "completed" && quality.conclusion === "success"), "source Quality did not pass");
  }
  const pages = JSON.parse(await run("gh", ["api", "--paginate", "--slurp", `${endpoint}/attempts/${quality.run_attempt}/jobs?per_page=100`]));
  assert.ok(Array.isArray(pages) && pages.length > 0, "Quality job pages are missing");
  const jobs = pages.flatMap((page) => page.jobs);
  assert.ok(pages.every((page) => page.total_count === jobs.length), "incomplete Quality job pages");
  assert.equal(new Set(jobs.map(({ id }) => id)).size, jobs.length, "ambiguous Quality jobs");
  const workflow = parse(await run("git", ["show", `${baseSha}:.github/workflows/quality.yml`]));
  for (const name of fullQualityJobNames(workflow)) {
    const matches = jobs.filter((job) => job.name === name);
    assert.equal(matches.length, 1, `missing or ambiguous full Quality job: ${name}`);
    const job = matches[0];
    assert.equal(String(job.run_id), String(expectedQuality), "Quality job run changed");
    assert.equal(job.head_sha, baseSha, "Quality job source changed");
    assert.equal(job.status, "completed", `full Quality job is incomplete: ${name}`);
    assert.equal(job.conclusion, "success", `full Quality job did not pass: ${name}`);
  }
  const current = JSON.parse(await run("gh", ["api", endpoint]));
  assert.equal(current.run_attempt, quality.run_attempt, "Quality attempt changed during verification");
  assert.equal(current.head_sha, baseSha, "Quality source changed during verification");
}

export async function checkReleasePullRequest(baseSha, headSha, {
  run = execute,
  readStatus,
  requireRecoveryAncestry = true,
  qualityRunId,
} = {}) {
  const readPlan = readStatus ?? readPlannedReleaseStatus;
  assert.match(baseSha, /^[a-f0-9]{40}$/, "base commit must be a full SHA");
  assert.match(headSha, /^[a-f0-9]{40}$/, "head commit must be a full SHA");

  // The plan lives with the changesets, which the head has already drained.
  const worktree = await mkdtemp(join(tmpdir(), "emseepea-release-base-"));
  let status;
  try {
    await run("git", ["worktree", "add", "--detach", worktree, baseSha]);
    status = await readPlan(worktree);
  } finally {
    await run("git", ["worktree", "remove", "--force", worktree]).catch(() => {});
    await rm(worktree, { recursive: true, force: true });
  }

  assertPlannedReleaseReadiness(
    status,
    await run("git", ["show", `${baseSha}:docs/reviews/current-release-readiness.md`]),
    { requireReleases: true },
  );

  const changedFiles = (await run("git", ["diff", "--name-only", baseSha, headSha]))
    .split("\n")
    .filter(Boolean);
  const manifestPaths = changedFiles.filter((file) => file === "package.json" || file.endsWith("/package.json"));
  const manifests = [];
  for (const manifestPath of manifestPaths) {
    manifests.push({
      base: JSON.parse(await run("git", ["show", `${baseSha}:${manifestPath}`])),
      head: JSON.parse(await run("git", ["show", `${headSha}:${manifestPath}`])),
    });
  }
  assertReleasePullRequestPlan(
    status,
    JSON.parse(await run("git", ["show", `${baseSha}:package-lock.json`])),
    JSON.parse(await run("git", ["show", `${headSha}:package-lock.json`])),
    changedFiles,
    manifests,
  );
  await assertFullSourceQuality(baseSha, headSha, { run, qualityRunId, requireCompleted: requireRecoveryAncestry });
  if (status.recovery) {
    await assertRecoveryEligible(status.recovery, { run, sourceSha: baseSha, candidateSha: headSha });
    if (requireRecoveryAncestry) await run("git", ["merge-base", "--is-ancestor", status.recovery.failedPublishSha, headSha]);
    // Only the generated candidate consumes the source recovery receipt.
    await run("git", ["show", `${baseSha}:.release/recovery.json`]);
    if ((await run("git", ["ls-tree", "--name-only", headSha, ".release/recovery.json"])) !== "") {
      throw new Error("release candidate did not consume its recovery receipt");
    }
  }
  return status;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [baseSha, headSha] = process.argv.slice(2);
  if (!baseSha || !headSha) throw new Error("Usage: check-release-pull-request <base-sha> <head-sha>");
  await checkReleasePullRequest(baseSha, headSha);
}
