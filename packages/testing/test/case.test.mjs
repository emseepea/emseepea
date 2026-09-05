import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  parseToolSelection,
  validateConversationOptions,
} from "../semantic/case.mjs";
import { discoverTests } from "../semantic/discover.mjs";

const options = { server: new URL("./fake-model.mjs", import.meta.url) };

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

test("conversation options keep context optional and credentials exclusive", () => {
  assert.equal(validateConversationOptions(options).context, undefined);
  assert.equal(validateConversationOptions({ ...options, context: "" }).context, "");
  assert.throws(() => validateConversationOptions({ ...options, context: 42 }), /context/);
  assert.throws(() => validateConversationOptions({ ...options, server: new URL("https://example.com") }), /file URL/);
  assert.throws(() => validateConversationOptions({
    ...options,
    authToken: "token",
    authTokenEnvironment: "TOKEN",
  }), /Choose one/);
});

test("tool selections allow no call and reject unknown, malformed, and over-limit calls", () => {
  const tools = [{ name: "balance", description: "Read the balance.", inputSchema: { type: "object" } }];
  const valid = '{"calls":[{"name":"balance","arguments":{"account":"current"}}]}';
  assert.deepEqual(parseToolSelection(valid, tools), [
    { name: "balance", arguments: { account: "current" } },
  ]);
  assert.deepEqual(parseToolSelection('{"calls":[]}', tools), []);
  for (const [output, expected] of [
    ['{"calls":[{"name":"unknown","arguments":{}}]}', /invalid or unadvertised/],
    ['{"calls":[{"name":"balance","arguments":[]}]}', /invalid or unadvertised/],
    ['{"calls":[{"name":"balance","arguments":{}},{"name":"balance","arguments":{}},{"name":"balance","arguments":{}},{"name":"balance","arguments":{}}]}', /between zero and three/],
    ["not JSON", /valid JSON/],
  ]) assert.throws(() => parseToolSelection(output, tools), expected);
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
