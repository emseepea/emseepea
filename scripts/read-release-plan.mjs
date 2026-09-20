#!/usr/bin/env node

// ADR-0098 step 3. Reads what this release publishes, for the promotion
// workflow. The release plan already contains the answer; this reads it out.
//
// `released` is true when any publishable package's version is not yet on the
// registry under `latest`. `website` is true when the website is part of this
// release, which ADR-0099 makes the condition for deploying it.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { publishablePackages } from "./public-packages.mjs";

const exec = promisify(execFile);

async function execute(command, args) {
  const { stdout } = await exec(command, args, { encoding: "utf8" });
  return stdout.trim();
}

/**
 * The website is a private workspace package that changesets versions without
 * publishing. It is in a release exactly when its version changed on this
 * commit, which is what a changeset naming it produces.
 */
export async function websiteInRelease({ run = execute, sha = "HEAD" } = {}) {
  const current = JSON.parse(await readFile("website/package.json", "utf8")).version;
  let previous;
  try {
    previous = JSON.parse(await run("git", ["show", `${sha}^1:website/package.json`])).version;
  } catch {
    return false;
  }
  return current !== previous;
}

export async function readReleasePlan({ run = execute, readLatest } = {}) {
  const packages = await publishablePackages();
  const versions = await Promise.all(packages.map(async ({ name, path }) => ({
    name,
    version: JSON.parse(await readFile(`${path}/package.json`, "utf8")).version,
  })));
  const resolve = readLatest ?? (async (name) => {
    try {
      return await run("npm", ["view", `${name}@latest`, "version", "--userconfig", "/dev/null"]);
    } catch {
      return undefined;
    }
  });
  const pending = [];
  for (const { name, version } of versions) {
    if (await resolve(name) !== version) pending.push(`${name}@${version}`);
  }
  return { released: pending.length > 0, pending };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { released, pending } = await readReleasePlan();
  const website = await websiteInRelease();
  assert.ok(process.env.GITHUB_SHA === undefined || /^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA));
  process.stdout.write(`released=${released}\n`);
  process.stdout.write(`website=${website}\n`);
  process.stdout.write(`pending=${pending.join(" ")}\n`);
  // The release pull request recorded which quality run measured this release
  // (ADR-0099); the publish branch cannot find it any other way.
  let origin = {};
  try {
    origin = JSON.parse(await readFile(".release/origin.json", "utf8"));
  } catch {
    assert.equal(website, false, "the website is in this release but .release/origin.json is missing");
  }
  process.stdout.write(`quality_run_id=${origin.qualityRunId ?? ""}\n`);
  process.stdout.write(`origin_sha=${origin.sha ?? ""}\n`);
}
