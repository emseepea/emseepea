import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import {
  insecureTestAuthentication,
  startEmseepea,
  startMcpServer,
} from "@emseepea/testing";
import { chromium } from "playwright";
import { createReactUiServer } from "../dist/app.js";

const require = createRequire(import.meta.url);

test("describes every planting-plan tool property", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const client = await running.connect();
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(({ name }) => name), ["preview-planting-plan"]);
  const input = listed.tools[0].inputSchema.properties;
  const output = listed.tools[0].outputSchema.properties;
  assert.equal(input.title.description, "Title for the planting-plan preview.");
  assert.equal(input.peaType.description, "Pea type to include, or all pea types.");
  assert.equal(input.includeTips.description, "Whether to include sample growing tips.");
  assert.equal(output.status.description, "Confirms that this result is only a preview.");
  assert.equal(output.effectPerformed.description, "Confirms that nothing was sent, stored, or changed.");
  assert.equal(output.title.description, "Title of the planting-plan preview.");
  assert.equal(output.matchingCount.description, "Number of sample varieties matching the selected pea type.");
  assert.equal(output.varieties.description, "Sample pea varieties matching the selected pea type.");
  assert.equal(output.varieties.items.properties.name.description, "Name of the sample pea variety.");
  assert.equal(output.varieties.items.properties.growthHabit.description, "Whether the variety grows as a bush or climbing vine.");
  assert.equal(output.varieties.items.properties.peaType.description, "Whether the variety is grown for shelled peas or edible pods.");
  assert.equal(output.varieties.items.properties.tips.description, "Sample growing tips when requested.");
  assert.equal(output.notice.description, "Reminder that the preview caused no external effect.");
  const result = await client.callTool({
    name: "preview-planting-plan",
    arguments: { title: "Spring peas", peaType: "snap", includeTips: false },
  });
  assert.equal(result.content[0].text, JSON.stringify(result.structuredContent));
});

test("publishes the standards-first MCP Apps resource contract", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const client = await running.connect();
  const [tool] = (await client.listTools()).tools;
  assert.deepEqual(tool._meta.ui, { resourceUri: "ui://pea-planting-plan/v1.html" });
  assert.equal(tool._meta["openai/outputTemplate"], "ui://pea-planting-plan/v1.html");

  const [resource] = (await client.listResources()).resources;
  assert.equal(resource.uri, "ui://pea-planting-plan/v1.html");
  assert.equal(resource.mimeType, "text/html;profile=mcp-app");
  const [content] = (await client.readResource({ uri: resource.uri })).contents;
  assert.equal(content.mimeType, "text/html;profile=mcp-app");
  assert.deepEqual(content._meta.ui, {
    prefersBorder: true,
    csp: { connectDomains: [], resourceDomains: [] },
  });
  assert.deepEqual(content._meta["openai/widgetCSP"], {
    connect_domains: [],
    resource_domains: [],
  });
  assert.match(content.text, /ui\/initialize/);
  assert.match(content.text, /ui\/notifications\/initialized/);
  assert.match(content.text, /ui\/notifications\/tool-result/);
  assert.match(content.text, /ui\/notifications\/tool-cancelled/);
});

test("the MCP Apps card completes initialization before rendering a result", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const client = await running.connect();
  const [resource] = (await client.listResources()).resources;
  const [content] = (await client.readResource({ uri: resource.uri })).contents;
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent("<iframe title=\"Pea planting plan result\"></iframe>");
  await page.evaluate(() => {
    window.receivedAppMessages = [];
    window.addEventListener("message", (event) => {
      window.receivedAppMessages.push(event.data);
      if (event.data?.method === "ui/initialize") {
        event.source.postMessage({ jsonrpc: "2.0", id: event.data.id, result: {
          protocolVersion: "2026-01-26",
          hostInfo: { name: "test-host", version: "1.0.0" },
          hostCapabilities: {},
          hostContext: { theme: "light", displayMode: "inline" },
        } }, "*");
      }
      if (event.data?.method === "ui/notifications/initialized") {
        event.source.postMessage({
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: { structuredContent: {
            title: "Spring peas",
            matchingCount: 1,
            varieties: [{ name: "Highland Snap", growthHabit: "climbing", peaType: "snap" }],
            notice: "No report was sent or stored.",
          } },
        }, "*");
      }
      if (event.data?.method === "ui/message") {
        event.source.postMessage({ jsonrpc: "2.0", id: event.data.id, result: {} }, "*");
      }
    });
  });
  const frame = page.frames()[1];
  await frame.setContent(content.text);
  const status = frame.locator("[data-emseepea-part='status']");
  await status.filter({ hasText: "1 sample pea variety matches." }).waitFor();
  const statusNode = await status.elementHandle();
  assert.equal(await frame.locator("dt").textContent(), "Matching varieties");
  assert.equal(await frame.locator("dd").textContent(), "1");
  assert.match(await frame.locator("details li").textContent(), /Highland Snap, climbing snap pea/);
  assert.equal(await frame.locator("button").getAttribute("type"), "button");
  assert.equal(await frame.locator("button").getAttribute("aria-label"), "Ask for growing tips for these varieties");
  await frame.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const accessibility = await frame.evaluate(() => window.axe.run(document));
  assert.deepEqual(accessibility.violations.map(({ id }) => id), []);
  await page.setViewportSize({ width: 320, height: 640 });
  assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  assert.ok((await frame.locator("button").boundingBox()).height >= 24);
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await frame.locator("button").focus();
  assert.notEqual(await frame.locator("button").evaluate((button) => getComputedStyle(button).outlineStyle), "none");
  assert.equal(await frame.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);

  await frame.evaluate(() => window.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: {
    structuredContent: { title: "Forged", matchingCount: 0, varieties: [], notice: "Forged" },
  } }, "*"));
  assert.equal(await frame.locator("dd").textContent(), "1");

  await page.evaluate(() => document.querySelector("iframe").contentWindow.postMessage({
    jsonrpc: "2.0", method: "ui/notifications/tool-cancelled",
  }, "*"));
  await status.filter({ hasText: "The preview was cancelled." }).waitFor();

  await page.evaluate(() => {
    const app = document.querySelector("iframe").contentWindow;
    app.postMessage({ jsonrpc: "2.0", method: "ui/notifications/host-context-changed", params: { theme: "dark" } }, "*");
    app.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { structuredContent: {
      title: "Spring peas",
      matchingCount: 1,
      varieties: [
        { name: "Meadow Sweet", growthHabit: "bush", peaType: "snap" },
      ],
      notice: "No report was sent or stored.",
    } } }, "*");
  });
  await status.filter({ hasText: "Preview updated: 1 sample pea variety matches." }).waitFor();
  assert.equal(await frame.locator("html").getAttribute("data-emseepea-theme"), "dark");
  assert.equal(await frame.evaluate((node) => node === document.querySelector("[data-emseepea-part='status']"), statusNode), true);

  await frame.locator("button").press("Enter");
  await status.filter({ hasText: "Asked for growing tips in the chat." }).waitFor();
  assert.equal(await frame.locator("[data-emseepea-part='status']").evaluate((element) => element === document.activeElement), true);
  const sent = await page.evaluate(() => window.receivedAppMessages.find((message) => message?.method === "ui/message"));
  assert.equal(sent.params.content[0].text, "Show me growing tips for these pea varieties.");

  await page.evaluate(() => document.querySelector("iframe").contentWindow.postMessage({
    jsonrpc: "2.0", id: "teardown", method: "ui/resource-teardown",
  }, "*"));
  await status.filter({ hasText: "The preview was cancelled." }).waitFor();
  const teardown = await page.evaluate(() => window.receivedAppMessages.find((message) => message?.id === "teardown"));
  assert.deepEqual(teardown, { jsonrpc: "2.0", id: "teardown", result: {} });
});

test("the same UI template composes protected access and observability", async (t) => {
  const events = [];
  const permissions = ["plans:preview"];
  const running = await startEmseepea(t, await createReactUiServer({
    access: { access: "protected", requiredScopes: permissions },
    authentication: insecureTestAuthentication(permissions),
    observability: [{ id: "test-log", emit: (event) => events.push(event) }],
  }));
  const client = await running.connect("test-token");
  assert.deepEqual((await client.listTools()).tools.map(({ name }) => name), ["preview-planting-plan"]);
  assert.ok(events.some(({ method }) => method === "tools/list"));
});
