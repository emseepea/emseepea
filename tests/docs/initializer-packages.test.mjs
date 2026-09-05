import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { initializerPackages, publicPackages, publishablePackages } from "../../scripts/public-packages.mjs";

const root = new URL("../../", import.meta.url);

test("the public package list and built initializers are complete", async () => {
  const rootReadme = await readFile(new URL("../../README.md", import.meta.url), "utf8");
  assert.equal(new Set(publicPackages.map(({ name }) => name)).size, publicPackages.length);
  assert.equal(new Set(publicPackages.map(({ path: packagePath }) => packagePath)).size, publicPackages.length);
  assert.deepEqual(initializerPackages.map(({ name }) => name), [
    "@emseepea/create-tool-server",
    "@emseepea/create-api-backed-server",
    "@emseepea/create-sign-in-tool-server",
    "@emseepea/create-resources-and-prompts-server",
    "@emseepea/create-progress-streaming-server",
    "@emseepea/create-html-ui-server",
    "@emseepea/create-react-ui-server",
    "@emseepea/create-multi-instance-sqlite-server",
  ]);
  assert.deepEqual((await publishablePackages()).map(({ name }) => name), [
    "@emseepea/server",
    "@emseepea/testing",
    "@emseepea/react",
    "@emseepea/tailwind",
    "@emseepea/create-tool-server",
    "@emseepea/create-api-backed-server",
    "@emseepea/create-sign-in-tool-server",
    "@emseepea/create-resources-and-prompts-server",
    "@emseepea/create-progress-streaming-server",
    "@emseepea/create-html-ui-server",
    "@emseepea/create-react-ui-server",
    "@emseepea/create-multi-instance-sqlite-server",
  ]);
  for (const initializer of initializerPackages) {
    const manifest = JSON.parse(await readFile(new URL(`${initializer.path}/package.json`, root), "utf8"));
    const template = JSON.parse(await readFile(new URL(`${initializer.path}/initializer-dist/template/package.json`, root), "utf8"));
    const readme = await readFile(new URL(`${initializer.path}/README.md`, root), "utf8");
    assert.match(initializer.path, /^examples\//, `${initializer.name} is not colocated with its example`);
    assert.equal(path.basename(initializer.path), initializer.name.split("/create-")[1]);
    assert.ok(rootReadme.includes(`](${initializer.path}/README.md)`));
    assert.match(readme, /^## Use This Template$/m);
    assert.match(readme, /^## Create a Project$/m);
    assert.equal(manifest.name, initializer.name);
    assert.equal(manifest.repository.directory, initializer.path);
    assert.equal(manifest.bin[initializer.key], "./initializer-dist/create.mjs");
    assert.equal(manifest.dependencies, undefined, `${initializer.name} installs unused generator dependencies`);
    assert.ok(manifest.starterDependencies.length > 0);
    await assert.rejects(access(new URL(`../../packages/${initializer.key}/package.json`, import.meta.url)));
    assert.equal(template.private, true);
    assert.equal(template.starterDependencies, undefined);
    for (const [name, version] of Object.entries({ ...template.dependencies, ...template.devDependencies })) {
      assert.ok(!name.startsWith("@emseepea/example-"), `${initializer.name} retains ${name}`);
      assert.doesNotMatch(version, /^(?:file:|workspace:|\.\.?[\\/])/);
    }
  }
});

test("an initializer rejects traversal and existing destinations without overwriting", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-initializer-safety-"));
  const executable = new URL("../../examples/tool-server/initializer-dist/create.mjs", import.meta.url);
  try {
    for (const destination of ["../escape", "nested/server", ".", "..", "/tmp/escape"]) {
      assert.notEqual(run(executable, destination, directory).status, 0, destination);
    }
    const existing = path.join(directory, "existing");
    await mkdir(existing);
    await writeFile(path.join(existing, "keep.txt"), "keep\n");
    assert.notEqual(run(executable, "existing", directory).status, 0);
    assert.equal(await readFile(path.join(existing, "keep.txt"), "utf8"), "keep\n");
    const empty = path.join(directory, "empty");
    await mkdir(empty);
    assert.notEqual(run(executable, "empty", directory).status, 0);
    assert.deepEqual(await readFileNames(empty), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function run(executable, destination, cwd) {
  return spawnSync(process.execPath, [executable, destination], { cwd, encoding: "utf8" });
}

async function readFileNames(directory) {
  const { readdir } = await import("node:fs/promises");
  return readdir(directory);
}
