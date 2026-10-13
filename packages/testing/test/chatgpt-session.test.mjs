import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { chromium } from "playwright";
import { attachOwnedBrowser, validateBrowserAttachment } from "../chatgpt/session.mjs";

const owner = "synthetic-owner@example.test";
const local = "ws://127.0.0.1:9222/devtools/browser/synthetic-browser";

test("browser attachment rejects foreign authority and non-loopback interfaces before connecting", async () => {
  let connections = 0;
  const client = { async connectOverCDP() { connections++; assert.fail("rejected attachment connected"); } };
  for (const endpoint of ["https://example.test/", "ws://example.test:9222/devtools/browser/id", "ws://localhost:9222/devtools/browser/id", "ws://127.0.0.1:80/devtools/browser/id", `${local}?secret=private`, `${local}#private`, "ws://user:private@127.0.0.1:9222/devtools/browser/id", "ws://127.0.0.1:9222/other", "ws://127.1:9222/devtools/browser/id"]) {
    await assert.rejects(attachOwnedBrowser({ chromium: client, endpoint, browserOwner: owner, accountOwner: owner }), /loopback-browser-endpoint-required/);
  }
  await assert.rejects(attachOwnedBrowser({ chromium: client, endpoint: local, accountOwner: owner }), /browser-owner-confirmation-required/);
  await assert.rejects(attachOwnedBrowser({ chromium: client, endpoint: local, browserOwner: "foreign-owner", accountOwner: owner }), /browser-owner-confirmation-required/);
  assert.equal(connections, 0);
  assert.equal(validateBrowserAttachment(local, owner, owner), local);
  assert.equal(validateBrowserAttachment("ws://127.0.0.1:9222/devtools/browser", owner, owner), "ws://127.0.0.1:9222/devtools/browser");
});

test("attachment redacts provider errors and disconnects ambiguous browser contexts", async () => {
  let disconnects = 0;
  await assert.rejects(attachOwnedBrowser({ chromium: { async connectOverCDP() { throw new Error("private-provider-sentinel"); } }, endpoint: local, browserOwner: owner, accountOwner: owner }), { message: "owned-browser-attachment-unavailable" });
  await assert.rejects(attachOwnedBrowser({ chromium: { async connectOverCDP() { return { contexts: () => [{}, {}], async close() { disconnects++; } }; } }, endpoint: local, browserOwner: owner, accountOwner: owner }), { message: "owned-browser-attachment-unavailable" });
  assert.equal(disconnects, 1);
});

test("attachment CLI requires matching owner before browser access and keeps setup optional", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "native-cdp-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { writeFile } = await import("node:fs/promises");
  const scenario = join(directory, "scenario.mjs");
  await writeFile(scenario, `export const authorization = { approved: true, accountOwner: ${JSON.stringify(owner)} }; export function createJourney() { throw new Error('must not execute'); }`);
  const cli = new URL("../chatgpt/run.mjs", import.meta.url);
  const base = [cli.pathname, "--enable-native-chatgpt", "--scenario", scenario];
  for (const [args, category] of [
    [["--connect-cdp", local], "browser-owner-confirmation-required"],
    [["--connect-cdp", "ws://foreign.test:9222/devtools/browser/id", "--browser-owner", owner], "loopback-browser-endpoint-required"],
    [["--connect-cdp", local, "--browser-owner", owner, "--profile", directory], "invalid-run-options"],
    [["--browser-owner", owner], "invalid-run-options"],
  ]) {
    const result = spawnSync(process.execPath, [...base, ...args], { encoding: "utf8", timeout: 5000 });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, new RegExp(category));
    assert.equal(result.stderr.includes(owner), false);
    assert.equal(result.stderr.includes(local), false);
  }
});

test("attachment rejects a WebSocket redirect without contacting its destination", async (t) => {
  let foreignRequests = 0;
  const foreign = createServer((request, response) => { foreignRequests++; response.writeHead(400).end(); });
  foreign.on("upgrade", (request, socket) => { foreignRequests++; socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"); });
  await new Promise((resolve) => foreign.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => foreign.close(resolve)));
  const redirect = createServer();
  redirect.on("upgrade", (request, socket) => socket.end(`HTTP/1.1 302 Found\r\nLocation: ws://127.0.0.1:${foreign.address().port}/devtools/browser/foreign\r\nContent-Length: 0\r\n\r\n`));
  await new Promise((resolve) => redirect.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => redirect.close(resolve)));
  await assert.rejects(attachOwnedBrowser({ chromium, endpoint: `ws://127.0.0.1:${redirect.address().port}/devtools/browser/redirect`, browserOwner: owner, accountOwner: owner }), { message: "owned-browser-attachment-unavailable" });
  assert.equal(foreignRequests, 0);
});

// Normally spawned Chromium plus an intercepted page fixture. Not live ChatGPT
// or CAPTCHA qualification. Sandbox is disabled ONLY for this root-owned CI fixture.
test("real CDP attachment leaves the owner browser and original tab open", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "native-cdp-browser-"));
  const processHandle = spawn(chromium.executablePath(), ["--headless", "--no-sandbox", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${directory}`, "about:blank"], { stdio: "ignore" });
  t.after(async () => { processHandle.kill(); await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  processHandle.on("error", () => {});
  let address;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const active = await readFile(join(directory, "DevToolsActivePort"), "utf8").catch(() => "");
    if (active) { const [port, path] = active.trim().split("\n"); address = `ws://127.0.0.1:${port}${path}`; break; }
    await delay(50);
  }
  assert.ok(address, "synthetic CDP browser did not start");
  const observer = await chromium.connectOverCDP(address);
  t.after(() => observer.close());
  const context = observer.contexts()[0];
  const original = context.pages()[0];
  const originalUrl = original.url();
  let connected;
  const client = { async connectOverCDP(endpoint, options) {
    assert.equal(options.timeout, 30_000);
    assert.equal(options.noDefaults, true);
    connected = await chromium.connectOverCDP(endpoint, options);
    await connected.contexts()[0].route("https://chatgpt.com/**", (route) => route.fulfill({ contentType: "text/html", body: '<button data-testid="accounts-profile-button">Synthetic owner</button><div id="prompt-textarea"></div>' }));
    return connected;
  } };
  const session = await attachOwnedBrowser({ chromium: client, endpoint: address, browserOwner: owner, accountOwner: owner });
  assert.equal(session.page.url(), "https://chatgpt.com/");
  assert.equal(await session.page.getByTestId("accounts-profile-button").innerText(), "Synthetic owner");
  assert.equal(original.url(), originalUrl);
  assert.equal(original.isClosed(), false);
  await session.close();
  assert.equal(connected.isConnected(), false);
  assert.equal(observer.isConnected(), true);
  assert.equal(original.isClosed(), false);
  assert.equal(original.url(), originalUrl);
  assert.equal(processHandle.exitCode, null);
  await original.evaluate(() => document.title);
});
