import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

import { fullQualityJobNames } from "../../scripts/check-release-pull-request.mjs";
import { qualifyMergeBack, verifyFullQualityJobs, verifyMergeBackCommit } from "../../scripts/qualify-merge-back.mjs";

const baseSha = "a".repeat(40);
const publishSha = "b".repeat(40);
const mergeBackSha = "c".repeat(40);
const url = "https://github.com/emseepea/emseepea/actions/runs/901";
const correlation = "00000000-0000-4000-8000-000000000001";
const workflow = parse(await readFile(new URL("../../.github/workflows/quality.yml", import.meta.url), "utf8"));
const requiredJobNames = fullQualityJobNames(workflow);

function fixtureRun({ parents = `${baseSha} ${publishSha}` } = {}) {
  const calls = [];
  const run = async (command, args) => {
    calls.push([command, args]);
    const joined = `${command} ${args.join(" ")}`;
    if (joined === `git show -s --format=%P ${mergeBackSha}`) return parents;
    if (joined === "git remote get-url origin") return "https://github.com/emseepea/emseepea.git";
    if (joined === "git fetch origin main publish") return "";
    if (joined === "git rev-parse origin/main") return mergeBackSha;
    if (joined === "git rev-parse origin/publish") return publishSha;
    if (command === "gh" && args[0] === "workflow") return "";
    throw new Error(`unexpected call: ${joined}`);
  };
  return { calls, run };
}

function qualityRun(overrides = {}) {
  return {
    id: 901,
    head_sha: mergeBackSha,
    event: "workflow_dispatch",
    path: ".github/workflows/quality.yml",
    display_title: `Quality ${correlation}`,
    run_attempt: 1,
    status: "completed",
    conclusion: "success",
    html_url: url,
    ...overrides,
  };
}

function successfulJobs() {
  return requiredJobNames.map((name, index) => ({
    id: index + 1,
    name,
    status: "completed",
    conclusion: "success",
  }));
}

test("merge-back verification requires the exact ordered parents", async () => {
  const accepted = fixtureRun();
  await verifyMergeBackCommit({ baseSha, publishSha, mergeBackSha, run: accepted.run });

  const rejected = fixtureRun({ parents: `${publishSha} ${baseSha}` });
  await assert.rejects(
    () => verifyMergeBackCommit({ baseSha, publishSha, mergeBackSha, run: rejected.run }),
    /merge-back commit parents changed/,
  );
});

test("qualification ignores pre-existing runs and waits for one exact successful dispatch", async () => {
  const fixture = fixtureRun();
  let read = 0;
  const result = await qualifyMergeBack({
    baseSha, publishSha, mergeBackSha, run: fixture.run,
    readRuns: async () => {
      read += 1;
      if (read === 1) return [qualityRun({ id: 700 })];
      if (read === 2) return [qualityRun({ id: 700 }), qualityRun({ id: 800, display_title: "Quality competing-run" })];
      if (read === 3) return [qualityRun({ id: 700 }), qualityRun({ status: "in_progress", conclusion: null })];
      return [qualityRun({ id: 700 }), qualityRun()];
    },
    readJobs: async () => successfulJobs(),
    pause: async () => {},
    correlation,
  });
  assert.deepEqual(result, { runId: "901", url });
  const dispatch = fixture.calls.find(([command, args]) => command === "gh" && args[0] === "workflow");
  assert.deepEqual(dispatch[1].slice(-8), [
    "-f", `expected_head_sha=${mergeBackSha}`,
    "-f", `expected_base_sha=${baseSha}`,
    "-f", `expected_publish_sha=${publishSha}`,
    "-f", `dispatch_correlation=${correlation}`,
  ]);
});

test("qualification retries transient reads", async () => {
  const fixture = fixtureRun();
  let read = 0;
  const result = await qualifyMergeBack({
    baseSha, publishSha, mergeBackSha, run: fixture.run,
    readRuns: async () => {
      read += 1;
      if (read === 1) return [];
      if (read === 2) throw new Error("temporary API failure");
      return [qualityRun()];
    },
    readJobs: async () => successfulJobs(),
    pause: async () => {},
    correlation,
  });
  assert.equal(result.runId, "901");
});

test("qualification rejects ambiguous, cancelled, and failed dispatches", async (t) => {
  for (const [name, runs, pattern] of [
    ["ambiguous", [qualityRun(), qualityRun({ id: 902 })], /ambiguous newly dispatched/],
    ["cancelled", [qualityRun({ conclusion: "cancelled" })], /concluded cancelled/],
    ["failed", [qualityRun({ conclusion: "failure" })], /concluded failure/],
  ]) {
    await t.test(name, async () => {
      const fixture = fixtureRun();
      let first = true;
      await assert.rejects(() => qualifyMergeBack({
        baseSha, publishSha, mergeBackSha, run: fixture.run,
        readRuns: async () => first ? (first = false, []) : runs,
        readJobs: async () => successfulJobs(),
        pause: async () => {},
        correlation,
      }), pattern);
    });
  }
});

test("qualification fails when the exact run never appears", async () => {
  const fixture = fixtureRun();
  let clock = 0;
  await assert.rejects(() => qualifyMergeBack({
    baseSha, publishSha, mergeBackSha, run: fixture.run,
    readRuns: async () => [],
    readJobs: async () => successfulJobs(),
    pause: async () => { clock += 10; },
    timeoutMs: 10,
    now: () => clock,
    correlation,
  }), /Quality did not finish/);
});

test("full Quality verification rejects missing, duplicate, incomplete, skipped, and failed jobs", async (t) => {
  await verifyFullQualityJobs({ item: qualityRun(), jobs: successfulJobs() });
  const target = requiredJobNames[0];
  for (const [name, mutate, pattern] of [
    ["missing", (jobs) => jobs.filter((job) => job.name !== target), /missing or ambiguous/],
    ["duplicate", (jobs) => [...jobs, { ...jobs[0], id: 999 }], /missing or ambiguous/],
    ["incomplete", (jobs) => jobs.map((job) => job.name === target ? { ...job, status: "in_progress", conclusion: null } : job), /did not finish/],
    ["skipped", (jobs) => jobs.map((job) => job.name === target ? { ...job, conclusion: "skipped" } : job), /did not pass/],
    ["failed", (jobs) => jobs.map((job) => job.name === target ? { ...job, conclusion: "failure" } : job), /did not pass/],
  ]) {
    await t.test(name, async () => {
      await assert.rejects(() => verifyFullQualityJobs({ item: qualityRun(), jobs: mutate(successfulJobs()) }), pattern);
    });
  }
});
