#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const oidPattern = /^[a-f0-9]{40}$/;
const zeroOid = "0".repeat(40);

async function run(command, args) {
  const { stdout } = await exec(command, args, { encoding: "utf8" });
  return stdout.trim();
}

async function evidencePath(sha) {
  return run("git", ["rev-parse", "--git-path", `emseepea-qualified/${sha}`]);
}

async function qualify() {
  assert.equal(await run("git", ["status", "--porcelain=v1", "--untracked-files=all"]), "", "qualification requires a clean checkout");
  const sha = await run("git", ["rev-parse", "HEAD"]);
  assert.match(sha, oidPattern);
  await run("npm", ["ci"]);
  await run("npm", ["test"]);
  assert.equal(await run("git", ["rev-parse", "HEAD"]), sha, "HEAD changed during qualification");
  assert.equal(await run("git", ["status", "--porcelain=v1", "--untracked-files=all"]), "", "checkout changed during qualification");
  const marker = await evidencePath(sha);
  await mkdir(dirname(marker), { recursive: true });
  await writeFile(marker, `${sha}\n`);
  console.log(`Qualified ${sha}`);
}

async function check() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  for (const line of input.split("\n").filter(Boolean)) {
    const [, localOid] = line.split(/\s+/);
    assert.match(localOid ?? "", oidPattern, `invalid pre-push update: ${line}`);
    if (localOid === zeroOid) continue;
    const marker = await evidencePath(localOid);
    const evidence = await readFile(marker, "utf8").catch(() => "");
    assert.equal(evidence, `${localOid}\n`, `${localOid} is not qualified; run npm run push:qualify`);
  }
}

async function install() {
  const hook = ".githooks/pre-push";
  assert.ok((await stat(hook)).mode & 0o111, `${hook} is not executable`);
  await run("git", ["config", "--local", "core.hooksPath", ".githooks"]);
  console.log("Installed repository Git hooks");
}

const actions = { check, install, qualify };
const action = actions[process.argv[2]];
assert.ok(action, "usage: branch-push-gate.mjs <check|install|qualify>");
await action();
