import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { publishablePackages } from "../../scripts/public-packages.mjs";
import { verifyRegistryInitializers } from "../../scripts/verify-registry-initializers.mjs";

test("registry initializer verification uses four workers and preserves every check", async () => {
  const calls = [];
  let active = 0;
  let maximum = 0;
  let releaseInitializers;
  const initializersReady = new Promise((resolve) => { releaseInitializers = resolve; });
  const run = async (command, args, cwd) => {
    active += 1;
    maximum = Math.max(maximum, active);
    calls.push({ command, args, cwd });
    if (command === "npm" && args[0] === "init") {
      if (active === 4) releaseInitializers();
      await initializersReady;
    } else {
      await new Promise((resolve) => setImmediate(resolve));
    }
    active -= 1;
  };

  const initializers = (await publishablePackages()).filter(({ example }) => example);
  await verifyRegistryInitializers({ run, root: "/repo", packages: initializers });
  assert.equal(maximum, 4);
  assert.equal(calls.filter(({ command, args }) => command === "npx" && args[0] === "playwright").length, 1);
  const initializations = calls.filter(({ command, args }) => command === "npm" && args[0] === "init");
  assert.deepEqual(
    initializations.map(({ args }) => args[1]).sort(),
    initializers.map(({ name }) => `@emseepea/${name.split("/create-")[1]}`).sort(),
  );
  for (const { cwd: parent } of initializations) {
    const project = join(parent, "my-server");
    assert.deepEqual(calls.filter(({ cwd }) => cwd === project).map(({ command, args }) => [command, ...args]), [
      ["npm", "install", "--ignore-scripts", "--userconfig", "/dev/null"],
      ["npm", "run", "lint"],
      ["npm", "test"],
      ["npm", "run", "test:llm:built", "--", "--smoke", "--model-command", "/repo/tests/fixtures/fake-semantic-model.mjs", "--output", "artifacts/smoke.json"],
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

test("registry initializer verification can reuse container qualification", async (t) => {
  const previousVerify = process.env.EMSEEPEA_VERIFY_CONTAINERS;
  process.env.EMSEEPEA_VERIFY_CONTAINERS = "true";
  t.after(() => {
    if (previousVerify === undefined) delete process.env.EMSEEPEA_VERIFY_CONTAINERS;
    else process.env.EMSEEPEA_VERIFY_CONTAINERS = previousVerify;
  });

  const calls = [];
  let activeContainers = 0;
  let maximumContainers = 0;
  const run = async (command, args, cwd) => {
    calls.push({ command, args, cwd });
    if (command === process.execPath) {
      activeContainers += 1;
      maximumContainers = Math.max(maximumContainers, activeContainers);
      await new Promise((resolve) => setImmediate(resolve));
      activeContainers -= 1;
    }
  };
  await verifyRegistryInitializers({
    run,
    root: "/repo",
    packages: [
      { name: "@emseepea/create-tool-server", example: "tool-server" },
      { name: "@emseepea/create-api-backed-server", example: "api-backed-server" },
    ],
  });

  const containerChecks = calls.filter(({ command }) => command === process.execPath);
  assert.equal(containerChecks.length, 2);
  assert.equal(maximumContainers, 1);
  const containerCheck = containerChecks.find(({ args }) => args[1] === "tool-server");
  assert.ok(containerCheck);
  assert.equal(containerCheck.command, process.execPath);
  assert.equal(containerCheck.cwd, "/repo");
  assert.match(containerCheck.args[0], /\/scripts\/verify-container-project\.mjs$/);
  assert.equal(containerCheck.args[1], "tool-server");
  assert.equal(containerCheck.args[2], calls.find(({ command, args }) => command === "npm" && args[1] === "@emseepea/tool-server").cwd + "/my-server");
  assert.equal(containerCheck.args[3], "-");
  assert.equal(containerCheck.args[4], "--registry-lock");
});
