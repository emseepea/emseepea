#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { retireReplacedInitializers } from "./retire-replaced-initializers.mjs";
import { watchWorkflowRuns } from "./push-and-watch.mjs";
import {
  assertPlannedReleaseReadiness,
  assertReleasePullRequestPlan,
  readPlannedReleaseStatus,
} from "./verify-release-readiness.mjs";

const exec = promisify(execFile);
const repository = "emseepea/emseepea";

async function execute(command, args, { timeoutMs } = {}) {
  const { stdout } = await exec(command, args, { encoding: "utf8", timeout: timeoutMs });
  return stdout.trim();
}

export async function releaseAndWatch({
  run = execute,
  readStatus = readPlannedReleaseStatus,
  pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = 3_600_000,
} = {}) {
  assert.match(
    await run("git", ["remote", "get-url", "origin"]),
    /^(?:https:\/\/github\.com\/|git@github\.com:)emseepea\/emseepea(?:\.git)?$/,
  );
  assert.equal(await run("git", ["status", "--porcelain"]), "", "release checkout is not clean");
  assert.equal(await run("git", ["branch", "--show-current"]), "main", "release checkout is not on main");
  const baseSha = await run("git", ["rev-parse", "HEAD"]);
  assert.match(baseSha, /^[a-f0-9]{40}$/);

  const pullRequests = JSON.parse(await run("gh", [
    "pr", "list", "--repo", repository, "--state", "open", "--base", "main",
    "--head", "changeset-release/main", "--limit", "2",
    "--json", "number,headRefOid,baseRefOid,url",
  ]) || "[]");
  assert.equal(pullRequests.length, 1, "expected exactly one open Changesets release pull request");
  const [pullRequest] = pullRequests;
  assert.equal(pullRequest.baseRefOid, baseSha, "release pull request base does not match local HEAD");
  assert.match(pullRequest.headRefOid, /^[a-f0-9]{40}$/);

  const status = await readStatus();
  assertPlannedReleaseReadiness(
    status,
    await run("git", ["show", "HEAD:docs/reviews/current-release-readiness.md"]),
    { requireReleases: true },
  );
  await run("git", ["fetch", "origin", `pull/${pullRequest.number}/head`]);
  const changedFiles = (await run("git", ["diff", "--name-only", baseSha, pullRequest.headRefOid]))
    .split("\n")
    .filter(Boolean);
  const manifestPaths = changedFiles.filter((file) => file === "package.json" || file.endsWith("/package.json"));
  const manifests = [];
  for (const manifestPath of manifestPaths) {
    manifests.push({
      base: JSON.parse(await run("git", ["show", `HEAD:${manifestPath}`])),
      head: JSON.parse(await run("git", ["show", `${pullRequest.headRefOid}:${manifestPath}`])),
    });
  }
  assertReleasePullRequestPlan(
    status,
    JSON.parse(await run("git", ["show", "HEAD:package-lock.json"])),
    JSON.parse(await run("git", ["show", `${pullRequest.headRefOid}:package-lock.json`])),
    changedFiles,
    manifests,
  );

  await run("gh", [
    "pr", "merge", String(pullRequest.number), "--repo", repository, "--merge",
    "--match-head-commit", pullRequest.headRefOid,
  ]);
  const merged = JSON.parse(await run("gh", [
    "pr", "view", String(pullRequest.number), "--repo", repository,
    "--json", "state,mergeCommit,url",
  ]) || "{}");
  assert.equal(merged.state, "MERGED", "release pull request was not merged");
  const sha = merged.mergeCommit?.oid;
  assert.match(sha, /^[a-f0-9]{40}$/);

  const urls = await watchWorkflowRuns({ sha, run, pause, timeoutMs });
  await retireReplacedInitializers({ run, pause });
  return { pullRequest: merged.url, sha, urls };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await releaseAndWatch();
  console.log(result.pullRequest);
  for (const url of result.urls) console.log(url);
}
