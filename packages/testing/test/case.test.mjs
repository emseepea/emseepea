import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadSemanticCase, requiredPaths } from "../semantic/case.mjs";

test("loads one self-contained semantic case", async () => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-case-"));
  const path = join(directory, "eval.yaml");
  await writeFile(path, [
    "description: Bean meaning",
    "server: ./dist/server.js",
    "question: What does the bean mean?",
    "criticalFacts: [Burundi]",
    "criteria: The answer names Burundi.",
    "operations:",
    "  - method: tools/call",
    "    name: get-bean",
    "    arguments: { name: Riverlight }",
  ].join("\n"));
  const value = await loadSemanticCase(path);
  assert.equal(value.server, join(directory, "dist/server.js"));
  assert.deepEqual(requiredPaths(value), ["tools/call:get-bean"]);
});

test("rejects an incomplete semantic case", async () => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-case-invalid-"));
  const path = join(directory, "eval.yaml");
  await writeFile(path, "description: Missing almost everything\n");
  await assert.rejects(loadSemanticCase(path), /question must be text/);
});
