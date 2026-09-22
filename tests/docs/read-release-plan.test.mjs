import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { publishablePackages } from "../../scripts/public-packages.mjs";
import { readReleasePlan } from "../../scripts/read-release-plan.mjs";

test("a checked release remains eligible after every latest tag has moved", async () => {
  const versions = new Map(await Promise.all((await publishablePackages()).map(async ({ name, path }) => [
    name,
    JSON.parse(await readFile(`${path}/package.json`, "utf8")).version,
  ])));
  const plan = await readReleasePlan({
    readLatest: async (name) => versions.get(name),
    run: async (command, args) => {
      assert.equal(command, "git");
      assert.equal(args[0], "show");
      return JSON.stringify({ version: "0.0.0" });
    },
  });
  assert.equal(plan.released, true);
  assert.deepEqual(plan.pending, []);
});
