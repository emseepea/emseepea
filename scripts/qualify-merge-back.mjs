#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { parse } from "yaml";

import { fullQualityJobNames } from "./check-release-pull-request.mjs";

const exec = promisify(execFile);
const repository = "emseepea/emseepea";
const fullSha = /^[a-f0-9]{40}$/;
const pollIntervalMs = 15_000;

async function execute(command, args, { timeoutMs } = {}) {
  const { stdout } = await exec(command, args, { encoding: "utf8", timeout: timeoutMs });
  return stdout.trim();
}

function requireSha(value, label) {
  assert.match(value ?? "", fullSha, `${label} must be a full commit SHA`);
  return value;
}

export async function verifyMergeBackCommit({
  baseSha,
  publishSha,
  mergeBackSha,
  run = execute,
} = {}) {
  requireSha(baseSha, "base SHA");
  requireSha(publishSha, "publish SHA");
  requireSha(mergeBackSha, "merge-back SHA");
  assert.notEqual(baseSha, publishSha, "merge-back parents must be distinct");
  assert.notEqual(mergeBackSha, baseSha, "merge-back commit must differ from its base");
  assert.notEqual(mergeBackSha, publishSha, "merge-back commit must differ from the publish head");

  const parents = (await run("git", ["show", "-s", "--format=%P", mergeBackSha])).split(/\s+/).filter(Boolean);
  assert.deepEqual(parents, [baseSha, publishSha], "merge-back commit parents changed");
  return { baseSha, publishSha, mergeBackSha };
}

async function listQualityRuns(sha, run) {
  const pages = JSON.parse(await run("gh", [
    "api", "--paginate", "--slurp", "-X", "GET",
    `repos/${repository}/actions/workflows/quality.yml/runs`,
    "-f", `head_sha=${sha}`, "-f", "event=workflow_dispatch", "-f", "per_page=100",
  ]) || "[]");
  assert.ok(Array.isArray(pages), "Quality run pages are missing");
  const runs = pages.flatMap((page) => page.workflow_runs ?? []);
  assert.equal(new Set(runs.map(({ id }) => id)).size, runs.length, "Quality run pages overlap");
  return runs;
}

function matchingRuns(runs, sha, correlation) {
  return runs.filter((item) =>
    item.head_sha === sha
    && item.event === "workflow_dispatch"
    && item.path === ".github/workflows/quality.yml"
    && item.display_title === `Quality ${correlation}`);
}

async function readQualityJobs(item, run) {
  assert.ok(Number.isSafeInteger(item.run_attempt) && item.run_attempt > 0, "Quality run attempt is missing");
  const pages = JSON.parse(await run("gh", [
    "api", "--paginate", "--slurp",
    `repos/${repository}/actions/runs/${item.id}/attempts/${item.run_attempt}/jobs?per_page=100`,
  ]) || "[]");
  assert.ok(Array.isArray(pages) && pages.length > 0, "Quality job pages are missing");
  const jobs = pages.flatMap((page) => page.jobs ?? []);
  assert.equal(new Set(jobs.map(({ id }) => id)).size, jobs.length, "Quality job pages overlap");
  return jobs;
}

export async function verifyFullQualityJobs({ item, jobs, run = execute } = {}) {
  const resolvedJobs = jobs ?? await readQualityJobs(item, run);
  const workflow = parse(await readFile(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8"));
  for (const name of fullQualityJobNames(workflow)) {
    const matches = resolvedJobs.filter((job) => job.name === name);
    assert.equal(matches.length, 1, `missing or ambiguous full Quality job: ${name}`);
    assert.equal(matches[0].status, "completed", `full Quality job did not finish: ${name}`);
    assert.equal(matches[0].conclusion, "success", `full Quality job did not pass: ${name}`);
  }
}

export async function qualifyMergeBack({
  baseSha,
  publishSha,
  mergeBackSha,
  run = execute,
  readRuns = (sha) => listQualityRuns(sha, run),
  readJobs,
  pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = 6_600_000,
  now = () => Date.now(),
  correlation = randomUUID(),
} = {}) {
  assert.match(correlation, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, "dispatch correlation must be a random UUID");
  await verifyMergeBackCommit({ baseSha, publishSha, mergeBackSha, run });
  assert.match(
    await run("git", ["remote", "get-url", "origin"]),
    /^(?:https:\/\/github\.com\/|git@github\.com:)emseepea\/emseepea(?:\.git)?$/,
  );
  await run("git", ["fetch", "origin", "main", "publish"]);
  assert.equal(await run("git", ["rev-parse", "origin/main"]), mergeBackSha, "origin/main moved before qualification dispatch");
  assert.equal(await run("git", ["rev-parse", "origin/publish"]), publishSha, "origin/publish moved before qualification dispatch");

  const before = matchingRuns(await readRuns(mergeBackSha), mergeBackSha, correlation);
  const existingIds = new Set(before.map(({ id }) => String(id)));
  await run("gh", [
    "workflow", "run", "quality.yml", "--repo", repository, "--ref", "main",
    "-f", `expected_head_sha=${mergeBackSha}`,
    "-f", `expected_base_sha=${baseSha}`,
    "-f", `expected_publish_sha=${publishSha}`,
    "-f", `dispatch_correlation=${correlation}`,
  ]);

  const deadline = now() + timeoutMs;
  let selected;
  while (true) {
    assert.ok(now() < deadline, `Quality did not finish for merge-back ${mergeBackSha}`);
    let runs;
    try {
      runs = matchingRuns(await readRuns(mergeBackSha), mergeBackSha, correlation)
        .filter(({ id }) => !existingIds.has(String(id)));
    } catch (error) {
      if (now() >= deadline) throw error;
      await pause(pollIntervalMs);
      continue;
    }
    assert.ok(runs.length <= 1, "ambiguous newly dispatched Quality runs");
    if (runs.length === 0) {
      await pause(pollIntervalMs);
      continue;
    }
    if (selected) assert.equal(String(runs[0].id), String(selected.id), "selected Quality run changed");
    selected = runs[0];
    if (selected.status === "completed") {
      assert.equal(selected.conclusion, "success", `Quality concluded ${selected.conclusion || "without a result"}`);
      assert.match(selected.html_url ?? "", /^https:\/\/github\.com\/emseepea\/emseepea\/actions\/runs\/\d+$/);
      await verifyFullQualityJobs({
        item: selected,
        jobs: readJobs ? await readJobs(selected) : undefined,
        run,
      });
      return { runId: String(selected.id), url: selected.html_url };
    }
    await pause(pollIntervalMs);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (process.argv[2] === "verify") {
    await verifyMergeBackCommit({
      baseSha: process.env.EMSEEPEA_MERGE_BACK_BASE_SHA,
      publishSha: process.env.EMSEEPEA_MERGE_BACK_PUBLISH_SHA,
      mergeBackSha: process.env.EMSEEPEA_MERGE_BACK_SHA,
    });
  } else {
    const result = await qualifyMergeBack({
      baseSha: process.argv[2],
      publishSha: process.argv[3],
      mergeBackSha: process.argv[4],
    });
    process.stdout.write(`${result.url}\n`);
  }
}
