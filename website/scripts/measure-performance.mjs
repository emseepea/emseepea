import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { output, serveSite } from "../test-support/site.mjs";

export function describeFile(name, body) {
  assert.ok(body.length > 0, `empty build file: ${name}`);
  const extension = path.extname(name).slice(1);
  return { name, kind: ["html", "css", "js"].includes(extension) ? extension : "other",
    search: name.startsWith("pagefind/"), bytes: body.length,
    gzipBytes: gzipSync(body, { level: 9 }).length,
    sha256: createHash("sha256").update(body).digest("hex") };
}

export function summarise(values) {
  assert.ok(values.length > 0 && values.every(Number.isFinite), "expected finite samples");
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return { count: ordered.length, median: ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2,
    max: ordered.at(-1) };
}

export function processingDelta(before, after) {
  return Object.fromEntries(["TaskDuration", "ScriptDuration", "LayoutDuration"].map((name) => {
    assert.ok(Number.isFinite(before[name]) && Number.isFinite(after[name]) && after[name] >= before[name], `invalid ${name}`);
    return [name + "Ms", (after[name] - before[name]) * 1000];
  }));
}

export function rssBytes(smaps) {
  const match = /^Rss:\s+(\d+) kB$/m.exec(smaps);
  const bytes = Number(match?.[1]) * 1024;
  assert.ok(Number.isSafeInteger(bytes) && bytes > 0, "missing or invalid process RSS");
  return bytes;
}

export function processDelta(before, after) {
  for (const snapshot of [before, after]) {
    assert.ok(snapshot.length > 0 && new Set(snapshot.map(({ id }) => id)).size === snapshot.length, "empty or duplicate processes");
    for (const process of snapshot) {
      assert.ok(Number.isSafeInteger(process.id) && process.id > 0
        && Number.isFinite(process.cpuTime) && process.cpuTime >= 0
        && Number.isSafeInteger(process.rssBytes) && process.rssBytes > 0, "invalid process measurement");
    }
  }
  assert.ok(before.every(({ id }) => after.some((process) => process.id === id)), "process disappeared during measurement");
  const deltas = after.map((process) => {
    const delta = process.cpuTime - (before.find(({ id }) => id === process.id)?.cpuTime ?? 0);
    assert.ok(delta >= 0, "process CPU counter reversed");
    return delta;
  });
  return { observedProcessCpuMs: deltas.reduce((sum, delta) => sum + delta, 0) * 1000,
    listedProcessRssBytes: after.reduce((sum, process) => sum + process.rssBytes, 0) };
}

export function checkBudget(report, routes) {
  assert.ok(routes.length > 0 && new Set(routes).size === routes.length, "missing or duplicate routes");
  assert.ok(report.files.length > 0, "missing build inventory");
  for (const file of report.files) {
    assert.ok(Number.isSafeInteger(file.gzipBytes) && file.gzipBytes > 0, "invalid compressed size");
    if (file.kind === "html") assert.ok(file.gzipBytes <= 24 * 1024, `HTML budget: ${file.name}`);
  }
  for (const [label, files, limit] of [
    ["CSS", report.files.filter((file) => file.kind === "css"), 40 * 1024],
    ["JavaScript", report.files.filter((file) => file.kind === "js"), 192 * 1024],
    ["search", report.files.filter((file) => file.search), 384 * 1024],
    ["non-HTML", report.files.filter((file) => file.kind !== "html"), 512 * 1024],
  ]) assert.ok(files.reduce((sum, file) => sum + file.gzipBytes, 0) <= limit, `${label} size budget`);
  assert.equal(report.samples.length, routes.length * 10, "incomplete trial count");
  for (const route of routes) {
    for (const [width, slowdown, taskLimit, cpuLimit] of [[1280, 1, 150, 800], [320, 4, 500, 2000]]) {
      for (let trial = 1; trial <= 5; trial++) {
        const matches = report.samples.filter((sample) => sample.route === route && sample.width === width && sample.trial === trial);
        assert.equal(matches.length, 1, `missing or duplicate trial: ${route} ${width}px ${trial}`);
        const sample = matches[0];
        assert.equal(sample.cpuSlowdown, slowdown, "incorrect CPU slowdown");
        assert.deepEqual(sample.errors, [], "failed trial");
        for (const phase of ["initial", "search", "noResults"]) {
          const data = sample.phases[phase];
          for (const [metric, limit] of [["TaskDurationMs", taskLimit], ["observedProcessCpuMs", cpuLimit], ["listedProcessRssBytes", 512 * 1024 * 1024]]) {
            const value = data?.[metric];
            assert.ok(Number.isFinite(value) && value >= 0 && (metric !== "listedProcessRssBytes" || value > 0), `invalid ${metric}`);
            assert.ok(value <= limit, `${route} ${width}px trial ${trial} ${phase}: ${metric} ${value} exceeds ${limit}`);
          }
        }
      }
    }
  }
}

async function measure() {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "Run website performance measurements on GitHub Actions, not locally");
  const reportPath = new URL("../artifacts/performance.json", import.meta.url);
  await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const report = {
    schemaVersion: 2, status: "incomplete", startedAt: new Date().toISOString(),
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    conditions: {
      node: process.version, os: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, hostMemoryBytes: os.totalmem(),
      runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      samplesPerRouteAndViewport: 5, colorScheme: "light", height: 900,
      profiles: [{ width: 1280, cpuSlowdown: 1 }, { width: 320, cpuSlowdown: 4 }],
      scope: "Loopback static server; fresh browser context per sample; shared browser; HTTP cache disabled; no network throttling. Not real-device or internet latency evidence.",
      sizes: "gzip level 9 per build file, not observed hosting transfer sizes. Search is a subset of totals. Inventory includes files not fetched by a page.",
      processing: "CDP timeTicks duration deltas in ms for renderer tasks, script and layout; these overlap and must not be added. Forced GC excluded. Not process CPU time.",
      memory: "JSHeapUsedSize after forced GC, in bytes. Retained main-renderer JavaScript heap only, not peak, WASM, browser RSS or process memory.",
      processMemory: "Sum of smaps_rollup Rss for all CDP-listed browser processes before forced GC, in bytes. Includes resident worker/WASM allocations and browser baseline; counts shared pages more than once. Snapshot, not peak or unique physical memory. Excludes unlisted OS helpers and Node test server.",
      processCpu: "Observed all-thread CPU seconds delta across CDP-listed browser processes, converted to ms. Includes browser background/instrumentation work; forced GC excluded. Rejects disappeared PIDs or reversed counters, but two snapshots cannot detect processes born and exited between them.",
      phases: "Initial: before navigation to network idle. Search: before opening dialog through pea results and network idle. No-results: input fill through announcement and network idle. Automation turnaround includes driver and idle waits.",
    }, files: [], totals: {}, samples: [], summaries: [],
  };
  let site;
  let browser;
  try {
    for (const entry of (await readdir(output, { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile())) {
      const filename = path.join(entry.parentPath, entry.name);
      report.files.push(describeFile(path.relative(output, filename).split(path.sep).join("/"), await readFile(filename)));
    }
    report.files.sort((a, b) => a.name.localeCompare(b.name, "en"));
    report.buildSha256 = createHash("sha256").update(JSON.stringify(report.files)).digest("hex");
    for (const kind of ["all", "html", "css", "js", "other", "search"]) {
      const files = report.files.filter((file) => kind === "all" || (kind === "search" ? file.search : file.kind === kind));
      report.totals[kind] = { files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0) };
    }
    site = await serveSite();
    browser = await chromium.launch();
    report.conditions.chromium = browser.version();
    const browserCdp = await browser.newBrowserCDPSession();
    const processes = async () => Promise.all((await browserCdp.send("SystemInfo.getProcessInfo")).processInfo.map(async (process) => {
      assert.ok(Number.isSafeInteger(process.id) && process.id > 0, "invalid browser process ID");
      return { ...process, rssBytes: rssBytes(await readFile(`/proc/${process.id}/smaps_rollup`, "utf8")) };
    }));
    for (const profile of report.conditions.profiles) {
      for (const route of site.routes.sort()) {
        for (let trial = 1; trial <= report.conditions.samplesPerRouteAndViewport; trial++) {
          const sample = { route, ...profile, trial, phases: {}, processes: {}, workers: [], errors: [] };
          report.samples.push(sample);
          const context = await browser.newContext({ colorScheme: "light", viewport: { width: profile.width, height: 900 } });
          try {
            await context.route("**/*", async (request) => {
              if (new URL(request.request().url()).origin === site.origin) await request.continue();
              else { sample.errors.push("Unexpected external request: " + request.request().url()); await request.abort(); }
            });
            const page = await context.newPage();
            page.setDefaultTimeout(15_000);
            page.on("pageerror", (error) => sample.errors.push(error.message));
            page.on("requestfailed", (request) => sample.errors.push(`${request.url()}: ${request.failure()?.errorText}`));
            page.on("response", (response) => { if (!response.ok()) sample.errors.push(`HTTP ${response.status()}: ${response.url()}`); });
            const cdp = await context.newCDPSession(page);
            await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuSlowdown });
            await cdp.send("Performance.enable", { timeDomain: "timeTicks" });
            const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
            const phases = {
              initial: async () => { assert.equal((await page.goto(site.origin + route)).status(), 200); },
              search: async () => {
                await page.getByRole("button", { name: /^Search/ }).first().click();
                await page.getByRole("textbox", { name: /Search/ }).fill("pea");
                await page.locator("dialog").getByRole("link", { name: /Run your first server/ }).first().waitFor();
              },
              noResults: async () => {
                await page.getByRole("textbox", { name: /Search/ }).fill("zzzzzz-no-result-token");
                await page.waitForFunction(() => /no results/i.test(document.querySelector('dialog [role="status"]')?.textContent ?? ""));
              },
            };
            for (const [phase, action] of Object.entries(phases)) {
              const processSamples = { before: await processes() };
              sample.processes[phase] = processSamples;
              const before = await metrics();
              const start = performance.now();
              await action();
              await page.waitForLoadState("networkidle");
              const automationTurnaroundMs = performance.now() - start;
              const after = await metrics();
              processSamples.after = await processes();
              sample.workers = page.workers().map((worker) => new URL(worker.url()).pathname);
              await cdp.send("HeapProfiler.collectGarbage");
              const retainedJsHeapBytes = (await metrics()).JSHeapUsedSize;
              assert.ok(Number.isFinite(retainedJsHeapBytes) && retainedJsHeapBytes > 0, "missing heap measurement");
              sample.phases[phase] = { ...processingDelta(before, after), ...processDelta(processSamples.before, processSamples.after), retainedJsHeapBytes, automationTurnaroundMs };
            }
          } catch (error) {
            sample.errors.push(error.message);
          } finally {
            await context.close();
          }
          console.log(`${profile.width}px ${route} trial ${trial}: ${sample.errors.length ? "FAILED" : "recorded"}`);
          await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
        }
      }
    }
    assert.ok(report.samples.every((sample) => sample.errors.length === 0), "Failed samples retained; no retries or partial success summary");
    for (const profile of report.conditions.profiles) {
      for (const route of site.routes) {
        const samples = report.samples.filter((sample) => sample.route === route && sample.width === profile.width);
        const phases = {};
        for (const phase of Object.keys(samples[0].phases)) {
          phases[phase] = Object.fromEntries(Object.keys(samples[0].phases[phase]).map((metric) => [metric, summarise(samples.map((sample) => sample.phases[phase][metric]))]));
        }
        report.summaries.push({ route, ...profile, phases });
      }
    }
    checkBudget(report, site.routes);
    report.status = "passed";
  } catch (error) {
    report.error = error.message;
    process.exitCode = 1;
  } finally {
    await browser?.close();
    await site?.close();
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.log(`Website measurements: ${report.status}; ${fileURLToPath(reportPath)}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await measure();
