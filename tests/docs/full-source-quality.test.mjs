import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";
import { assertFullSourceQuality, fullQualityJobNames } from "../../scripts/check-release-pull-request.mjs";

const workflowSource = await readFile(new URL("../../.github/workflows/quality.yml", import.meta.url), "utf8");
const source = "a".repeat(40);
const candidate = "b".repeat(40);
const quality = { head_sha: source, path: ".github/workflows/quality.yml", event: "push", head_branch: "main", run_attempt: 2, status: "completed", conclusion: "success" };
const jobs = fullQualityJobNames(parse(workflowSource)).map((name, index) => ({ id: index + 1, name, run_id: 123, head_sha: source, status: "completed", conclusion: "success" }));

function harness(overrides = {}) {
  const calls = [];
  let reads = 0;
  const run = async (command, args) => {
    calls.push([command, ...args]);
    if (command === "git") {
      if (args[1] === `${candidate}:.release/origin.json`) return JSON.stringify(overrides.origin ?? { sha: source, qualityRunId: "123" });
      if (args[1] === `${source}:.github/workflows/quality.yml`) return workflowSource;
    }
    if (args.at(-1).includes("/jobs?")) {
      assert.match(args.at(-1), /\/attempts\/2\/jobs\?per_page=100$/);
      assert.ok(args.includes("--paginate") && args.includes("--slurp"));
      return JSON.stringify(overrides.pages ?? [{ total_count: jobs.length, jobs: jobs.slice(0, 5) }, { total_count: jobs.length, jobs: jobs.slice(5) }]);
    }
    reads++;
    return JSON.stringify(reads === 2 ? overrides.current ?? overrides.quality ?? quality : overrides.quality ?? quality);
  };
  return { run, calls, qualityRunId: "123" };
}

test("release accepts only exact-source full Quality jobs and retrieves every current-attempt page", async () => {
  await assertFullSourceQuality(source, candidate, harness());
  const running = { ...quality, status: "in_progress", conclusion: null };
  await assertFullSourceQuality(source, candidate, { ...harness({ quality: running }), requireCompleted: false });
  await assert.rejects(() => assertFullSourceQuality(source, candidate, harness({ quality: running })));
});

test("docs-only success, skipped or stale jobs and incomplete pagination cannot authorize release", async () => {
  const pages = (items) => [{ total_count: items.length, jobs: items }];
  for (const override of [
    { pages: pages([{ id: 1, name: "Documentation review", run_id: 123, head_sha: source, status: "completed", conclusion: "success" }]) },
    { pages: pages(jobs.map((job, index) => index === 0 ? { ...job, conclusion: "skipped" } : job)) },
    { pages: pages(jobs.map((job, index) => index === 0 ? { ...job, conclusion: "failure" } : job)) },
    { pages: pages(jobs.map((job, index) => index === 0 ? { ...job, run_id: 124 } : job)) },
    { pages: pages(jobs.map((job, index) => index === 0 ? { ...job, head_sha: candidate } : job)) },
    { pages: [{ total_count: jobs.length, jobs: jobs.slice(0, 5) }] },
    { pages: pages([...jobs, jobs[0]]) },
    { pages: pages([...jobs, { ...jobs[0], id: 999 }]) },
    { origin: { sha: candidate, qualityRunId: "123" } },
    { origin: { sha: source, qualityRunId: "124" } },
    { quality: { ...quality, head_sha: candidate } },
    { quality: { ...quality, event: "pull_request" } },
    { quality: { ...quality, path: ".github/workflows/release.yml" } },
    { quality: { ...quality, head_branch: "publish" } },
    { quality: { ...quality, conclusion: "failure" } },
    { current: { ...quality, run_attempt: 3 } },
  ]) await assert.rejects(() => assertFullSourceQuality(source, candidate, harness(override)));
});
