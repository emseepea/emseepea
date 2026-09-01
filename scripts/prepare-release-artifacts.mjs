#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { assertPackedTargets } from "./verify-packed-package.mjs";
import { publishablePackages } from "./public-packages.mjs";

const run = promisify(execFile);
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();

async function main() {
  const destination = resolve(process.argv[2] ?? "release-artifacts");
  await mkdir(destination, { recursive: true });
  const packages = [];
  for (const item of await publishablePackages()) {
    const { stdout } = await run("npm", [
      "pack", "--workspace", item.name, "--pack-destination", destination, "--ignore-scripts", "--json",
    ], { maxBuffer: 16 * 1024 * 1024 });
    const packed = JSON.parse(stdout);
    assert.equal(packed.length, 1, `${item.name} produced more than one tarball`);
    assertPackedTargets(item.manifest, packed[0]);
    await writeFile(join(destination, `${item.key}-pack.json`), `${JSON.stringify(packed, null, 2)}\n`);

    const sbom = await run("npm", [
      "sbom", "--workspace", item.name, "--omit=dev", "--package-lock-only",
      "--sbom-format", "cyclonedx", "--sbom-type", "framework",
    ], { maxBuffer: 16 * 1024 * 1024 });
    const sbomFile = `${item.key}-sbom.cdx.json`;
    await writeFile(join(destination, sbomFile), sbom.stdout);
    const changelog = await readFile(join(item.path, "CHANGELOG.md"), "utf8");
    const releaseNotes = extractReleaseNotes(changelog, item.manifest.version, `${item.path}/CHANGELOG.md`);
    const notesFile = `${item.key}-release-notes.md`;
    await writeFile(join(destination, notesFile), releaseNotes);
    packages.push({
      name: item.name,
      path: item.path,
      key: item.key,
      version: item.manifest.version,
      filename: packed[0].filename,
      sbomFile,
      notesFile,
      init: item.example ? `@emseepea/${item.name.split("/create-")[1]}` : "",
      example: item.example ?? "",
    });
  }

  const checksums = [];
  for (const item of packages) {
    const contents = await readFile(join(destination, item.filename));
    checksums.push(`${createHash("sha256").update(contents).digest("hex")}  ${item.filename}`);
  }
  await writeFile(join(destination, "SHA256SUMS"), `${checksums.join("\n")}\n`);
  await writeFile(join(destination, "packages.json"), `${JSON.stringify(packages, null, 2)}\n`);
}

export function extractReleaseNotes(changelog, version, path = "CHANGELOG.md") {
  const start = changelog.indexOf(`## ${version}`);
  assert.notEqual(start, -1, `${path} has no ${version} release notes`);
  const next = changelog.indexOf("\n## ", start + 4);
  return `${changelog.slice(start, next < 0 ? undefined : next).trim()}\n`;
}
