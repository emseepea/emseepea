import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { checkBudget, describeFile, processDelta, processingDelta, rssBytes, summarise } from "../scripts/measure-performance.mjs";

test("publication checks every trial and rejects missing, invalid or over-budget measurements", () => {
  const routes = ["/emseepea/", "/emseepea/getting-started/"];
  const report = {
    files: [{ name: "index.html", kind: "html", gzipBytes: 24 * 1024 },
      { name: "style.css", kind: "css", gzipBytes: 40 * 1024 },
      { name: "pagefind/index.js", kind: "js", search: true, gzipBytes: 192 * 1024 }],
    samples: routes.flatMap((route) => [1280, 320].flatMap((width) => Array.from({ length: 5 }, (_, i) => ({
      route, width, trial: i + 1, cpuSlowdown: width === 1280 ? 1 : 4, errors: [],
      phases: Object.fromEntries(["initial", "search", "noResults"].map((phase) => [phase, {
        TaskDurationMs: width === 1280 ? 150 : 500,
        observedProcessCpuMs: width === 1280 ? 800 : 2000,
        listedProcessRssBytes: 512 * 1024 * 1024,
      }])),
    })))),
  };
  checkBudget(report, routes);
  const fails = (change) => { const changed = structuredClone(report); change(changed); assert.throws(() => checkBudget(changed, routes)); };
  fails((value) => value.samples.pop());
  fails((value) => { value.samples[1] = structuredClone(value.samples[0]); });
  fails((value) => value.samples[0].errors.push("failed search"));
  fails((value) => { value.samples[0].cpuSlowdown = 4; });
  fails((value) => { delete value.samples[0].phases.search; });
  for (const metric of ["TaskDurationMs", "observedProcessCpuMs", "listedProcessRssBytes"]) {
    for (const invalid of [NaN, Infinity, -1, undefined]) {
      fails((value) => { value.samples[0].phases.initial[metric] = invalid; });
    }
    for (const index of [0, 5, 19]) {
      fails((value) => { value.samples[index].phases.noResults[metric] += 1; });
    }
  }
  for (const index of [0, 1, 2]) fails((value) => { value.files[index].gzipBytes += 1; });
  fails((value) => { value.files[0].gzipBytes = NaN; });
  fails((value) => { value.files = []; });
  fails((value) => value.files.push({ name: "pagefind/data", kind: "other", search: true, gzipBytes: 193 * 1024 }));
  fails((value) => value.files.push({ name: "image.svg", kind: "other", gzipBytes: 281 * 1024 }));
  assert.throws(() => checkBudget(report, []));
});

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

test("process measurements include worker-hosting and child processes without accepting missing data", () => {
  assert.equal(rssBytes("00400000-00500000 ---p [rollup]\nRss:                 123 kB\nPss:                  90 kB\n"), 123 * 1024);
  for (const invalid of ["", "Rss: -1 kB", "Rss: 2 MB", "Rss: 0 kB", "Rss: 99999999999999999999 kB"]) {
    assert.throws(() => rssBytes(invalid), /invalid process RSS/);
  }
  const before = [{ id: 1, type: "browser", cpuTime: 1, rssBytes: 1024 }, { id: 2, type: "renderer", cpuTime: 2, rssBytes: 2048 }];
  const after = [{ ...before[0], cpuTime: 2 }, { ...before[1], cpuTime: 4 }, { id: 3, type: "NetworkService", cpuTime: 1, rssBytes: 4096 }];
  assert.deepEqual(processDelta(before, after), { observedProcessCpuMs: 4000, listedProcessRssBytes: 7168 });
  assert.throws(() => processDelta(before, after.filter(({ id }) => id !== 2)), /disappeared/);
  assert.throws(() => processDelta(before, [{ ...before[0], cpuTime: 0 }, before[1]]), /reversed/);
  assert.throws(() => processDelta(before, [after[0], after[0]]), /duplicate/);
  assert.throws(() => processDelta([], after), /empty/);
  assert.throws(() => processDelta(before, [{ ...after[0], cpuTime: NaN }]), /invalid process/);
  assert.throws(() => processDelta(before, [{ ...after[0], rssBytes: 0 }]), /invalid process/);
});

test("performance command refuses local execution before measuring anything", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/measure-performance.mjs", import.meta.url))], {
    env: { ...process.env, GITHUB_ACTIONS: "false" }, encoding: "utf8", timeout: 10_000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Run website performance measurements on GitHub Actions, not locally/);
});
