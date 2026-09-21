import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { publishablePackages } from "./public-packages.mjs";

const exec = promisify(execFile);
const execute = async (command, args) => (await exec(command, args, { encoding: "utf8" })).stdout.trim();

// The source-to-release manifest diff is immutable. Registry tags are not:
// after a partial promotion, a fresh package may already be on latest.
export async function releaseVersionContext({
  releaseSha = process.env.EMSEEPEA_RELEASE_SHA,
  read = readFile,
  run = execute,
  packages,
} = {}) {
  const releasePackages = packages ?? await publishablePackages();
  const { sha: baseSha } = JSON.parse(await read(".release/origin.json", "utf8"));
  assert.match(baseSha, /^[a-f0-9]{40}$/, "release source commit is missing");
  assert.match(releaseSha, /^[a-f0-9]{40}$/, "release pull request head is missing");
  await run("git", ["merge-base", "--is-ancestor", baseSha, releaseSha]);
  const paths = releasePackages.map(({ path }) => `${path}/package.json`);
  const changedPaths = new Set((await run("git", ["diff", "--name-only", baseSha, releaseSha, "--", ...paths])).split("\n").filter(Boolean));
  return {
    baseSha,
    releaseSha,
    changedPackages: new Set(releasePackages.filter(({ path }) => changedPaths.has(`${path}/package.json`)).map(({ name }) => name)),
  };
}
