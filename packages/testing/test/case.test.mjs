import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateSemanticCase, checkMeaningEvidence } from "../semantic/case.mjs";
import { discoverTests } from "../semantic/discover.mjs";

const options = { server: new URL("./fake-model.mjs", import.meta.url), question: "What is the balance?",
  criteria: "An overdraft reduces available money.", criticalFacts: ["overdraft"],
  requiredPaths: ["tools/call:balance"], exercise: async () => {} };

test("every example ordinary-test command excludes the sibling eval directory", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "example-test-separation-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "test"));
  await mkdir(join(directory, "eval", "accounts"), { recursive: true });
  await writeFile(join(directory, "test", "ordinary.test.mjs"), 'import test from "node:test"; test("ordinary check", () => {});');
  const semanticFile = join(directory, "eval", "accounts", "meaning.test.mjs");
  await writeFile(semanticFile, 'throw new Error("Ordinary tests must not run LLM tests");');
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const examples = new URL("../../../examples/", import.meta.url);
  for (const entry of await readdir(examples, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = JSON.parse(await readFile(new URL(`${entry.name}/package.json`, examples), "utf8"));
    await writeFile(join(directory, "package.json"), JSON.stringify({ scripts: { "test:built": manifest.scripts["test:built"] } }));
    const result = spawnSync("npm", ["run", "test:built"], { cwd: directory, encoding: "utf8", env: environment });
    assert.equal(result.status, 0, `${entry.name}: ${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /ordinary check/, entry.name);
  }
  assert.deepEqual(await discoverTests([join(directory, "eval")]), [semanticFile]);
});

test("code-first cases require a callback, facts, and expected MCP paths", () => {
  assert.equal(typeof validateSemanticCase(options).exercise, "function");
  for (const key of ["server", "question", "criteria", "criticalFacts", "requiredPaths", "exercise"]) {
    assert.throws(() => validateSemanticCase({ ...options, [key]: undefined }));
  }
  assert.throws(() => validateSemanticCase({ ...options, criticalFacts: [] }));
  assert.throws(() => validateSemanticCase({ ...options, requiredPaths: [] }));
  assert.doesNotThrow(() => validateSemanticCase({ ...options, criticalFacts: [/overdraft/i] }));
  assert.throws(() => validateSemanticCase({ ...options, criticalFacts: [() => true] }));
});

test("missing facts and missing MCP calls fail even if a judge would approve", () => {
  const paths = [{ method: "tools/call", target: "balance" }];
  assert.doesNotThrow(() => checkMeaningEvidence(options, "The overdraft reduces available money", paths));
  const repeated = { ...options, criticalFacts: [/overdraft/gi] };
  repeated.criticalFacts[0].lastIndex = 100;
  for (let trial = 0; trial < 3; trial += 1) {
    assert.doesNotThrow(() => checkMeaningEvidence(repeated, "Overdraft", paths));
  }
  assert.throws(() => checkMeaningEvidence(options, "Everything is positive", paths), /required fact/);
  assert.throws(() => checkMeaningEvidence(options, "overdraft", []), /path evidence/);
  assert.throws(() => checkMeaningEvidence({ ...options, criticalFacts: ["overdraft", "PRIVATE_EXPECTED_FACT"] }, "overdraft", paths),
    (error) => {
      assert.equal(error.code, "missing-critical-facts");
      assert.deepEqual(error.missingFactIndices, [1]);
      assert.doesNotMatch(JSON.stringify(error) + error.message, /PRIVATE_EXPECTED_FACT/);
      return true;
    });
});

test("recursive discovery handles 100 nested cases without a central list", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "semantic-discovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "accounts"));
  await writeFile(join(directory, "accounts", "fixture.json"), "{}");
  for (let index = 0; index < 100; index += 1) {
    await writeFile(join(directory, "accounts", `balance-${index}.test.mjs`), "");
  }
  const files = await discoverTests([directory, directory]);
  assert.equal(files.length, 100);
  assert.deepEqual(files, [...files].sort());
  await assert.rejects(discoverTests([join(directory, "accounts", "fixture.json")]), /test.mjs/);
  const empty = await mkdtemp(join(tmpdir(), "semantic-empty-"));
  t.after(() => rm(empty, { recursive: true, force: true }));
  await assert.rejects(discoverTests([empty]), /No semantic/);
});
