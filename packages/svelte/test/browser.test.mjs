import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { build } from "esbuild";
import { chromium } from "playwright";
import { compile } from "svelte/compiler";

const require = createRequire(import.meta.url);

test("the browser component preserves accessibility and focus on updates", async (t) => {
  const bundle = await build({
    stdin: {
      contents: 'import { mount } from "svelte"; import App from "./test/browser-app.svelte"; mount(App, { target: document.getElementById("app") });',
      resolveDir: new URL("..", import.meta.url).pathname,
    },
    bundle: true,
    format: "iife",
    platform: "browser",
    write: false,
    plugins: [{
      name: "svelte-client",
      setup(builder) {
        builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
          contents: compile(await readFile(path, "utf8"), { filename: path, generate: "client", dev: false }).js.code,
          loader: "js",
        }));
      },
    }],
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
  await page.setContent('<!doctype html><html lang="en"><head><title>Result card test</title></head><body><main><h1 tabindex="-1">Results</h1><div id="app"></div></main></body></html>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.locator("[data-emseepea-part='result-view']").first().waitFor();

  const card = page.locator("[data-emseepea-part='result-view']").first();
  const semanticMarkup = await card.evaluate((node) => node.outerHTML);
  assert.equal(await card.evaluate((node) => getComputedStyle(node).backgroundColor), "rgba(0, 0, 0, 0)");
  await page.addStyleTag({ content: await readFile(new URL("../../tailwind/dist/emseepea.css", import.meta.url), "utf8") });
  assert.equal(await card.evaluate((node) => node.outerHTML), semanticMarkup);
  assert.equal(await card.evaluate((node) => getComputedStyle(node).backgroundColor), "rgb(255, 255, 255)");
  await page.locator("html").evaluate((node) => node.setAttribute("data-emseepea-theme", "dark"));
  assert.equal(await card.evaluate((node) => getComputedStyle(node).backgroundColor), "rgb(16, 26, 21)");
  await page.locator("html").evaluate((node) => node.setAttribute("data-emseepea-theme", "light"));

  const labelledBy = await page.locator("[data-emseepea-part='result-view']").evaluateAll((cards) => cards.map((card) => card.getAttribute("aria-labelledby")));
  assert.equal(new Set(labelledBy).size, 2);
  assert.equal(await page.locator("h2").count(), 1);
  assert.equal(await page.locator("h3").count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  await page.addStyleTag({ content: "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-block-end:2em!important}" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  for (const selector of ["summary", "[data-emseepea-part='action']"]) {
    const boxes = await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map(({ width, height }) => ({ width, height })));
    assert.ok(boxes.every(({ width, height }) => width >= 24 && height >= 24), `${selector} target is too small`);
  }
  assert.equal(await page.locator("[data-emseepea-part='action']:disabled").first().evaluate((node) => getComputedStyle(node).borderStyle), "dashed");
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.locator("[data-emseepea-part='action']:not(:disabled)").first().focus();
  assert.notEqual(await page.locator("[data-emseepea-part='action']:not(:disabled)").first().evaluate((node) => getComputedStyle(node).outlineStyle), "none");
  assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
  await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  assert.deepEqual((await page.evaluate(() => window.axe.run(document.querySelector("[data-emseepea-part='result-view']")))).violations.map(({ id }) => id), []);

  const status = page.locator("[data-emseepea-part='status']").first();
  const statusNode = await status.elementHandle();
  await page.evaluate(() => window.emseepeaUpdate({
    headline: "$650,000",
    state: { kind: "updated", status: "Estimate updated: $650,000.", focusTarget: "status" },
  }));
  await status.filter({ hasText: "Estimate updated: $650,000." }).waitFor();
  assert.equal(await status.evaluate((element) => element === document.activeElement), true);
  assert.equal(await status.evaluate((element, original) => element === original, statusNode), true);

  const action = page.locator("[data-emseepea-action='without-card']").first();
  await action.focus();
  await page.evaluate(() => window.emseepeaUpdate({ headline: "$651,000" }));
  assert.equal(await action.evaluate((element) => element === document.activeElement), true);
  await page.evaluate(() => window.emseepeaUpdate({
    state: { kind: "updated", status: "Result updated.", focusTarget: "result" },
  }));
  assert.equal(await card.evaluate((element) => element === document.activeElement), true);
  assert.notEqual(await card.evaluate((element) => getComputedStyle(element).outlineStyle), "none");
  await page.evaluate(() => window.emseepeaUpdate({
    state: { kind: "ready", status: "Choose an action.", focusTarget: "actions" },
  }));
  assert.equal(await action.evaluate((element) => element === document.activeElement), true);
  await page.evaluate(() => window.emseepeaUpdate({
    state: { kind: "ready", status: "Choose an action.", focusTarget: "none" },
  }));
  await page.locator("h1").focus();
  await page.evaluate(() => window.emseepeaUpdate({
    state: { kind: "ready", status: "Choose an action.", focusTarget: "actions" },
  }));
  assert.equal(await action.evaluate((element) => element === document.activeElement), true);
});
