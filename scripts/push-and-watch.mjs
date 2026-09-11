#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const repository = "emseepea/emseepea";
const pollIntervalMs = 30_000;

async function execute(command, args, { timeoutMs, env } = {}) {
  const { stdout } = await exec(command, args, { encoding: "utf8", timeout: timeoutMs, env });
  return stdout.trim();
}

export async function pushAndWatch({
  run = execute,
  pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = 3_600_000,
} = {}) {
  assert.match(
    await run("git", ["remote", "get-url", "origin"]),
    /^(?:https:\/\/github\.com\/|git@github\.com:)emseepea\/emseepea(?:\.git)?$/,
  );
  assert.equal(
    await run("git", ["status", "--porcelain=v1", "--untracked-files=all"]),
    "",
    "push:watch requires a clean checkout",
  );
  const sha = await run("git", ["rev-parse", "HEAD"]);
  assert.match(sha, /^[a-f0-9]{40}$/);

  await run("git", ["fetch", "origin", "main"]);
  await run(process.execPath, ["--test", "tests/docs/published-content-review.test.mjs"], {
    env: { ...process.env, GITHUB_BASE_REF: "main" },
  });
  await run("git", ["push", "origin", `${sha}:refs/heads/main`]);
  const remote = await run("git", ["ls-remote", "origin", "refs/heads/main"]);
  assert.equal(remote.split("\t")[0], sha, "origin/main does not match the pushed commit");

  return { sha, urls: await watchWorkflowRuns({ sha, run, pause, timeoutMs }) };
}

export async function watchWorkflowRuns({
  sha,
  run = execute,
  pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = 3_600_000,
}) {
  assert.match(sha, /^[a-f0-9]{40}$/);
  const urls = [];
  for (const workflow of ["quality.yml", "release.yml"]) {
    const deadline = Date.now() + timeoutMs;
    const watched = new Set();
    while (true) {
      let listed;
      try {
        listed = JSON.parse(await run("gh", [
          "run", "list", "--repo", repository, "--workflow", workflow,
          "--commit", sha, "--limit", "100", "--json", "attempt,conclusion,databaseId,headSha,url",
        ], { timeoutMs: Math.min(30_000, Math.max(1, deadline - Date.now())) }) || "[]");
      } catch (error) {
        if (Date.now() >= deadline) throw error;
        await pause(pollIntervalMs);
        continue;
      }
      assert.notEqual(listed.length, 100, `${workflow} run list reached its safety limit`);
      const runs = listed.filter(({ conclusion, headSha }) => headSha === sha
        && (workflow !== "release.yml" || conclusion !== "skipped"));
      if (runs.length === 0) {
        assert.ok(Date.now() < deadline, `${workflow} did not start for ${sha}`);
        await pause(pollIntervalMs);
        continue;
      }
      const unseen = runs
        .filter(({ attempt, databaseId }) => !watched.has(`${databaseId}:${attempt}`))
        .sort((left, right) => left.databaseId - right.databaseId || left.attempt - right.attempt);
      if (unseen.length === 0) break;
      for (const item of unseen) {
        await waitForWorkflowRun({ item, workflow, run, pause, deadline });
        watched.add(`${item.databaseId}:${item.attempt}`);
        urls.push(item.url);
      }
    }
  }
  return urls;
}

async function waitForWorkflowRun({ item, workflow, run, pause, deadline }) {
  while (true) {
    assert.ok(Date.now() < deadline, `${workflow} did not finish within the timeout`);
    let state;
    try {
      state = JSON.parse(await run("gh", [
        "run", "view", String(item.databaseId), "--repo", repository,
        "--attempt", String(item.attempt), "--json", "status,conclusion",
      ], { timeoutMs: Math.min(30_000, Math.max(1, deadline - Date.now())) }) || "{}");
    } catch (error) {
      if (Date.now() >= deadline) throw error;
    }
    if (state?.status === "completed") {
      assert.equal(state.conclusion, "success", `${workflow} concluded ${state.conclusion || "without a result"}`);
      return;
    }
    await pause(pollIntervalMs);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await pushAndWatch();
  for (const url of result.urls) console.log(url);
}
