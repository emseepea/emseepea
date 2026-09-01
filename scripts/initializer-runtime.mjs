#!/usr/bin/env node

import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

const [destination, ...extra] = process.argv.slice(2);
if (extra.length > 0 || !destination || !/^[a-z0-9][a-z0-9._-]*$/.test(destination)) {
  throw new Error("Provide one simple lowercase destination name, such as my-server");
}

const target = resolve(destination);
if (basename(target) !== destination) throw new Error("The destination must not contain a path");
const staging = await mkdtemp(join(dirname(target), ".emseepea-create-"));

try {
  await copyContents(new URL("./template/", import.meta.url), staging);
  const manifestPath = resolve(staging, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  await writeFile(manifestPath, `${JSON.stringify({ ...manifest, name: destination }, null, 2)}\n`);
  await mkdir(target);
  try {
    await copyContents(staging, target);
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }
} catch (error) {
  if (["EEXIST", "ENOTEMPTY"].includes(error.code)) {
    throw new Error(`The destination already exists: ${destination}`);
  }
  throw error;
} finally {
  await rm(staging, { recursive: true, force: true });
}

async function copyContents(source, destination) {
  for (const entry of await readdir(source)) {
    const from = source instanceof URL ? new URL(entry, source) : join(source, entry);
    await cp(from, join(destination, entry), { recursive: true, errorOnExist: true, force: false });
  }
}

console.log(`Created ${destination}.`);
console.log(`Next: cd ${destination}; npm install; npm test; npm start`);
