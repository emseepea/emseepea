#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { initializerPackages } from "./public-packages.mjs";

const root = new URL("../", import.meta.url);
const expectedNode = (await readFile(new URL(".node-version", root), "utf8")).trim();
const pairs = await Promise.all(initializerPackages.map(async ({ example }) => {
  const dockerfile = await readFile(new URL(`examples/${example}/Dockerfile`, root), "utf8");
  const images = [...dockerfile.matchAll(/^FROM (\S+)(?: AS \S+)?$/gm)].map((match) => match[1]);
  assert.equal(images.length, 2, `${example} must use exactly two image stages`);
  assert.match(images[0], new RegExp(`^docker\\.io/library/node:${expectedNode.replaceAll(".", "\\.")}-`));
  return images;
}));
assert.deepEqual(new Set(pairs.map(([builder]) => builder)).size, 1, "builder base image drifted between examples");
assert.deepEqual(new Set(pairs.map(([, runtime]) => runtime)).size, 1, "runtime base image drifted between examples");
console.log(pairs[0][0]);
console.log(pairs[0][1]);
