#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { watchWorkflowRuns } from "./push-and-watch.mjs";
import { checkReleasePullRequest } from "./check-release-pull-request.mjs";

const exec = promisify(execFile);
const repository = "emseepea/emseepea";

async function execute(command, args, { timeoutMs } = {}) {
  const { stdout } = await exec(command, args, { encoding: "utf8", timeout: timeoutMs });
  return stdout.trim();
}

// ADR-0098: a maintainer merges the release pull request into `publish`, and
// that merge is what promotes the packages already on `next` to `latest`. This
// command performs that merge and watches the publish workflow.
export async function releaseAndWatch({
  run = execute,
  readStatus,
  pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = 3_600_000,
} = {}) {
  assert.match(
    await run("git", ["remote", "get-url", "origin"]),
    /^(?:https:\/\/github\.com\/|git@github\.com:)emseepea\/emseepea(?:\.git)?$/,
  );
  assert.equal(await run("git", ["status", "--porcelain"]), "", "release checkout is not clean");
  // ADR-0098 no longer requires a checkout on `main`: the release pull request
  // is based on `publish`, and this command does not push from the local tree.
  // That also unblocks releasing from a worktree (Problem 011).
  const pullRequests = JSON.parse(await run("gh", [
    "pr", "list", "--repo", repository, "--state", "open", "--base", "publish",
    "--head", "changeset-release/publish", "--limit", "2",
    "--json", "number,headRefOid,baseRefOid,url",
  ]) || "[]");
  assert.equal(pullRequests.length, 1, "expected exactly one open Changesets release pull request");
  const [pullRequest] = pullRequests;
  assert.match(pullRequest.headRefOid, /^[a-f0-9]{40}$/);
  // The plan gate's base is the trunk commit the head derives from, which is
  // the merge base of the head and `main`.
  await run("git", ["fetch", "origin", "main", `pull/${pullRequest.number}/head`]);
  const baseSha = await run("git", ["merge-base", "origin/main", pullRequest.headRefOid]);
  assert.match(baseSha, /^[a-f0-9]{40}$/);

  await checkReleasePullRequest(baseSha, pullRequest.headRefOid, { run, readStatus });

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

  // The merge lands on `publish`, and publish.yml promotes, deploys and merges
  // back. Replaced initializers are retired there too.
  const urls = await watchWorkflowRuns({ sha, run, pause, timeoutMs, workflows: ["publish.yml"] });
  return { pullRequest: merged.url, sha, urls };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await releaseAndWatch();
  console.log(result.pullRequest);
  for (const url of result.urls) console.log(url);
}
