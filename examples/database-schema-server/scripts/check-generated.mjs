import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

import { processDatabase } from "kanel";
import config from "../kanel.config.cjs";

const generated = new URL("../src/generated/", import.meta.url);
const before = await snapshot(generated);
assert.ok(Object.keys(before).length > 0, "checked-in generated files are missing");
await processDatabase(config);
assert.deepEqual(await snapshot(generated), before, "database-generated files are stale");

async function snapshot(directory, prefix = "") {
  const result = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) Object.assign(result, await snapshot(path, `${name}/`));
    else result[name] = await readFile(path, "utf8");
  }
  return result;
}
