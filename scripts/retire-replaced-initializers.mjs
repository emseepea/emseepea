#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { initializerPackages } from "./public-packages.mjs";

const exec = promisify(execFile);

async function execute(command, args) {
  const { stdout } = await exec(command, args, { encoding: "utf8", timeout: 120_000 });
  return stdout.trim();
}

export async function retireReplacedInitializers({
  run = execute,
  pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  for (const replacement of initializerPackages.filter(({ replaces }) => replaces)) {
    const { name, deprecation } = replacement.replaces;
    assert.equal(typeof JSON.parse(await view(run, replacement.name, "version")), "string",
      `${replacement.name} must be published before ${name} is retired`);
    let versions;
    try {
      versions = JSON.parse(await view(run, name, "versions"));
    } catch (error) {
      if (isNotFound(error)) continue;
      throw error;
    }
    const publishedVersions = Array.isArray(versions) ? versions : [versions];
    assert.ok(publishedVersions.length > 0, `${name} has no published versions`);

    const current = await Promise.all(publishedVersions.map(async (version) => (
      readDeprecation(run, `${name}@${version}`)
    )));
    if (current.every((message) => message === deprecation)) continue;

    await run("npm", ["deprecate", `${name}@*`, deprecation]);
    for (const version of publishedVersions) {
      await waitForDeprecation(run, `${name}@${version}`, deprecation, pause);
    }
  }
}

function isNotFound(error) {
  return /(?:E404|404 Not Found)/.test(`${error?.message ?? error}\n${error?.stderr ?? ""}`);
}

function view(run, spec, field) {
  return run("npm", ["view", spec, field, "--json", "--userconfig", "/dev/null"]);
}

async function readDeprecation(run, spec) {
  const output = await view(run, spec, "deprecated");
  return output ? JSON.parse(output) : "";
}

async function waitForDeprecation(run, spec, expected, pause) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    if (await readDeprecation(run, spec) === expected) return;
    if (attempt < 20) await pause(3_000);
  }
  assert.fail(`${spec} deprecation was not visible in the npm registry`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await retireReplacedInitializers();
}
