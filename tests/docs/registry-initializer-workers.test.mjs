import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { initializerPackages } from "../../scripts/public-packages.mjs";
import { verifyRegistryInitializers } from "../../scripts/verify-registry-initializers.mjs";

test("registry initializer verification uses four workers and preserves every check", async () => {
  const calls = [];
  let active = 0;
  let maximum = 0;
  const run = async (command, args, cwd) => {
    active += 1;
    maximum = Math.max(maximum, active);
    calls.push({ command, args, cwd });
    await new Promise((resolve) => setImmediate(resolve));
    active -= 1;
  };

  await verifyRegistryInitializers({ run, root: "/repo" });
  assert.equal(maximum, 4);
  assert.equal(calls.filter(({ command, args }) => command === "npx" && args[0] === "playwright").length, 1);
  const initializations = calls.filter(({ command, args }) => command === "npm" && args[0] === "init");
  assert.deepEqual(
    initializations.map(({ args }) => args[1]).sort(),
    initializerPackages.map(({ name }) => `@emseepea/${name.split("/create-")[1]}@next`).sort(),
  );
  for (const { cwd: parent } of initializations) {
    const project = join(parent, "my-server");
    assert.deepEqual(calls.filter(({ cwd }) => cwd === project).map(({ command, args }) => [command, ...args]), [
      ["npm", "install", "--ignore-scripts", "--userconfig", "/dev/null"],
      ["npm", "run", "lint"],
      ["npm", "test"],
      ["npx", "--no-install", "emseepea-test", "--smoke", "--model-command", "/repo/tests/fixtures/fake-semantic-model.mjs", "--output", "artifacts/smoke.json", "eval"],
    ]);
    await assert.rejects(() => access(parent));
  }
});

test("registry initializer verification propagates worker failure after cleanup", async () => {
  let failed = false;
  const parents = [];
  const run = async (command, args, cwd) => {
    if (command === "npm" && args[0] === "init") parents.push(cwd);
    if (!failed && args[0] === "test") {
      failed = true;
      throw new Error("initializer failed");
    }
  };
  await assert.rejects(() => verifyRegistryInitializers({ run }), /registry initializer verification failed/);
  for (const parent of parents) await assert.rejects(() => access(parent));
});
