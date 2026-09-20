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

import {
  assertPlannedReleaseReadiness,
  assertReleasePullRequestPlan,
  readPlannedReleaseStatus,
} from "./verify-release-readiness.mjs";

const exec = promisify(execFile);

async function execute(command, args, options = {}) {
  const { stdout } = await exec(command, args, { encoding: "utf8", ...options });
  return stdout.trim();
}

export async function checkReleasePullRequest(baseSha, headSha, {
  run = execute,
  readStatus,
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
  return status;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [baseSha, headSha] = process.argv.slice(2);
  if (!baseSha || !headSha) throw new Error("Usage: check-release-pull-request <base-sha> <head-sha>");
  await checkReleasePullRequest(baseSha, headSha);
}
