#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function ensureReleaseTag(tag, sha, {
  repository = process.env.GITHUB_REPOSITORY,
  run = execFileSync,
} = {}) {
  assert.match(tag ?? "", /^\S+$/);
  assert.match(sha ?? "", /^[a-f0-9]{40}$/);
  assert.match(repository ?? "", /^[^/]+\/[^/]+$/);

  const target = () => {
    const output = String(run("git", [
      "ls-remote", "--tags", "origin", `refs/tags/${tag}^{}`, `refs/tags/${tag}`,
    ], { encoding: "utf8" }));
    const refs = new Map(output.trim().split("\n").filter(Boolean).map((line) => {
      const [hash, ref] = line.split("\t");
      return [ref, hash];
    }));
    return refs.get(`refs/tags/${tag}^{}`) ?? refs.get(`refs/tags/${tag}`) ?? "";
  };

  const existing = target();
  if (existing) {
    assert.equal(existing, sha);
  } else {
    run("gh", [
      "api", "--method", "POST", `repos/${repository}/git/refs`,
      "-f", `ref=refs/tags/${tag}`, "-f", `sha=${sha}`,
    ], { stdio: "ignore" });
  }
  assert.equal(target(), sha);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  ensureReleaseTag(process.argv[2], process.argv[3]);
}
