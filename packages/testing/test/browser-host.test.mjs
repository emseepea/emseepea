import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";

import { chromium } from "playwright";

test("runs a compiled widget through the shared host protocol", async (t) => {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    if (path === "/") {
      response.setHeader("content-type", "text/html");
      response.end(`<!doctype html><html lang="en"><body><main id="host"></main><script type="module">
        import { createMcpAppDevelopmentHost } from "/dist/browser.js";
        window.host = createMcpAppDevelopmentHost({
          container: document.querySelector("#host"),
          entryPoint: "/widget.js",
          rootElementId: "widget-root",
          fixtures: { first: { value: "First" }, second: { value: "Second" } },
          hostContext: { platform: "web" },
        });
      </script></body></html>`);
      return;
    }
    if (path === "/widget.js") {
      response.setHeader("content-type", "text/javascript");
      response.end(`
        const root = document.querySelector("#widget-root");
        let sequence = 0;
        window.addEventListener("message", (event) => {
          if (event.source !== window.parent || event.data?.jsonrpc !== "2.0") return;
          if (event.data.id === "widget") {
            window.parent.postMessage({ jsonrpc: "2.0", method: "ui/notifications/initialized" }, "*");
          } else if (event.data.method === "ui/notifications/tool-result") {
            root.textContent = event.data.params.structuredContent.value;
          } else if (event.data.method === "ui/notifications/host-context-changed") {
            document.documentElement.dataset.theme = event.data.params.theme;
          } else if (event.data.id?.startsWith("message-")) {
            root.dataset.message = event.data.error ? "rejected" : "succeeded";
          }
        });
        const button = document.createElement("button");
        button.textContent = "Send action";
        button.addEventListener("click", () => window.parent.postMessage({
          jsonrpc: "2.0", id: "message-" + ++sequence, method: "ui/message",
          params: { role: "user", content: [{ type: "text", text: "Show details" }] },
        }, "*"));
        document.body.append(button);
        window.parent.postMessage({
          jsonrpc: "2.0", id: "widget", method: "ui/initialize",
          params: { protocolVersion: "2026-01-26", appInfo: { name: "fixture", version: "1" } },
        }, "*");
      `);
      return;
    }
    if (path.startsWith("/dist/")) {
      response.setHeader("content-type", "text/javascript");
      response.end(await readFile(new URL(`../${path.slice(1)}`, import.meta.url)));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const address = server.address();
  await page.goto(`http://127.0.0.1:${address.port}/?fixture=second&theme=dark&width=288&motion=reduce&message=reject`);
  const frame = page.locator("iframe").contentFrame();

  await frame.locator("#widget-root").filter({ hasText: "Second" }).waitFor();
  assert.equal(await page.locator("iframe").evaluate((element) => element.style.width), "288px");
  assert.equal(await frame.locator("html").evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
  assert.equal(await page.evaluate(() => window.host.initialized()), true);

  await frame.getByRole("button", { name: "Send action" }).click();
  await frame.locator("#widget-root[data-message=rejected]").waitFor();
  assert.equal(await page.evaluate(() => window.host.messageRequests()[0].text), "Show details");

  await page.evaluate(() => {
    window.host.changeHostContext({ theme: "light" });
    window.host.deliverFixture("first");
    window.host.setContainerWidth(320);
  });
  await frame.locator("#widget-root").filter({ hasText: "First" }).waitFor();
  assert.equal(await frame.locator("html").getAttribute("data-theme"), "light");
  assert.equal(await page.locator("iframe").evaluate((element) => element.style.width), "320px");

  await page.goto(`http://127.0.0.1:${address.port}/`);
  const succeedingFrame = page.locator("iframe").contentFrame();
  await succeedingFrame.locator("#widget-root").filter({ hasText: "First" }).waitFor();
  await succeedingFrame.getByRole("button", { name: "Send action" }).click();
  await succeedingFrame.locator("#widget-root[data-message=succeeded]").waitFor();
});
