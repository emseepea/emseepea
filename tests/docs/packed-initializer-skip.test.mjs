import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const targets = [
  fileURLToPath(new URL("packed-getting-started.test.mjs", import.meta.url)),
  fileURLToPath(new URL("getting-started-references.test.mjs", import.meta.url)),
];
const pattern = "every packed initializer creates a standalone checked project|the initialized quickstart passes its documented checks";

function run(overrides, selectedPattern = pattern) {
  const env = { ...process.env, ...overrides };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ["--test", `--test-name-pattern=${selectedPattern}`, ...targets], {
    encoding: "utf8",
    env,
  });
}

test("the compatibility-matrix initializer skip is exact and fail-closed", () => {
  const skipped = run({
    EMSEEPEA_SKIP_PACKED_INITIALIZERS: "true",
  });
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.match(skipped.stdout, /# SKIP/);
  assert.match(skipped.stdout, /skipped 2/);

  const invalid = run({
    EMSEEPEA_SKIP_PACKED_INITIALIZERS: "1",
  });
  assert.notEqual(invalid.status, 0);
  assert.match(`${invalid.stdout}\n${invalid.stderr}`, /invalid initializer skip value/);
});
