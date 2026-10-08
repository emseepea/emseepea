#!/usr/bin/env node

// Changesets updates workspace dependency versions even when an initializer
// has no release planned. Its devDependencies become generated starter
// dependencies, so keep that initializer's manifest at the source revision.

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { promisify } from "node:util";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { initializerPackages, publicPackages } from "./public-packages.mjs";

const exec = promisify(execFile);

export async function freezeUnplannedInitializers({
  root = process.cwd(),
  initializers = initializerPackages,
  packages = publicPackages,
  sourceRef = process.env.GITHUB_SHA ?? "HEAD",
  restoreFromSource = false,
  readBase = async (path) => (await exec("git", ["show", `${sourceRef}:${path}`], { cwd: root })).stdout,
} = {}) {
  if (restoreFromSource && !/^[0-9a-f]{40}$/.test(sourceRef)) {
    throw new Error("recovery initializer restoration requires an exact source commit");
  }
  const packageByName = new Map(packages.map((item) => [item.name, item]));

  for (const initializer of initializers) {
    const path = `${initializer.path}/package.json`;
    const baseText = await readBase(path);
    const currentText = await readFile(join(root, path), "utf8");
    if (currentText === baseText) continue;

    const base = JSON.parse(baseText);
    const current = JSON.parse(currentText);
    if (current.version !== base.version) continue; // This initializer has its own release.

    const { devDependencies: baseDev = {}, ...baseRest } = base;
    const { devDependencies: currentDev = {}, ...currentRest } = current;
    if (!isDeepStrictEqual(currentRest, baseRest) ||
        !isDeepStrictEqual(Object.keys(currentDev).sort(), Object.keys(baseDev).sort())) {
      throw new Error(`${initializer.name}: unexpected change to an unplanned initializer manifest`);
    }

    for (const [name, version] of Object.entries(currentDev)) {
      if (version === baseDev[name]) continue;
      if (base.starterDependencies?.includes(name)) {
        throw new Error(`${initializer.name}: starter dependency ${name} changed without an initializer release`);
      }
      const dependency = packageByName.get(name);
      if (!dependency) {
        throw new Error(`${initializer.name}: unexpected dependency change to ${name}`);
      }
      if (restoreFromSource) continue;
      const dependencyPath = `${dependency.path}/package.json`;
      const dependencyBase = JSON.parse(await readBase(dependencyPath));
      const dependencyCurrent = JSON.parse(await readFile(join(root, dependencyPath), "utf8"));
      if (dependencyBase.version !== baseDev[name] ||
          dependencyCurrent.version !== version ||
          dependencyCurrent.version === dependencyBase.version) {
        throw new Error(`${initializer.name}: unexpected dependency change to ${name}`);
      }
    }

    await writeFile(join(root, path), baseText);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await freezeUnplannedInitializers();
}
