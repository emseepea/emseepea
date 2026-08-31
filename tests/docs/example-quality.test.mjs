import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { discoverTests } from "../../packages/testing/semantic/discover.mjs";
import { fileURLToPath } from "node:url";

const examplesRoot = new URL("../../examples/", import.meta.url);
const testingManifest = JSON.parse(await readFile(new URL("../../packages/testing/package.json", import.meta.url), "utf8"));

test("every runnable example visibly owns deterministic and LLM checks", async () => {
  const directories = await readdir(examplesRoot, { withFileTypes: true });
  for (const directory of directories.filter((entry) => entry.isDirectory())) {
    const manifestUrl = new URL(`${directory.name}/package.json`, examplesRoot);
    const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
    assert.ok(manifest.scripts?.test, `${directory.name} has no test command`);
    assert.ok(manifest.scripts?.["test:built"], `${directory.name} has no root-CI test command`);
    assert.doesNotMatch(manifest.scripts["test:built"], /\beval\b/, `${directory.name} ordinary tests must not run LLM tests`);
    assert.ok(manifest.scripts?.lint, `${directory.name} has no lint command`);
    assert.doesNotMatch(manifest.scripts.test, /\.\.\/\.\.|--prefix|-w\s/, `${directory.name} test depends on the monorepo`);
    assert.doesNotMatch(manifest.scripts.lint, /\.\.\/\.\.|--prefix|-w\s/, `${directory.name} lint depends on the monorepo`);
    assert.equal(manifest.devDependencies?.oxlint, "1.80.0");
    await access(new URL(`${directory.name}/test`, examplesRoot));

    if (!manifest.scripts.start) continue;
    assert.equal(manifest.devDependencies?.typescript, "6.0.3");
    assert.equal(manifest.devDependencies?.["@types/node"], "24.13.3");
    const tsconfig = await readFile(new URL(`${directory.name}/tsconfig.json`, examplesRoot), "utf8");
    assert.doesNotMatch(tsconfig, /\.\.\/\.\./, `${directory.name} TypeScript config depends on the monorepo`);
    assert.ok(manifest.scripts["test:llm"], `${directory.name} has no LLM test command`);
    assert.equal(manifest.devDependencies?.["@emseepea/testing"], testingManifest.version);
    assert.doesNotMatch(manifest.scripts["test:llm"], /\.\.\/\.\.|--prefix|-w\s/, `${directory.name} LLM test depends on the monorepo`);
    const cases = await discoverTests([fileURLToPath(new URL(`${directory.name}/eval`, examplesRoot))]);
    assert.ok(cases.length > 0);
    assert.equal(manifest.scripts["test:llm:built"], "emseepea-test eval");
    assert.match(manifest.scripts.lint, /\beval\b/);
    assert.ok(!(await readdir(new URL(directory.name + "/", examplesRoot))).some((name) => /eval.*\.ya?ml$/.test(name)));
  }
});
