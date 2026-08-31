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

async function measure() {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "Run website performance measurements on GitHub Actions, not locally");
  const reportPath = new URL("../artifacts/performance.json", import.meta.url);
  await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const report = {
    schemaVersion: 1, status: "incomplete", startedAt: new Date().toISOString(),
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
      phases: "Initial: before navigation to network idle. Search: before opening dialog through coffee results and network idle. No-results: input fill through announcement and network idle. Automation turnaround includes driver and idle waits.",
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
    for (const profile of report.conditions.profiles) {
      for (const route of site.routes.sort()) {
        for (let trial = 1; trial <= report.conditions.samplesPerRouteAndViewport; trial++) {
          const sample = { route, ...profile, trial, phases: {}, errors: [] };
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
                await page.getByRole("textbox", { name: /Search/ }).fill("coffee");
                await page.locator("dialog").getByRole("link", { name: /Run your first server/ }).first().waitFor();
              },
              noResults: async () => {
                await page.getByRole("textbox", { name: /Search/ }).fill("zzzzzz-no-result-token");
                await page.waitForFunction(() => /no results/i.test(document.querySelector('dialog [role="status"]')?.textContent ?? ""));
              },
            };
            for (const [phase, action] of Object.entries(phases)) {
              const before = await metrics();
              const start = performance.now();
              await action();
              await page.waitForLoadState("networkidle");
              const automationTurnaroundMs = performance.now() - start;
              const after = await metrics();
              await cdp.send("HeapProfiler.collectGarbage");
              const retainedJsHeapBytes = (await metrics()).JSHeapUsedSize;
              assert.ok(Number.isFinite(retainedJsHeapBytes) && retainedJsHeapBytes > 0, "missing heap measurement");
              sample.phases[phase] = { ...processingDelta(before, after), retainedJsHeapBytes, automationTurnaroundMs };
            }
          } catch (error) {
            sample.errors.push(error.message);
          } finally {
            await context.close();
          }
          console.log(`${profile.width}px ${route} trial ${trial}: ${sample.errors.length ? "FAILED" : "recorded"}`);
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
    report.status = "measured-not-budgeted";
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
