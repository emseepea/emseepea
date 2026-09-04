import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const target = fileURLToPath(new URL("packed-getting-started.test.mjs", import.meta.url));
const pattern = "every packed initializer creates a standalone checked project";

function run(value) {
  const env = { ...process.env, EMSEEPEA_SKIP_PACKED_INITIALIZERS: value };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ["--test", `--test-name-pattern=${pattern}`, target], {
    encoding: "utf8",
    env,
  });
}

test("the compatibility-matrix initializer skip is exact and fail-closed", () => {
  const skipped = run("true");
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.match(skipped.stdout, /# SKIP/);
  assert.match(skipped.stdout, /skipped 1/);

  const invalid = run("1");
  assert.notEqual(invalid.status, 0);
  assert.match(`${invalid.stdout}\n${invalid.stderr}`, /invalid initializer skip value/);
});
