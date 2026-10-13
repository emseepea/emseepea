import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { createDiagnosticClock } from "../../benchmarks/diagnostic-clock.mjs";

test("GC entries and measured CPU windows use one clock and remain nonqualifying", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ["--expose-gc", "--input-type=module", "-e", `
    import { createDiagnosticClock } from './benchmarks/diagnostic-clock.mjs';
    const clock = createDiagnosticClock();
    clock.start();
    clock.started();
    globalThis.gc();
    clock.stopping();
    clock.stop();
    await new Promise(resolve => setTimeout(resolve, 20));
    console.log(JSON.stringify(await clock.finish()));
  `]);
  const result = JSON.parse(stdout);
  assert.equal(result.diagnosticOnly, true);
  assert.equal(result.clock, "node-performance");
  assert.equal(result.overflow, false);
  assert.equal(result.incompleteWindow, false);
  assert.equal(result.cpuWindows.length, 1);
  const window = result.cpuWindows[0];
  assert.ok(window.startMs <= window.innerStartMs);
  assert.ok(window.innerStartMs <= window.innerEndMs);
  assert.ok(window.innerEndMs <= window.endMs);
  assert.ok(result.garbageCollections.some((entry) => entry.startMs >= window.innerStartMs
    && entry.startMs + entry.durationMs <= window.innerEndMs));
  assert.equal("status" in result, false);
});

test("diagnostic lifecycle cannot silently discard an active window or reopen a finished clock", async () => {
  const clock = createDiagnosticClock();
  clock.start();
  assert.throws(() => clock.start(), /already active/);
  const receipt = await clock.finish();
  assert.equal(receipt.incompleteWindow, true);
  assert.deepEqual(await clock.finish(), receipt);
  assert.throws(() => clock.start(), /finished/);
});

test("diagnostic CPU window retention is bounded and loss stays explicit", async () => {
  const clock = createDiagnosticClock();
  for (let index = 0; index < 4097; index += 1) {
    clock.start(); clock.started(); clock.stopping(); clock.stop();
  }
  const receipt = await clock.finish();
  assert.equal(receipt.cpuWindows.length, 4096);
  assert.equal(receipt.overflow, true);
});
