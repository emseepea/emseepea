import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { describeFile, processingDelta, summarise } from "../scripts/measure-performance.mjs";

test("measurement arithmetic preserves units, search grouping, hashes and invalid samples", () => {
  const body = Buffer.from("example search data");
  assert.deepEqual(describeFile("pagefind/example.js", body), {
    name: "pagefind/example.js", kind: "js", search: true, bytes: body.length,
    gzipBytes: gzipSync(body, { level: 9 }).length,
    sha256: createHash("sha256").update(body).digest("hex"),
  });
  assert.equal(describeFile("index.html", body).search, false);
  assert.equal(describeFile("pagefind/index.pf_index", body).kind, "other");
  assert.throws(() => describeFile("empty.js", Buffer.alloc(0)), /empty/);
  assert.deepEqual(summarise([3, 1, 8, 2, 4]), { count: 5, median: 3, max: 8 });
  assert.deepEqual(summarise([3, 1]), { count: 2, median: 2, max: 3 });
  assert.throws(() => summarise([]), /finite/);
  assert.throws(() => summarise([1, NaN]), /finite/);
  const before = { TaskDuration: 1, ScriptDuration: 2, LayoutDuration: 3 };
  assert.deepEqual(processingDelta(before, { TaskDuration: 2, ScriptDuration: 4, LayoutDuration: 6 }), {
    TaskDurationMs: 1000, ScriptDurationMs: 2000, LayoutDurationMs: 3000,
  });
  assert.throws(() => processingDelta(before, {}), /invalid/);
  assert.throws(() => processingDelta(before, { ...before, TaskDuration: 0 }), /invalid/);
});

test("performance command refuses local execution before measuring anything", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/measure-performance.mjs", import.meta.url))], {
    env: { ...process.env, GITHUB_ACTIONS: "false" }, encoding: "utf8", timeout: 10_000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Run website performance measurements on GitHub Actions, not locally/);
});
