#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { docsOnly } from "./docs-only-changes.mjs";

const exec = promisify(execFile);
const oidPattern = /^[a-f0-9]{40}$/;
const zeroOid = "0".repeat(40);

async function run(command, args, options = {}) {
  const { stdout } = await exec(command, args, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024, ...options });
  return stdout.trim();
}

async function evidencePath(sha) {
  return run("git", ["rev-parse", "--git-path", `emseepea-qualified/${sha}`]);
}

async function docsRange(sha) {
  try {
    const remote = await run("git", ["remote", "get-url", "origin"]);
    await run("git", ["fetch", "origin", "refs/heads/main"]);
    const base = await run("git", ["rev-parse", "FETCH_HEAD"]);
    return await docsOnly(base, sha) ? { route: "docs", sha, base, remote } : undefined;
  } catch {
    return undefined;
  }
}

async function qualify() {
  assert.equal(await run("git", ["status", "--porcelain=v1", "--untracked-files=all"]), "", "qualification requires a clean checkout");
  const sha = await run("git", ["rev-parse", "HEAD"]);
  assert.match(sha, oidPattern);
  const docs = await docsRange(sha);
  if (docs) {
    console.log(`Checking documentation ${docs.base}..${sha} (no local Docker or dependency install)`);
    await run("git", ["diff", "--check", docs.base, sha]);
    const reviewEnv = { ...process.env, DOCS_REVIEW_BASE: docs.base };
    // A parent test runner's context must not suppress this independent runner.
    delete reviewEnv.NODE_TEST_CONTEXT;
    await run(process.execPath, ["--test", "tests/docs/published-content-review.test.mjs"], {
      env: reviewEnv,
    });
  } else {
    await run("npm", ["ci"]);
    await run("npm", ["test"]);
  }
  assert.equal(await run("git", ["rev-parse", "HEAD"]), sha, "HEAD changed during qualification");
  assert.equal(await run("git", ["status", "--porcelain=v1", "--untracked-files=all"]), "", "checkout changed during qualification");
  const marker = await evidencePath(sha);
  await mkdir(dirname(marker), { recursive: true });
  await writeFile(marker, docs ? `${JSON.stringify(docs)}\n` : `${sha}\n`);
  console.log(`Qualified ${sha}`);
}

async function check() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  for (const line of input.split("\n").filter(Boolean)) {
    const [, localOid, remoteRef, remoteOid] = line.split(/\s+/);
    assert.match(localOid ?? "", oidPattern, `invalid pre-push update: ${line}`);
    if (localOid === zeroOid) continue;
    const marker = await evidencePath(localOid);
    const evidence = await readFile(marker, "utf8").catch(() => "");
    if (evidence === `${localOid}\n`) continue;
    const docs = JSON.parse(evidence || "null");
    assert.ok(docs?.route === "docs" && docs.sha === localOid, `${localOid} is not qualified; run npm run push:qualify`);
    assert.equal(process.argv[3], "origin", "docs qualification is only valid for origin/main");
    assert.equal(process.argv[4], docs.remote, "docs qualification remote changed");
    assert.equal(await run("git", ["remote", "get-url", "origin"]), docs.remote, "docs qualification remote changed");
    assert.equal(remoteRef, "refs/heads/main", "docs qualification is only valid for origin/main");
    assert.equal(remoteOid, docs.base, "remote base changed; run npm run push:qualify again");
    assert.equal(await run("git", ["rev-parse", "HEAD"]), localOid, "docs qualification requires checked HEAD");
    assert.equal(await run("git", ["status", "--porcelain=v1", "--untracked-files=all"]), "", "docs qualification requires a clean checkout");
    assert.ok(await docsOnly(docs.base, localOid), "outgoing range is not docs-only");
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
