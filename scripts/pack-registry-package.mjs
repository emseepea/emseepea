#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function packRegistryPackage(spec, destination, options = {}) {
  assert.match(spec, /^@emseepea\/[a-z0-9-]+@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  const run = options.run ?? runNpmPack;
  const wait = options.wait ?? (() => new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000)));
  let failure;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      await run(spec, destination);
      return;
    } catch (error) {
      failure = error;
      if (attempt < 10) await wait();
    }
  }
  throw failure;
}

function runNpmPack(spec, destination) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn("npm", [
      "pack", spec, "--pack-destination", destination, "--ignore-scripts", "--userconfig", "/dev/null",
    ], { stdio: "inherit" });
    child.once("error", rejectRun);
    child.once("close", (code) => code === 0 ? resolveRun() : rejectRun(new Error(`npm pack exited ${String(code)}`)));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [spec, destination] = process.argv.slice(2);
  assert.ok(spec && destination, "usage: pack-registry-package <name@version> <destination>");
  await packRegistryPackage(spec, resolve(destination));
}
