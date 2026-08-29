#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function assertPackedTargets(manifest, packResult) {
  const files = new Set(packResult.files.map(({ path }) => `./${path.replace(/^\.\//, "")}`));
  const targets = [
    ...collectTargets(manifest.exports),
    ...collectTargets(manifest.bin),
  ];
  assert.ok(targets.length > 0, `${manifest.name} has no exported or executable files`);
  for (const target of targets) {
    assert.ok(files.has(target), `${manifest.name} package is missing ${target}`);
  }
}

function collectTargets(value) {
  if (typeof value === "string") return value.startsWith("./") ? [value] : [];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectTargets);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [manifestPath, packResultPath] = process.argv.slice(2);
  if (!manifestPath || !packResultPath) {
    throw new Error("Usage: verify-packed-package <package.json> <npm-pack.json>");
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const packed = JSON.parse(await readFile(packResultPath, "utf8"));
  assert.equal(packed.length, 1, "npm pack must produce exactly one package");
  assertPackedTargets(manifest, packed[0]);
}
