#!/usr/bin/env node

// Pairs each released package with the commit its provenance names, for the
// tagging and release-record step. This was inline in the retired release
// workflow; ADR-0098 moves the records to the promotion, which runs in a
// different job, so the pairing is written to a file that travels with the
// release artifacts.

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function releaseTargets(packages, registry) {
  return packages.map((item) => {
    const releaseSha = registry.packages.find(({ name }) => name === item.name)?.releaseSha;
    assert.ok(releaseSha, `${item.name} release commit is missing`);
    return [item.name, item.version, item.key, item.filename, item.sbomFile, item.notesFile, releaseSha].join("\t");
  });
}

export async function writeReleaseTargets(directory) {
  const packages = JSON.parse(await readFile(`${directory}/packages.json`, "utf8"));
  const registry = JSON.parse(await readFile(`${directory}/registry-after.json`, "utf8"));
  const targets = releaseTargets(packages, registry);
  await writeFile(`${directory}/release-targets.tsv`, `${targets.join("\n")}\n`);
  return targets;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [directory] = process.argv.slice(2);
  if (!directory) throw new Error("Usage: write-release-targets <release-artifacts-directory>");
  await writeReleaseTargets(directory);
}
