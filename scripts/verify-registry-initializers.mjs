#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { publishablePackages } from "./public-packages.mjs";

const exec = promisify(execFile);

async function execute(command, args, cwd) {
  await exec(command, args, {
    cwd,
    env: { ...process.env, npm_config_yes: "true" },
    timeout: 1_500_000,
  });
}

export async function verifyRegistryInitializers({
  run = execute,
  root = process.cwd(),
  packages,
} = {}) {
  await run("npx", ["playwright", "install", "--with-deps", "chromium"], root);
  const queue = (packages ?? await publishablePackages(root)).filter(({ example }) => example);
  const projects = [];
  const verify = async (initializer) => {
    const parent = await mkdtemp(join(tmpdir(), "emseepea-registry-initializer-"));
    const project = join(parent, "my-server");
    projects.push({ initializer, parent, project });
    const init = `@emseepea/${initializer.name.split("/create-")[1]}`;
    await run("npm", ["init", init, "--", "my-server"], parent);
    await run("npm", ["install", "--ignore-scripts", "--userconfig", "/dev/null"], project);
    await run("npm", ["run", "lint"], project);
    await run("npm", ["test"], project);
    await run("npm", [
      "run", "test:llm:built", "--", "--smoke",
      "--model-command", join(root, "tests/fixtures/fake-semantic-model.mjs"),
      "--output", "artifacts/smoke.json",
    ], project);
  };

  try {
    const workers = Array.from({ length: 4 }, async () => {
      while (queue.length > 0) await verify(queue.shift());
    });
    const results = await Promise.allSettled(workers);
    const failures = results.filter(({ status }) => status === "rejected").map(({ reason }) => reason);
    if (failures.length > 0) throw new AggregateError(failures, "registry initializer verification failed");
    if (process.env.EMSEEPEA_VERIFY_CONTAINERS === "true") {
      for (const { initializer, project } of projects) {
        await run(process.execPath, [
          fileURLToPath(new URL("./verify-container-project.mjs", import.meta.url)),
          initializer.example,
          project,
          "-",
          "--registry-lock",
        ], root);
      }
    }
  } finally {
    await Promise.all(projects.map(({ parent }) => rm(parent, { recursive: true, force: true })));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await verifyRegistryInitializers();
}
