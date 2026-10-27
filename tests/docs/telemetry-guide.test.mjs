import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

test("the copied standard SDK guide exports both signals and shuts down", { timeout: 45_000 }, async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ["scripts/verify-telemetry-guide.mjs"], { timeout: 40_000 });
  assert.match(stdout, /resource policy and shutdown PASS/);
});


test("the copied SDK recipe preserves the response and reports collector timeout on shutdown", { timeout: 45_000 }, async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ["scripts/verify-telemetry-guide.mjs", process.cwd(), "stalled"], { timeout: 40_000 });
  assert.match(stdout, /timed-out shutdown reported failure with exit 1 as expected/);
});
