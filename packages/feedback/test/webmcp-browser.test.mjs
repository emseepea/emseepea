import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { chromium } from "playwright";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createDemo } from "../demo-webmcp/server.mjs";

const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const executablePath = process.env.WEBMCP_CHROMIUM_PATH ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

async function setup(t, options) {
  const running = await createDemo(options);
  t.after(() => running.close());
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox", "--enable-features=WebMCP,WebMCPTesting"],
  });
  t.after(() => browser.close());
  return { running, browser };
}

async function open(browser, running, token) {
  const context = await browser.newContext();
  if (token) await context.addCookies([{ name: "synthetic-session", value: token, url: running.origin }]);
  const page = await context.newPage();
  await page.goto(running.origin);
  assert.equal(await page.evaluate(() => typeof document.modelContext?.getTools), "function",
    "The native WebMCP discovery API must be available; no mock or fallback qualifies this test.");
  await page.waitForFunction(() => document.querySelector("#feedback-status").textContent.includes("ready"));
  return page;
}

async function call(page, args, toolName = "submit-feedback") {
  return page.evaluate(async ({ input, toolName }) => {
    const tool = (await document.modelContext.getTools()).find(({ name }) => name === toolName);
    try {
      const result = await document.modelContext.executeTool(tool, JSON.stringify(input));
      return { result: JSON.parse(result) };
    } catch (error) {
      return { rejected: error.name };
    }
  }, { input: args, toolName });
}

async function independentClient(t, running, token) {
  const client = new Client({ name: "independent-webmcp-test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(running.url,
    token ? { requestInit: { headers: { authorization: `Bearer ${token}` } } } : {}));
  t.after(() => client.close());
  return client;
}

test("native WebMCP and an independent MCP client share feedback contracts, guidance and backend", { timeout: 30_000 }, async (t) => {
  const { running, browser } = await setup(t);
  const page = await open(browser, running);
  const client = await independentClient(t, running);
  const { tools } = await client.listTools();
  const native = await page.evaluate(() => document.modelContext.getTools());
  assert.deepEqual(native.map(({ name }) => name).sort(), ["search-pea-varieties", "submit-feedback"]);
  const nativeFeedback = native.find(({ name }) => name === "submit-feedback");
  assert.equal(nativeFeedback.name, tools[0].name);
  assert.equal(nativeFeedback.description, tools[0].description);
  assert.deepEqual(JSON.parse(nativeFeedback.inputSchema), tools[0].inputSchema);
  assert.deepEqual(nativeFeedback.annotations, {
    readOnlyHint: false, consequentialHint: false, untrustedContentHint: true,
  });
  for (const guidance of [
    "Use it without asking a separate permission question", "fully answer the user's original request",
    "briefly state the specific observation", "duplicate observations", "anything after the user objects",
    "notable success", "Never include surrounding conversation",
  ]) assert.ok(nativeFeedback.description.includes(guidance), guidance);

  // A real application task exposes friction; API invocation below is deterministic,
  // not evidence that a language model chooses or obeys this feedback guidance.
  await page.getByLabel("Variety search").fill("sugar snap");
  await page.getByRole("button", { name: "Search varieties" }).click();
  assert.match(await page.locator("#search-results").innerText(), /No varieties found.*exact words/);
  const nativeReceipt = await call(page, {
    observation: "friction", detail: "Searching for sugar snap misses the available snap variety.",
    context: { feature: "variety-search" },
  });
  assert.equal(nativeReceipt.result.isError, false);
  assert.match(nativeReceipt.result.structuredContent.nextAction, /answering every part.*original request/);
  assert.match(nativeReceipt.result.structuredContent.nextAction, /I recorded feedback about/);
  assert.deepEqual(JSON.parse(nativeReceipt.result.content[0].text), nativeReceipt.result.structuredContent);
  const mcpReceipt = await client.callTool({
    name: "submit-feedback", arguments: { observation: "notable_success", detail: "The alternate exact-word search located Highland Snap." },
  });
  assert.equal(mcpReceipt.isError, false);
  assert.equal(running.records.length, 2);
  assert.deepEqual(running.records.map(({ id }) => id), [nativeReceipt.result.structuredContent.id, mcpReceipt.structuredContent.id]);
  assert.deepEqual(running.records.map(({ scope }) => scope), ["website-demo", "website-demo"]);

  await page.getByLabel("Variety search").fill("snap");
  await page.getByRole("button", { name: "Search varieties" }).click();
  assert.equal(await page.locator("#search-results").innerText(), "Found: Highland Snap.");
});

test("native input rejection makes zero backend calls and captures no ambient page context", { timeout: 30_000 }, async (t) => {
  let backendCalls = 0;
  const { running, browser } = await setup(t, { submit() { backendCalls++; } });
  const page = await open(browser, running);
  await page.evaluate(() => {
    document.body.dataset.syntheticCredential = "ambient-secret-never-submit";
    history.replaceState(null, "", "/?secret=ambient-location-never-submit");
    document.querySelector("#query").value = "ambient-search-never-submit";
  });
  for (const input of [
    { observation: "friction", detail: "" },
    { observation: "friction", detail: "x".repeat(4001) },
    { observation: "invalid", detail: "A description." },
    { observation: "friction", detail: "A description.", account: "another-account" },
    { observation: "friction", detail: "A description.", context: { feature: "variety-search", token: "synthetic-secret" } },
    { observation: "friction", detail: "A description.", context: { feature: "other-feature" } },
  ]) {
    const response = await call(page, input);
    assert.ok(response.rejected || response.result.isError, JSON.stringify(response));
    assert.equal(backendCalls, 0);
    assert.equal(running.records.length, 0);
  }
  const result = await call(page, { observation: "suggestion", detail: "Support common variety synonyms." });
  assert.equal(result.result.isError, false);
  assert.equal(backendCalls, 1);
  assert.equal(running.records[0].context, undefined);
  assert.doesNotMatch(JSON.stringify(running.records), /ambient-|synthetic-secret|another-account/);
  assert.deepEqual(Object.keys(running.records[0]).sort(), ["context", "detail", "id", "observation", "recordedAt", "scope"]);
});

function protectedFixture() {
  const resource = new URL("https://synthetic.example/mcp");
  return {
    authentication: {
      discovery: "public",
      verifier: {
        async verifyAccessToken(token) {
          if (!["account-a", "account-b", "expired", "no-permission", "wrong-resource"].includes(token)) throw new Error("Invalid synthetic session");
          return {
            token, clientId: "synthetic-client",
            scopes: token === "no-permission" ? [] : ["feedback:write"],
            expiresAt: Math.floor(Date.now() / 1000) + (token === "expired" ? -60 : 60),
            resource: token === "wrong-resource" ? new URL("https://other.example/mcp") : resource,
            extra: { subject: token },
          };
        },
      },
      metadata: {
        resourceServerUrl: resource,
        oauthMetadata: {
          issuer: "https://synthetic.example", authorization_endpoint: "https://synthetic.example/authorize",
          token_endpoint: "https://synthetic.example/token", response_types_supported: ["code"],
        },
      },
    },
    configureApp(app) {
      // Test-only cookie-to-verifier fixture, never installed by the runnable demo.
      app.addHook("onRequest", async (request) => {
        const token = /(?:^|;\s*)synthetic-session=([^;]+)/.exec(request.headers.cookie ?? "")?.[1];
        if (token) {
          request.headers.authorization = `Bearer ${token}`;
          request.raw.rawHeaders.push("authorization", `Bearer ${token}`);
        }
      });
    },
  };
}

test("native website calls retain server authorization and server-derived account scopes", { timeout: 45_000 }, async (t) => {
  let backendCalls = 0;
  const { running, browser } = await setup(t, { ...protectedFixture(), submit() { backendCalls++; } });
  for (const token of [undefined, "invalid", "expired", "no-permission", "wrong-resource"]) {
    const page = await open(browser, running, token);
    const response = await call(page, { observation: "friction", detail: "Search lacks synonyms." });
    assert.ok(response.rejected || response.result.isError, `${token}: ${JSON.stringify(response)}`);
    assert.equal(backendCalls, 0);
    assert.equal(running.records.length, 0);
    await page.context().close();
  }
  const accountA = await open(browser, running, "account-a");
  const accountB = await open(browser, running, "account-b");
  const a = await call(accountA, { observation: "friction", detail: "Account A search observation." });
  const b = await call(accountB, { observation: "suggestion", detail: "Account B search observation." });
  assert.equal(a.result.isError, false);
  assert.equal(b.result.isError, false);
  const independent = await independentClient(t, running, "account-a");
  const receipt = await independent.callTool({ name: "submit-feedback", arguments: { observation: "notable_success", detail: "Account A alternate route works." } });
  assert.equal(receipt.isError, false);
  assert.equal(backendCalls, 3);
  assert.deepEqual(running.records.map(({ scope }) => scope), ["account-a", "account-b", "account-a"]);
  assert.doesNotMatch(JSON.stringify(running.records), /Bearer|synthetic-session/);
  await accountA.getByRole("button", { name: "Disable agent feedback" }).click();
  assert.deepEqual((await accountA.evaluate(() => document.modelContext.getTools())).map(({ name }) => name), ["search-pea-varieties"]);
  assert.deepEqual((await accountB.evaluate(() => document.modelContext.getTools())).map(({ name }) => name).sort(), ["search-pea-varieties", "submit-feedback"]);
});

test("website supports native cleanup, keyboard search, focus, status and light/dark accessibility checks", { timeout: 45_000 }, async (t) => {
  const { running, browser } = await setup(t);
  for (const colorScheme of ["light", "dark"]) {
    const page = await browser.newPage({ colorScheme, viewport: { width: 390, height: 844 } });
    await page.goto(running.origin);
    await page.waitForFunction(() => document.querySelector("#feedback-status").textContent.includes("ready"));
    await page.addScriptTag({ content: axe });
    const results = await page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
    assert.deepEqual(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target }) => target) })), [], colorScheme);
    assert.equal(await page.getByRole("heading", { name: "Website feedback demo", level: 1 }).count(), 1);
    assert.equal(await page.locator("[role=status][aria-live=polite]").count(), 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(".skip").evaluate((element) => document.activeElement === element), true);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("main").evaluate((element) => document.activeElement === element), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.getByLabel("Variety search").evaluate((element) => document.activeElement === element), true);
    const focus = await page.getByLabel("Variety search").evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth, offset: style.outlineOffset };
    });
    assert.deepEqual(focus, { style: "solid", width: "3px", offset: "4px" });
    await page.keyboard.type("snap");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#search-results").innerText(), "Found: Highland Snap.");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    assert.equal(await page.getByRole("button", { name: "Disable agent feedback" }).evaluate((element) => document.activeElement === element), true);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#feedback-status").textContent.includes("disabled"));
    assert.deepEqual((await page.evaluate(() => document.modelContext.getTools())).map(({ name }) => name), ["search-pea-varieties"]);
    await page.getByLabel("Variety search").fill("snow");
    await page.getByRole("button", { name: "Search varieties" }).click();
    assert.equal(await page.locator("#search-results").innerText(), "Found: Snowcap Snow Pea.");
    assert.equal(running.records.length, 0);
    await page.close();
  }
});

test("disabling native feedback cancels an in-flight call and removes only its registration", { timeout: 20_000 }, async (t) => {
  const started = Promise.withResolvers();
  const cancelled = Promise.withResolvers();
  let backendCalls = 0;
  const { running, browser } = await setup(t, {
    async submit(_command, context) {
      backendCalls++;
      started.resolve();
      await new Promise((resolve) => {
        if (context.signal.aborted) resolve();
        else context.signal.addEventListener("abort", resolve, { once: true });
      });
      cancelled.resolve();
    },
  });
  const page = await open(browser, running);
  await page.evaluate(() => {
    const controller = new AbortController();
    document.modelContext.registerTool({
      name: "unrelated-demo-tool", description: "An unrelated registration owned by another component.",
      inputSchema: { type: "object", properties: {} }, execute: async () => "unrelated",
    }, { signal: controller.signal });
  });
  const pending = call(page, { observation: "friction", detail: "A cancellable synthetic observation." });
  await started.promise;
  await page.getByRole("button", { name: "Disable agent feedback" }).click();
  const response = await pending;
  assert.ok(response.rejected || response.result.isError);
  let cancellationTimeout;
  try {
    await Promise.race([
      cancelled.promise,
      new Promise((_resolve, reject) => {
        cancellationTimeout = setTimeout(() => reject(new Error("Server did not observe request cancellation")), 3000);
      }),
    ]);
  } finally {
    clearTimeout(cancellationTimeout);
  }
  assert.equal(backendCalls, 1);
  assert.equal(running.records.length, 0, "This synthetic backend checks cancellation before committing; real cancellation cannot imply rollback.");
  assert.deepEqual((await page.evaluate(() => document.modelContext.getTools())).map(({ name }) => name).sort(), ["search-pea-varieties", "unrelated-demo-tool"]);
});

test("native registration collision preserves the other owner's tool", { timeout: 20_000 }, async (t) => {
  const { running, browser } = await setup(t);
  const page = await open(browser, running);
  await page.getByRole("button", { name: "Disable agent feedback" }).click();
  await page.evaluate(async () => {
    document.modelContext.registerTool({
      name: "submit-feedback", description: "A tool registered by another component.",
      inputSchema: { type: "object", properties: {} }, execute: async () => "other-owner-result",
    });
    const { enableFeedback } = await import("/browser.js");
    await enableFeedback();
  });
  assert.match(await page.locator("#feedback-status").innerText(), /could not connect/);
  const tools = await page.evaluate(() => document.modelContext.getTools());
  assert.deepEqual(tools.map(({ name }) => name).sort(), ["search-pea-varieties", "submit-feedback"]);
  assert.equal(tools.find(({ name }) => name === "submit-feedback").description, "A tool registered by another component.");
  assert.equal(await page.evaluate(async () => document.modelContext.executeTool((await document.modelContext.getTools()).find(({ name }) => name === "submit-feedback"), "{}")), "other-owner-result");
  assert.equal(running.records.length, 0);
});


test("native catalogue search shares form state, enforces query bounds and survives feedback disposal", { timeout: 30_000 }, async (t) => {
  const { running, browser } = await setup(t);
  const page = await open(browser, running);
  const search = (input) => call(page, input, "search-pea-varieties");
  const tools = await page.evaluate(() => document.modelContext.getTools());
  const taskTool = tools.find(({ name }) => name === "search-pea-varieties");
  assert.doesNotMatch(taskTool.description, /feedback|report|friction/);
  assert.deepEqual(JSON.parse(taskTool.inputSchema), {
    type: "object", properties: {
      query: { type: "string", minLength: 1, maxLength: 100, description: "Variety search text." },
    }, required: ["query"], additionalProperties: false,
  });
  for (const query of ["sugar snap", "snap", "shelling", "unknown variety"]) {
    await page.getByLabel("Variety search").fill(query);
    await page.getByRole("button", { name: "Search varieties" }).click();
    const formText = await page.locator("#search-results").innerText();
    await page.getByLabel("Variety search").fill("different pending query");
    const response = await search({ query });
    assert.equal(response.result.isError, false);
    assert.equal(await page.getByLabel("Variety search").inputValue(), query);
    assert.equal(await page.locator("#search-results").innerText(), formText);
    assert.deepEqual(JSON.parse(response.result.content[0].text), response.result.structuredContent);
    const data = response.result.structuredContent;
    if (query === "sugar snap") {
      assert.deepEqual(data, { matches: [], interfaceNote: "Search uses exact words only. Try “snap”." });
    } else if (query === "snap") {
      assert.deepEqual(data, { matches: ["Highland Snap"] });
    } else if (query === "shelling") {
      assert.deepEqual(data, { matches: ["Harbour Shelling"] });
    } else {
      assert.deepEqual(data, { matches: [], interfaceNote: "Search uses exact words only. Try a shorter search." });
    }
  }
  const previousQuery = await page.getByLabel("Variety search").inputValue();
  const previousResults = await page.locator("#search-results").innerText();
  for (const input of [{}, { query: "" }, { query: " " }, { query: "x".repeat(101) }, { query: 1 }, { query: "snap", scope: "other" }]) {
    const response = await search(input);
    assert.ok(response.rejected || response.result.isError, JSON.stringify(response));
    assert.equal(await page.getByLabel("Variety search").inputValue(), previousQuery);
    assert.equal(await page.locator("#search-results").innerText(), previousResults);
  }
  await page.getByRole("button", { name: "Disable agent feedback" }).click();
  assert.deepEqual((await search({ query: "snap" })).result.structuredContent, { matches: ["Highland Snap"] });
  assert.equal(running.records.length, 0);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  assert.deepEqual(await page.evaluate(() => document.modelContext.getTools()), []);
});
