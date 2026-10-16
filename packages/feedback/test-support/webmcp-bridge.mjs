import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute, dirname } from "node:path";
import { chromium } from "playwright";
import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";
import { createDemo } from "../demo-webmcp/server.mjs";

const maximumEvidenceBytes = 1024 * 1024;
const maximumValueBytes = 128 * 1024;
function bounded(value) {
  const text = JSON.stringify(value);
  if (typeof text !== "string" || Buffer.byteLength(text) > maximumValueBytes) throw new Error("Synthetic bridge evidence exceeds its bound");
  return JSON.parse(text);
}

async function evidenceSink(path) {
  if (path === undefined) return undefined;
  if (typeof path !== "string" || !isAbsolute(path) || path.length > 4096 || path.includes("\0")) throw new Error("Evidence requires an absolute bounded path");
  if (!(await lstat(dirname(path))).isDirectory()) throw new Error("Evidence parent must be a directory");
  // A unique file prevents overwriting another trial or following a symlink.
  return open(path, "wx", 0o600);
}

/** Test-only bridge: the model sees native website tools, never browser automation. */
export async function createWebMcpBridge({ evidenceFile, demoOptions, operationTimeoutMs = 30_000 } = {}) {
  let evidence;
  let demo;
  let browser;
  let bridge;
  let closed = false;
  let sequence = 0;
  let writtenBytes = 0;
  let evidenceQueue = Promise.resolve();
  const close = async () => {
    if (closed) return;
    closed = true;
    await Promise.allSettled([bridge?.close(), browser?.close()]);
    await demo?.close();
    await evidenceQueue.catch(() => {});
    await evidence?.close();
  };
  try {
    evidence = await evidenceSink(evidenceFile);
    demo = await createDemo({ ...demoOptions, port: 0 });
    const executablePath = process.env.WEBMCP_CHROMIUM_PATH ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
    browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ["--no-sandbox", "--enable-features=WebMCP,WebMCPTesting"] });
    const browserVersion = browser.version();
    const page = await browser.newPage();
    await page.goto(demo.origin);
    await page.waitForFunction(() => document.querySelector("#feedback-status").textContent.includes("ready"));
    const nativeTools = bounded(await page.evaluate(() => document.modelContext.getTools()));
    const names = nativeTools.map(({ name }) => name).sort();
    if (JSON.stringify(names) !== JSON.stringify(["search-pea-varieties", "submit-feedback"])) throw new Error("Expected the two native website tools");
    await page.evaluate(() => { window.__webmcpBridgeExecutions = new Map(); });
    const snapshot = async (entry) => {
      const search = await page.evaluate(() => ({ query: document.querySelector("#query").value, visibleResult: document.querySelector("#search-results").textContent }));
      const record = bounded({ ...entry, browserVersion, search, records: structuredClone(demo.records) });
      if (evidence) {
        const line = `${JSON.stringify(record)}\n`;
        writtenBytes += Buffer.byteLength(line);
        if (writtenBytes > maximumEvidenceBytes) throw new Error("Synthetic evidence file exceeds its bound");
        evidenceQueue = evidenceQueue.then(() => evidence.writeFile(line));
        await evidenceQueue;
      }
    };
    const tools = nativeTools.map((native) => defineTool({
      name: native.name, description: native.description, access: "public",
      inputSchema: z.fromJSONSchema(JSON.parse(native.inputSchema)),
      async handler(input, context) {
        const executionId = randomUUID();
        const callSequence = ++sequence;
        const args = bounded(input);
        context.signal.throwIfAborted();
        // Install before dispatch so cancellation cannot race controller creation.
        await page.evaluate((id) => window.__webmcpBridgeExecutions.set(id, new AbortController()), executionId);
        const abort = () => { void page.evaluate(async ({ id, name }) => {
          window.__webmcpBridgeExecutions.get(id)?.abort();
          // Chromium 154 cancels executeTool without aborting the callback signal.
          // End this fixture registration lifetime too; cancellation proves no rollback.
          if (name === "submit-feedback") {
            const { disableFeedback } = await import("/browser.js");
            await disableFeedback();
          }
        }, { id: executionId, name: native.name }).catch(() => {}); };
        context.signal.addEventListener("abort", abort, { once: true });
        if (context.signal.aborted) abort();
        let nativeResult = null;
        let result = null;
        let failed = false;
        try {
          nativeResult = await page.evaluate(async ({ name, input, id }) => {
            const tool = (await document.modelContext.getTools()).find((item) => item.name === name);
            if (!tool) throw new Error("Native website tool is unavailable");
            return document.modelContext.executeTool(tool, JSON.stringify(input), { signal: window.__webmcpBridgeExecutions.get(id).signal });
          }, { name: native.name, input: args, id: executionId });
          if (typeof nativeResult !== "string") throw new Error("Native website tool returned an unsupported result");
          result = bounded(JSON.parse(nativeResult));
          if (!result || typeof result !== "object" || !Array.isArray(result.content)) throw new Error("Native website tool returned an invalid MCP result");
          context.signal.throwIfAborted();
          return result;
        } catch {
          failed = true;
          // Framework emits an error result. Never replace a failed native call with success.
          throw new Error("Native website execution failed; no success was confirmed");
        } finally {
          context.signal.removeEventListener("abort", abort);
          await page.evaluate((id) => window.__webmcpBridgeExecutions.delete(id), executionId).catch(() => {});
          await snapshot({ sequence: callSequence, name: native.name, arguments: args, nativeResult, result, error: failed });
        }
      },
    }));
    const app = createEmseepea({ name: "native-webmcp-semantic-fixture", version: "0.0.0", tools, operationTimeoutMs });
    bridge = await serveEmseepea(app, { port: 0, host: "127.0.0.1" });
    return { url: bridge.url, close, page, demo, browser, browserVersion, nativeTools };
  } catch (error) {
    await close();
    throw error;
  }
}
