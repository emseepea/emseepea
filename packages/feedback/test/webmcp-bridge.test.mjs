import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createWebMcpBridge } from "../test-support/webmcp-bridge.mjs";

async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "webmcp-bridge-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const evidenceFile = join(directory, "synthetic.jsonl");
  const running = await createWebMcpBridge({ evidenceFile, ...options });
  t.after(() => running.close());
  const client = new Client({ name: "independent-native-bridge-test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(running.url));
  t.after(() => client.close());
  return { ...running, client, evidenceFile, directory };
}
function canonicalSchema(value) {
  if (Array.isArray(value)) return value.map(canonicalSchema);
  if (!value || typeof value !== "object") return value;
  const { $schema: _dialect, enum: choices, ...rest } = value;
  if (choices?.length === 1) rest.const = choices[0];
  else if (choices) rest.enum = choices;
  return Object.fromEntries(Object.entries(rest).map(([key, item]) => [key, canonicalSchema(item)]));
}
async function entries(path) {
  return (await readFile(path, "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

test("independent MCP calls execute native WebMCP and correlate visible search and authoritative receipts", { timeout: 40_000 }, async (t) => {
  const running = await fixture(t);
  const { tools } = await running.client.listTools();
  assert.deepEqual(tools.map(({ name }) => name).sort(), ["search-pea-varieties", "submit-feedback"]);
  for (const native of running.nativeTools) {
    const advertised = tools.find(({ name }) => name === native.name);
    assert.equal(advertised.description, native.description);
    const nativeSchema = JSON.parse(native.inputSchema);
    // Zod normalizes a one-value enum to the equivalent const constraint.
    assert.deepEqual(canonicalSchema(advertised.inputSchema), canonicalSchema(nativeSchema));
  }
  assert.match(running.browserVersion, /^154\./, "Qualification records the required native Chromium 154 API");
  const missed = await running.client.callTool({ name: "search-pea-varieties", arguments: { query: "sugar snap" } });
  assert.equal(missed.isError, false);
  assert.match(await running.page.locator("#search-results").innerText(), /No varieties found/);
  const args = { observation: "friction", detail: "Searching sugar snap misses Highland Snap.", context: { feature: "variety-search" } };
  const receipt = await running.client.callTool({ name: "submit-feedback", arguments: args });
  assert.equal(receipt.isError, false);
  assert.equal(running.demo.records.length, 1);
  assert.equal(receipt.structuredContent.id, running.demo.records[0].id);
  assert.match(receipt.structuredContent.nextAction, /original request/);
  const found = await running.client.callTool({ name: "search-pea-varieties", arguments: { query: "snap" } });
  assert.equal(found.isError, false);
  assert.equal(await running.page.locator("#query").inputValue(), "snap");
  assert.equal(await running.page.locator("#search-results").innerText(), "Found: Highland Snap.");
  const log = await entries(running.evidenceFile);
  assert.equal(log.length, 3);
  for (const [index, result] of [missed, receipt, found].entries()) {
    assert.equal(log[index].sequence, index + 1);
    assert.deepEqual(log[index].result, result);
    assert.deepEqual(JSON.parse(log[index].nativeResult), result);
    assert.equal(log[index].error, false);
    assert.equal(log[index].browserVersion, running.browserVersion);
  }
  assert.deepEqual(log[1].arguments, args);
  assert.equal(log[0].records.length, 0);
  assert.deepEqual(log[1].records, running.demo.records);
  assert.deepEqual(log[2].search, { query: "snap", visibleResult: "Found: Highland Snap." });
  assert.equal(await running.page.evaluate(() => window.__webmcpBridgeExecutions.size), 0);
});

test("native execution failures fail closed without a backend bypass or replacement receipt", { timeout: 30_000 }, async (t) => {
  const running = await fixture(t);
  await running.page.evaluate(async () => {
    const native = (await document.modelContext.getTools()).find(({ name }) => name === "submit-feedback");
    const { disableFeedback } = await import("/browser.js");
    await disableFeedback();
    document.modelContext.registerTool({
      name: native.name, description: native.description, inputSchema: JSON.parse(native.inputSchema),
      execute: async () => { throw new Error("Synthetic native failure"); },
    });
  });
  const result = await running.client.callTool({ name: "submit-feedback", arguments: { observation: "friction", detail: "A synthetic observation." } });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.equal(running.demo.records.length, 0);
  const [entry] = await entries(running.evidenceFile);
  assert.equal(entry.error, true);
  assert.equal(entry.result, null);
  assert.equal(entry.nativeResult, null);
  assert.deepEqual(entry.records, []);
  assert.doesNotMatch(JSON.stringify(result), /Synthetic native failure/);
  assert.equal(await running.page.evaluate(() => window.__webmcpBridgeExecutions.size), 0);
});

test("bridge cleanup closes Chromium and both loopback endpoints", { timeout: 30_000 }, async (t) => {
  const running = await fixture(t);
  await running.client.close();
  await running.close();
  await running.close();
  assert.equal(running.browser.isConnected(), false);
  await assert.rejects(fetch(running.url));
  await assert.rejects(fetch(running.demo.url));
});

test("bridge refuses relative and existing/symlink evidence paths before browser or backend startup", async (t) => {
  await assert.rejects(createWebMcpBridge({ evidenceFile: "relative.jsonl" }), /absolute bounded path/);
  const directory = await mkdtemp(join(tmpdir(), "webmcp-path-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "symlink.jsonl");
  await symlink(join(directory, "target.jsonl"), path);
  await assert.rejects(createWebMcpBridge({ evidenceFile: path }), { code: "EEXIST" });
});

test("MCP deadline cancellation reaches native execution and the backend without a receipt", { timeout: 30_000 }, async (t) => {
  const started = Promise.withResolvers();
  const cancelled = Promise.withResolvers();
  const running = await fixture(t, { operationTimeoutMs: 500, demoOptions: {
    async submit(_command, context) {
      started.resolve();
      await new Promise((resolve) => {
        if (context.signal.aborted) resolve();
        else context.signal.addEventListener("abort", resolve, { once: true });
      });
      cancelled.resolve();
    },
  } });
  const pending = running.client.callTool({ name: "submit-feedback", arguments: { observation: "friction", detail: "A cancellable synthetic observation." } });
  // Attach handling before the deadline can settle the call.
  const completed = pending.then((result) => assert.equal(result.isError, true));
  await started.promise;
  await completed;
  await Promise.race([cancelled.promise, new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Native cancellation did not reach the backend")), 3000);
    timer.unref();
  })]);
  await running.page.waitForFunction(() => window.__webmcpBridgeExecutions.size === 0);
  assert.equal(running.demo.records.length, 0);
  // Native rejection is asynchronously logged after the MCP client observes cancellation.
  let entry;
  for (let attempt = 0; attempt < 100 && !entry; attempt++) {
    [entry] = await entries(running.evidenceFile);
    if (!entry) await delay(10);
  }
  assert.ok(entry, "Cancellation evidence must be persisted");
  assert.equal(entry.error, true);
  assert.deepEqual(entry.records, []);
});


test("spawned semantic fixture prints only its bridge endpoint and exits on SIGTERM", { timeout: 30_000 }, async (t) => {
  const child = spawn(process.execPath, [fileURLToPath(new URL("../eval/webmcp-server.mjs", import.meta.url))], {
    stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WEBMCP_EVIDENCE_FILE: undefined },
  });
  t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  let output = "";
  child.stdout.setEncoding("utf8");
  const ready = Promise.withResolvers();
  child.stdout.on("data", (chunk) => {
    output += chunk;
    if (output.includes("\n")) ready.resolve();
  });
  child.once("exit", () => ready.reject(new Error("Fixture exited before discovery")));
  await ready.promise;
  assert.match(output, /^http:\/\/127\.0\.0\.1:\d+\/mcp\n$/);
  const endpoint = output.trim();
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const [code, signal] = await exited;
  assert.equal(code, 0);
  assert.equal(signal, null);
  await assert.rejects(fetch(endpoint));
});
