#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const repository = "emseepea/emseepea";

async function execute(command, args) {
  const { stdout } = await exec(command, args, { encoding: "utf8" });
  return stdout.trim();
}

export async function pushAndWatch({
  run = execute,
  pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = 300_000,
} = {}) {
  assert.match(
    await run("git", ["remote", "get-url", "origin"]),
    /^(?:https:\/\/github\.com\/|git@github\.com:)emseepea\/emseepea(?:\.git)?$/,
  );
  const sha = await run("git", ["rev-parse", "HEAD"]);
  assert.match(sha, /^[a-f0-9]{40}$/);

  await run("git", ["push", "origin", `${sha}:refs/heads/main`]);
  const remote = await run("git", ["ls-remote", "origin", "refs/heads/main"]);
  assert.equal(remote.split("\t")[0], sha, "origin/main does not match the pushed commit");

  const urls = [];
  for (const workflow of ["quality.yml", "release.yml"]) {
    const deadline = Date.now() + timeoutMs;
    const watched = new Set();
    while (true) {
      const listed = JSON.parse(await run("gh", [
        "run", "list", "--repo", repository, "--workflow", workflow,
        "--commit", sha, "--limit", "100", "--json", "attempt,databaseId,headSha,url",
      ]) || "[]");
      assert.notEqual(listed.length, 100, `${workflow} run list reached its safety limit`);
      const runs = listed.filter(({ headSha }) => headSha === sha);
      if (runs.length === 0) {
        assert.ok(Date.now() < deadline, `${workflow} did not start for ${sha}`);
        await pause(3_000);
        continue;
      }
      const unseen = runs
        .filter(({ attempt, databaseId }) => !watched.has(`${databaseId}:${attempt}`))
        .sort((left, right) => left.databaseId - right.databaseId || left.attempt - right.attempt);
      if (unseen.length === 0) break;
      for (const item of unseen) {
        await run("gh", ["run", "watch", String(item.databaseId), "--repo", repository, "--exit-status"]);
        watched.add(`${item.databaseId}:${item.attempt}`);
        urls.push(item.url);
      }
    }
  }
  return { sha, urls };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await pushAndWatch();
  for (const url of result.urls) console.log(url);
}
