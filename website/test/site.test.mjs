import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import axe from "axe-core";

const output = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const screenshots = new URL("../artifacts/", import.meta.url);
const base = "/emseepea/";
const publicOrigin = "https://windyroad.github.io";
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".wasm": "application/wasm" };
let server;
let browser;
let origin;
let routes;

before(async () => {
  const files = await readdir(output, { recursive: true });
  routes = files.filter((file) => file.endsWith("index.html"))
    .map((file) => base + file.replace(/index\.html$/, ""));
  assert.ok(routes.length >= 4, "build the documentation before testing");
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (!pathname.startsWith(base)) throw new Error("not a site route");
      const file = path.resolve(output, pathname.slice(base.length) + (pathname.endsWith("/") ? "index.html" : ""));
      if (!file.startsWith(output + path.sep)) throw new Error("outside build output");
      const body = await readFile(file);
      response.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  await mkdir(screenshots, { recursive: true });
});

after(async () => {
  await browser?.close();
  server?.closeAllConnections();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
});

test("every built page has accessible light/dark mobile and desktop output", { timeout: 180_000 }, async () => {
  for (const colorScheme of ["light", "dark"]) {
    for (const width of [1280, 320]) {
      const context = await browser.newContext({ colorScheme, viewport: { width, height: 900 } });
      try {
        const page = await context.newPage();
        for (const route of [...routes, base + "404.html"]) {
          const response = await page.goto(origin + route);
          assert.equal(response.status(), 200, route);
          await page.waitForFunction(() => [...document.querySelectorAll(".expressive-code pre")]
            .every((element) => element.scrollWidth <= element.clientWidth || element.getAttribute("tabindex") === "0"));
          await page.addScriptTag({ content: axe.source });
          const violations = await page.evaluate(async () => (await window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
          })).violations);
          assert.deepEqual(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })), [], `${route} ${colorScheme} ${width}`);
          assert.equal(await page.locator("h1").count(), 1, route);
          assert.ok(await page.locator("html").getAttribute("lang"));
          assert.ok((await page.title()).includes("Em See Pea"));
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `horizontal page overflow: ${route}`);
          if (route.endsWith("404.html")) {
            assert.match(await page.title(), /^Page not found/);
            assert.equal(await page.locator("h1").innerText(), "Page not found");
          } else {
            assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), publicOrigin + route);
          }
        }
        await page.goto(origin + base);
        await page.screenshot({ path: fileURLToPath(new URL(`home-${colorScheme}-${width}.png`, screenshots)), fullPage: true });
      } finally {
        await context.close();
      }
    }
  }
});

test("built links, fragments, images and search assets resolve under the Pages base", async () => {
  const page = await browser.newPage();
  const targets = new Set();
  const ids = new Map();
  try {
    for (const route of routes) {
      await page.goto(origin + route);
      const data = await page.evaluate(() => ({
        ids: [...document.querySelectorAll("[id]")].map((element) => element.id),
        urls: [...document.querySelectorAll("a[href],img[src],script[src],link[href]")]
          .map((element) => element.href || element.src),
      }));
      ids.set(route, new Set(data.ids));
      for (const url of data.urls) {
        const parsed = new URL(url, origin);
        if (parsed.origin === origin) targets.add(parsed.href);
      }
    }
    for (const target of targets) {
      const url = new URL(target);
      assert.ok(url.pathname.startsWith(base), `lost repository base: ${target}`);
      const response = await fetch(target);
      assert.equal(response.status, 200, target);
      if (url.hash) assert.ok(ids.get(url.pathname)?.has(decodeURIComponent(url.hash.slice(1))), `missing fragment: ${target}`);
    }
    assert.equal((await fetch(origin + base + "pagefind/pagefind.js")).status, 200);
    for (const entry of await readdir(path.join(output, "pagefind"), { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) assert.ok((await stat(path.join(entry.parentPath, entry.name))).size > 0, `empty search asset: ${entry.name}`);
    }
    const sitemap = await readFile(path.join(output, "sitemap-0.xml"), "utf8");
    for (const route of routes) assert.ok(sitemap.includes(publicOrigin + route), `missing sitemap route: ${route}`);
  } finally {
    await page.close();
  }
});

test("readers can use core content without JavaScript", async () => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto(origin + base);
    await page.getByRole("link", { name: "Get your first server running", exact: true }).click();
    assert.equal(new URL(page.url()).pathname, base + "getting-started/");
    assert.ok(await page.getByRole("heading", { name: "Run your first server", exact: true }).isVisible());
    await page.getByRole("link", { name: "Browse the examples", exact: true }).click();
    assert.equal(new URL(page.url()).pathname, base + "examples/");
  } finally {
    await context.close();
  }
});

test("keyboard users can skip navigation and search the local index", async () => {
  const page = await browser.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("requestfailed", (request) => failures.push(`${request.url()}: ${request.failure()?.errorText}`));
  try {
    await page.goto(origin + base);
    await page.keyboard.press("Tab");
    assert.match(await page.locator(":focus").innerText(), /skip to content/i);
    await page.keyboard.press("Enter");
    assert.equal(new URL(page.url()).hash, "#_top");
    await page.keyboard.press("Tab");
    assert.ok(await page.locator(":focus").evaluate((element) => Boolean(element.closest("main"))), "skip link must move the keyboard starting point into the content");
    const search = page.getByRole("button", { name: /^Search/ }).first();
    await search.focus();
    await page.keyboard.press("Enter");
    const input = page.getByRole("textbox", { name: /Search/ });
    await input.fill("coffee");
    try {
      await page.locator("dialog").getByRole("link", { name: /Run your first server/ }).first().waitFor();
    } catch (error) {
      throw new Error(JSON.stringify({ failures, search: await page.locator("dialog").innerText() }), { cause: error });
    }
    assert.equal(await input.getAttribute("aria-label"), "Search");
    const status = page.locator('dialog [role="status"]');
    assert.equal(await status.count(), 1);
    assert.equal(await status.getAttribute("aria-live"), "polite");
    assert.equal(await status.getAttribute("aria-atomic"), "true");
    await input.fill("zzzzzz-no-result-token");
    await page.waitForFunction(() => /no results/i.test(document.querySelector('dialog [role="status"]')?.textContent ?? ""));
    await page.keyboard.press("Escape");
    assert.equal(await search.evaluate((element) => element === document.activeElement), true);
  } finally {
    await page.close();
  }
});

test("mobile menu state, visibility and focus stay in sync", async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    await page.goto(origin + base);
    const button = page.getByRole("button", { name: "Menu", exact: true, includeHidden: true });
    await button.focus();
    await page.keyboard.press("Enter");
    assert.equal(await button.getAttribute("aria-expanded"), "true");
    assert.ok(await page.locator(".main-frame").evaluate((element) => element.inert));
    assert.ok(await page.locator("#starlight__sidebar").isVisible());
    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => (await window.axe.run()).violations);
    assert.deepEqual(violations.map(({ id }) => id), []);
    await page.keyboard.press("Escape");
    assert.equal(await button.getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator(".main-frame").evaluate((element) => element.inert), false);
    assert.equal(await page.locator("#starlight__sidebar").isVisible(), false);
    assert.ok(await button.evaluate((element) => element === document.activeElement));
    await button.click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForFunction(() => !document.body.hasAttribute("data-mobile-menu-expanded"));
    assert.equal(await button.getAttribute("aria-expanded"), "false");
    await page.setViewportSize({ width: 320, height: 900 });
    assert.equal(await page.locator("#starlight__sidebar").isVisible(), false);
  } finally {
    await page.close();
  }
});

test("opening search closes the mobile menu and returns focus to a visible control", async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    await page.goto(origin + base);
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    const search = page.getByRole("button", { name: /^Search/ }).first();
    for (const activation of ["click", "Control+k", "Meta+k"]) {
      await menu.click();
      assert.equal(await menu.getAttribute("aria-expanded"), "true");
      if (activation === "click") {
        await search.click();
      } else {
        await page.locator('#starlight__sidebar a').first().focus();
        await page.keyboard.press(activation);
      }
      assert.equal(await menu.getAttribute("aria-expanded"), "false", activation);
      assert.equal(await page.locator(".main-frame").evaluate((element) => element.inert), false);
      assert.ok(await page.locator("dialog").evaluate((element) => element.matches(":modal")));
      await page.getByRole("textbox", { name: /Search/ }).waitFor();
      await page.keyboard.press("Escape");
      assert.ok(await search.evaluate((element) => element === document.activeElement), activation);
      assert.equal(await page.locator("#starlight__sidebar").isVisible(), false);
    }
  } finally {
    await page.close();
  }
});
