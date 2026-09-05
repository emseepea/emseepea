#!/usr/bin/env node

import assert from "node:assert/strict";
import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function useRegistryTarballs(releaseDirectory, registryDirectory) {
  const names = (await readdir(registryDirectory)).filter((name) => name.endsWith(".tgz")).sort();
  assert.ok(names.length > 0, "no registry tarballs were downloaded");
  const checksums = [];
  for (const name of names) {
    assert.equal(basename(name), name, "registry tarball name is unsafe");
    const source = join(registryDirectory, name);
    const destination = join(releaseDirectory, name);
    await copyFile(source, destination);
    checksums.push(`${createHash("sha256").update(await readFile(destination)).digest("hex")}  ${name}`);
  }
  await writeFile(join(releaseDirectory, "SHA256SUMS"), `${checksums.join("\n")}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [releaseDirectory, registryDirectory] = process.argv.slice(2).map((path) => resolve(path));
  assert.ok(releaseDirectory && registryDirectory, "usage: use-registry-tarballs <release-directory> <registry-directory>");
  await useRegistryTarballs(releaseDirectory, registryDirectory);
}
