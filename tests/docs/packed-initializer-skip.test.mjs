import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const target = fileURLToPath(new URL("packed-getting-started.test.mjs", import.meta.url));
const pattern = "every packed initializer creates a standalone checked project";

function run(overrides, selectedPattern = pattern) {
  const env = { ...process.env, ...overrides };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ["--test", `--test-name-pattern=${selectedPattern}`, target], {
    encoding: "utf8",
    env,
  });
}

test("the compatibility-matrix packed skips are exact and fail-closed", () => {
  const skipped = run({
    EMSEEPEA_SKIP_PACKED_AUDIT: "true",
    EMSEEPEA_SKIP_PACKED_INITIALIZERS: "true",
  });
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.match(skipped.stdout, /# SKIP/);
  assert.match(skipped.stdout, /skipped 1/);

  const skippedAudit = run(
    { EMSEEPEA_SKIP_PACKED_AUDIT: "true", EMSEEPEA_SKIP_PACKED_INITIALIZERS: "true" },
    "the packed public packages pass fresh-install",
  );
  assert.equal(skippedAudit.status, 0, skippedAudit.stderr);
  assert.match(skippedAudit.stdout, /the fresh install passes audit.*# SKIP/);

  const invalid = run({
    EMSEEPEA_SKIP_PACKED_AUDIT: "true",
    EMSEEPEA_SKIP_PACKED_INITIALIZERS: "1",
  });
  assert.notEqual(invalid.status, 0);
  assert.match(`${invalid.stdout}\n${invalid.stderr}`, /invalid initializer skip value/);

  const invalidAudit = run({
    EMSEEPEA_SKIP_PACKED_AUDIT: "1",
    EMSEEPEA_SKIP_PACKED_INITIALIZERS: "true",
  });
  assert.notEqual(invalidAudit.status, 0);
  assert.match(`${invalidAudit.stdout}\n${invalidAudit.stderr}`, /invalid packed audit skip value/);
});
