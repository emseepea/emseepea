#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { initializerPackages } from "./public-packages.mjs";

const exec = promisify(execFile);

async function execute(command, args, cwd) {
  await exec(command, args, {
    cwd,
    env: { ...process.env, npm_config_yes: "true" },
    timeout: 900_000,
  });
}

export async function verifyRegistryInitializers({ run = execute, root = process.cwd() } = {}) {
  await run("npx", ["playwright", "install", "--with-deps", "chromium"], root);
  const queue = [...initializerPackages];
  const verify = async (initializer) => {
    const parent = await mkdtemp(join(tmpdir(), "emseepea-registry-initializer-"));
    const project = join(parent, "my-server");
    const init = `@emseepea/${initializer.name.split("/create-")[1]}`;
    try {
      await run("npm", ["init", init, "--", "my-server"], parent);
      await run("npm", ["install", "--ignore-scripts", "--userconfig", "/dev/null"], project);
      await run("npm", ["run", "lint"], project);
      await run("npm", ["test"], project);
      await run("npx", [
        "--no-install", "emseepea-test", "--smoke",
        "--model-command", join(root, "tests/fixtures/fake-semantic-model.mjs"),
        "--output", "artifacts/smoke.json", "eval",
      ], project);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  };

  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length > 0) await verify(queue.shift());
  });
  const results = await Promise.allSettled(workers);
  const failures = results.filter(({ status }) => status === "rejected").map(({ reason }) => reason);
  if (failures.length > 0) throw new AggregateError(failures, "registry initializer verification failed");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await verifyRegistryInitializers();
}
