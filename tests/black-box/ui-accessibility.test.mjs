import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { chromium } from "playwright";

import { elicitationFixtures } from "@emseepea/example-ui-shared";

const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const examples = [
  { name: "native", script: "examples/native-ui/dist/server.js" },
  { name: "react", script: "examples/react-tailwind-ui/dist/server.js" },
];

test("official UI examples pass the browser accessibility contract", { timeout: 180_000 }, async () => {
  const browser = await chromium.launch();
  try {
    for (const example of examples) {
      const running = await startExample(example.script);
      try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const errors = [];
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        page.on("pageerror", (error) => errors.push(error.message));

        for (const theme of ["light", "dark"]) {
          for (const state of ["ready", "invalid", "busy", "terminal"]) {
            await page.goto(`${running.origin}/?theme=${theme}&state=${state}`);
            await page.addScriptTag({ content: axe });
            const results = await page.evaluate(async () => window.axe.run(document));
            assert.deepEqual(
              results.violations.map(({ id, impact }) => ({ id, impact })),
              [],
              `${example.name} ${theme} ${state} has axe violations`,
            );
            assert.equal(await page.locator("html[lang='en']").count(), 1);
            assert.equal(await page.locator("main#main-content").count(), 1);
            assert.equal(await page.locator("h1").count(), 1);
            assert.equal(await page.locator("[role='status'][aria-live='polite']").count(), 1);
            assert.equal(await page.locator("[data-emseepea-part='view']").getAttribute("data-emseepea-state"), state);
          }
        }

        await page.goto(`${running.origin}/?state=ready`);
        await page.keyboard.press("Tab");
        assert.equal(await page.locator(":focus").getAttribute("href"), "#main-content");
        await page.keyboard.press("Enter");
        assert.equal(await page.evaluate(() => document.activeElement?.id), "main-content");

        await page.goto(`${running.origin}/?state=invalid`);
        await page.waitForFunction(() => document.activeElement?.id === "bean-report-preview--error-summary");
        assert.equal(await page.locator("[data-emseepea-part='error-summary']").getAttribute("role"), "alert");
        assert.equal(
          await page.locator("[data-emseepea-part='error-summary'] a").innerText(),
          "Report title: Enter a report title.",
        );
        assert.equal(await page.locator("[aria-invalid='true']").getAttribute("aria-describedby"),
          "bean-report-preview--field--report-title--description bean-report-preview--field--report-title--error");

        await page.goto(`${running.origin}/?state=busy`);
        await page.waitForFunction(() => document.activeElement?.id === "bean-report-preview--status");
        assert.equal(await page.locator("form").getAttribute("aria-busy"), "true");
        assert.equal(await page.locator("button[type='submit']").isDisabled(), true);

        await page.goto(`${running.origin}/?state=terminal`);
        await page.waitForFunction(() => document.activeElement?.id === "bean-report-preview--terminal");
        await assertNoEffectClaim(page);

        await page.goto(`${running.origin}/?style=off&state=ready`);
        assert.equal(await page.locator("link[rel='stylesheet']").count(), 0);
        assert.equal(await page.locator("label[for='bean-report-preview--field--report-title']").count(), 1);
        assert.equal(await page.locator("form").count(), 1);

        await page.goto(`${running.origin}/?state=ready`);
        await page.locator("button[type='submit']").click();
        await page.waitForSelector("[data-emseepea-state='terminal']");
        await assertNoEffectClaim(page);

        await page.setViewportSize({ width: 320, height: 800 });
        await page.goto(`${running.origin}/?theme=dark&state=ready`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
        for (const selector of ["input[type='text']", "input[type='checkbox']", "select", "button"]) {
          const box = await page.locator(selector).boundingBox();
          assert.ok(box && box.width >= 24 && box.height >= 24, `${example.name} ${selector} is too small`);
        }

        await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
        await page.locator("input[type='text']").focus();
        assert.notEqual(await page.locator("input[type='text']").evaluate((node) => getComputedStyle(node).outlineStyle), "none");
        await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });

        if (example.name === "react") {
          assert.equal(await page.locator("#app form").count(), 1);
          assert.equal(await page.locator("#app input").count(), 2);
          await assertReactUsesServerConfirmedValues(page, running.origin);
          await assertReactReportsTransportFailure(page, running.origin, errors);
        }
        assert.deepEqual(errors, [], `${example.name} emitted browser errors`);
        await page.close();
      } finally {
        await stopExample(running.child);
      }
    }
  } finally {
    await browser.close();
  }
});

async function assertNoEffectClaim(page) {
  const text = await page.locator("[data-emseepea-part='terminal']").innerText();
  assert.match(text, /No report was sent or stored\./);
}

async function assertReactUsesServerConfirmedValues(page, origin) {
  const confirmed = {
    ...elicitationFixtures.ready,
    fields: elicitationFixtures.ready.fields.map((field) => (
      field.id === "report-title" ? { ...field, value: "Server-confirmed title" } : field
    )),
  };
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${origin}/?state=ready`);
  await page.route(`${origin}/`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(confirmed) });
  });
  await page.locator("input[name='title']").fill("Browser-only title");
  await page.locator("button[type='submit']").click();
  await page.waitForFunction(() => (
    document.querySelector("input[name='title']")?.value === "Server-confirmed title"
  ));
  assert.equal(await page.locator("input[name='title']").inputValue(), "Server-confirmed title");
  await page.unroute(`${origin}/`);
}

async function assertReactReportsTransportFailure(page, origin, errors) {
  const errorCount = errors.length;
  await page.route(`${origin}/`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.abort("connectionfailed");
  });
  await page.locator("input[name='title']").fill("Unsaved browser title");
  await page.locator("button[type='submit']").click();
  await page.locator("[data-emseepea-part='status']").filter({ hasText: "could not be updated" }).waitFor();
  assert.equal(await page.locator("input[name='title']").inputValue(), "Unsaved browser title");
  assert.equal(await page.locator("[data-emseepea-part='view']").getAttribute("data-emseepea-state"), "ready");
  await page.unroute(`${origin}/`);
  const expectedBrowserErrors = errors.splice(errorCount);
  assert.ok(expectedBrowserErrors.every((message) => message.includes("net::ERR_CONNECTION_FAILED")));
}

async function startExample(script) {
  const child = spawn(process.execPath, [resolve(script)], {
    env: { ...process.env, NODE_ENV: "test", PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let errors = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { errors += chunk; });
  const mcpUrl = await new Promise((resolveUrl, rejectUrl) => {
    const timer = setTimeout(() => rejectUrl(new Error(`Example startup timed out: ${errors}`)), 15_000);
    const inspect = () => {
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/mcp/);
      if (match) {
        clearTimeout(timer);
        resolveUrl(match[0]);
      }
    };
    child.stdout.on("data", inspect);
    child.once("error", rejectUrl);
    child.once("exit", (code) => rejectUrl(new Error(`Example exited ${code}: ${errors}`)));
    inspect();
  });
  return { child, origin: new URL(mcpUrl).origin };
}

async function stopExample(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveClose) => child.once("close", resolveClose)),
    new Promise((resolveWait) => setTimeout(resolveWait, 3_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
