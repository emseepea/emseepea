#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function assertReleaseReadiness(registryBefore, review) {
  const pending = registryBefore.packages
    .filter(({ present }) => !present)
    .map(({ name, version }) => `${name}@${version}`)
    .sort();
  if (pending.length === 0) return;
  assert.match(review, /^- Result: PASS$/m);
  assert.match(review, /^- Final result: within appetite\.$/m);
  const reviewed = [...review.matchAll(/^- `([^`]+@[^`]+)`$/gm)]
    .map(([, spec]) => spec)
    .sort();
  assert.deepEqual(reviewed, pending, "release-readiness package set does not match publication");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [registryPath, reviewPath] = process.argv.slice(2);
  if (!registryPath || !reviewPath) {
    throw new Error("Usage: verify-release-readiness <registry-before.json> <review.md>");
  }
  assertReleaseReadiness(
    JSON.parse(await readFile(registryPath, "utf8")),
    await readFile(reviewPath, "utf8"),
  );
}
