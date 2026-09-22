#!/usr/bin/env node

// ADR-0098 step 3. Reads what this release publishes, for the promotion
// workflow. The release plan already contains the answer; this reads it out.
//
// Release intent comes from the checked source, not mutable npm tags. A retry
// still has work to verify and record after every tag has reached `latest`.

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
export async function websiteInRelease({ run = execute, sha } = {}) {
  const current = JSON.parse(await readFile("website/package.json", "utf8")).version;
  const previous = JSON.parse(await run("git", ["show", `${sha}:website/package.json`])).version;
  return current !== previous;
}

export async function readReleasePlan({ run = execute, readLatest } = {}) {
  const origin = JSON.parse(await readFile(".release/origin.json", "utf8"));
  assert.match(origin.sha, /^[a-f0-9]{40}$/, "release origin is missing");
  const packages = await publishablePackages();
  const versions = await Promise.all(packages.map(async ({ name, path }) => ({
    name,
    path,
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
  let changed = false;
  for (const { name, path, version } of versions) {
    let previous;
    try {
      previous = JSON.parse(await run("git", ["show", `${origin.sha}:${path}/package.json`])).version;
    } catch (error) {
      if (!/fatal: path .* does not exist in |fatal: path .* exists on disk, but not in /.test(error.stderr ?? "")) throw error;
    }
    if (previous !== version) changed = true;
    if (await resolve(name) !== version) pending.push(`${name}@${version}`);
  }
  const website = await websiteInRelease({ run, sha: origin.sha });
  return { released: changed || website, website, pending };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { released, website, pending } = await readReleasePlan();
  assert.ok(process.env.GITHUB_SHA === undefined || /^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA));
  process.stdout.write(`released=${released}\n`);
  process.stdout.write(`website=${website}\n`);
  process.stdout.write(`pending=${pending.join(" ")}\n`);
  // The release pull request recorded which quality run measured this release
  // (ADR-0099); the publish branch cannot find it any other way.
  const origin = JSON.parse(await readFile(".release/origin.json", "utf8"));
  process.stdout.write(`quality_run_id=${origin.qualityRunId ?? ""}\n`);
  process.stdout.write(`origin_sha=${origin.sha ?? ""}\n`);
}
