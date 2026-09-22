#!/usr/bin/env node

// ADR-0098: the release pull request publishes under `next`; merging it into
// `publish` promotes those exact tarballs to `latest`. Nothing is rebuilt and
// nothing is republished, which is what keeps the published commit and the
// built commit the same.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { publishablePackages } from "./public-packages.mjs";
import { releaseVersionContext } from "./release-version-context.mjs";

const exec = promisify(execFile);

async function execute(command, args) {
  const { stdout } = await exec(command, args, { encoding: "utf8" });
  return stdout.trim();
}

const readTag = (run) => async (name, version, tag) => {
  try {
    return await run("npm", ["view", `${name}@${tag}`, "version", "--userconfig", "/dev/null"]);
  } catch {
    return undefined;
  }
};

export async function promoteRelease({
  packages,
  run = execute,
  readNextTag,
  readLatestTag,
  changedPackages = new Set(packages.map(({ name }) => name)),
} = {}) {
  const read = readTag(run);
  const resolveNext = readNextTag ?? ((name, version) => read(name, version, "next"));
  const resolveLatest = readLatestTag ?? ((name, version) => read(name, version, "latest"));

  // Check the whole set before moving anything. A version that never reached
  // `next` was never built or verified by the release pull request, and
  // promoting it would put unchecked bytes on `latest`.
  const missing = [];
  const latest = new Map();
  for (const { name, version } of packages) {
    latest.set(name, await resolveLatest(name, version));
    if (!changedPackages.has(name) && latest.get(name) === version) continue;
    const onNext = await resolveNext(name, version);
    if (onNext !== version) missing.push(`${name}@${version} is not on next (next is ${onNext})`);
  }
  assert.deepEqual(missing, [], missing.join("; "));

  for (const { name, version } of packages) {
    if (latest.get(name) === version) continue;
    await run("npm", ["dist-tag", "add", `${name}@${version}`, "latest"]);
  }
}

export async function releasePackages(cwd = process.cwd()) {
  return Promise.all((await publishablePackages()).map(async ({ name, path }) => ({
    name,
    version: JSON.parse(await readFile(new URL(`${path}/package.json`, pathToFileURL(`${cwd}/`)), "utf8")).version,
  })));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { changedPackages } = await releaseVersionContext();
  await promoteRelease({ packages: await releasePackages(), changedPackages });
}
