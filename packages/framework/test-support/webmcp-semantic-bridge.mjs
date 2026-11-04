import { randomUUID } from "node:crypto";
import { mkdtemp, open, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { chromium } from "playwright";
import { z } from "zod";
import { createEmseepea, defineTool, serveEmseepea } from "../dist/index.js";
import { defineFeedbackSubmission } from "@emseepea/feedback";

/** Synthetic test fixture only. The model sees page tools, never browser control. */
export async function createNativeWebMcpBridge({ evidenceFile } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-native-bridge-"));
  let evidence, site, browser, bridge, page;
  let closed = false;
  const observations = [];
  const events = [];
  let sequence = 0;
  let writes = Promise.resolve();
  const close = async () => {
    if (closed) return;
    closed = true;
    await page?.evaluate(async () => {
      globalThis.syntheticWebMcp?.registration.dispose();
      await globalThis.syntheticWebMcp?.client.close();
    }).catch(() => {});
    const stopped = await Promise.allSettled([bridge?.close(), browser?.close(), site?.close(), writes]);
    const cleaned = await Promise.allSettled([evidence?.close(), rm(directory, { recursive: true, force: true })]);
    if ([...stopped, ...cleaned].some(({ status }) => status === "rejected")) {
      throw new Error("Native WebMCP fixture cleanup did not complete");
    }
  };
  try {
    if (evidenceFile) evidence = await open(evidenceFile, "wx", 0o600);
    await build({ configFile: false, logLevel: "error", build: { outDir: directory,
      lib: { entry: new URL("../test/webmcp-browser-client.mjs", import.meta.url).pathname,
        formats: ["es"], fileName: () => "browser.js" },
    } });
    const bundle = await readFile(join(directory, "browser.js"), "utf8");
    const varieties = {
      "Highland Snap": { name: "Highland Snap", peaType: "snap", maturityDays: 70, batchId: "HS-27" },
      "Harbour Gem": { name: "Harbour Gem", peaType: "shelling", maturityDays: 62, batchId: "HG-14" },
    };
    const stock = { "HS-27": 12, "HG-14": 8 };
    const backendTools = [
      defineTool({ name: "lookup-variety", access: "public", annotations: { readOnlyHint: true },
        description: "Look up a pea variety's type, maturity and stock batch identifier.",
        inputSchema: z.object({ name: z.enum(["Highland Snap", "Harbour Gem"]) }),
        outputSchema: z.object({ name: z.string(), peaType: z.string(), maturityDays: z.number(), batchId: z.string() }),
        handler: ({ name }) => { observations.push({ name: "lookup-variety", arguments: { name }, data: varieties[name] });
          return { data: varieties[name] }; },
      }),
      defineTool({ name: "get-batch-stock", access: "public", annotations: { readOnlyHint: true },
        description: "Get the number of available seed packets in a stock batch.",
        inputSchema: z.object({ batchId: z.string() }),
        outputSchema: z.object({ batchId: z.string(), availablePackets: z.number() }),
        handler: ({ batchId }) => { const data = { batchId, availablePackets: stock[batchId] };
          observations.push({ name: "get-batch-stock", arguments: { batchId }, data }); return { data }; },
      }),
      defineFeedbackSubmission({ access: "public", backend: { submit(command) {
        const receipt = { id: randomUUID(), recordedAt: new Date().toISOString() };
        observations.push({ name: "submit-feedback", arguments: command, data: receipt }); return receipt;
      } } }),
    ];
    const app = createEmseepea({ name: "synthetic-native-site", version: "0.0.0", tools: backendTools });
    app.get("/", (_request, reply) => reply.type("text/html").send(
      '<!doctype html><html lang="en"><title>Synthetic variety catalogue</title><main><h1>Variety catalogue</h1><output id="result"></output></main></html>',
    ));
    app.get("/browser.js", (_request, reply) => reply.type("text/javascript").send(bundle));
    site = await serveEmseepea(app, { port: 0, host: "127.0.0.1" });
    browser = await chromium.launch({
      ...(process.env.WEBMCP_CHROMIUM_PATH ? { executablePath: process.env.WEBMCP_CHROMIUM_PATH } : {}),
      args: ["--enable-features=WebMCP,WebMCPTesting"],
    });
    console.error(`Native model fixture browser: ${browser.version()}`);
    page = await browser.newPage();
    await page.goto(new URL("/", site.url).href);
    const native = await page.evaluate(async () => {
      const { Client, StreamableHTTPClientTransport, registerWebMcp } = await import("/browser.js");
      const client = new Client({ name: "synthetic-site-browser", version: "0.0.0" });
      await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", location.href)));
      const nativeContext = document.modelContext;
      const registration = await registerWebMcp({ client, modelContext: {
        getTools: () => nativeContext.getTools(),
        registerTool: (definition, options) => nativeContext.registerTool({ ...definition,
          async execute(...args) { const result = await definition.execute(...args);
            document.querySelector("#result").textContent = result; return result; },
        }, options),
      } });
      if (!registration.available) throw new Error("Native WebMCP unavailable");
      globalThis.syntheticWebMcp = { registration, client };
      return nativeContext.getTools();
    });
    const expectedNames = ["get-batch-stock", "lookup-variety", "submit-feedback"];
    if (JSON.stringify(native.map(({ name }) => name).sort()) !== JSON.stringify(expectedNames)) {
      throw new Error("Native tools differ from the synthetic backend catalogue");
    }
    const tools = native.map((definition) => defineTool({
      name: definition.name, access: "public", description: definition.description,
      ...(definition.annotations?.readOnlyHint === undefined ? {} : {
        annotations: { readOnlyHint: definition.annotations.readOnlyHint },
      }),
      inputSchema: z.fromJSONSchema(definition.inputSchema),
      async handler(input, context) {
        const callSequence = ++sequence;
        const abort = () => { void page.evaluate(() => globalThis.syntheticWebMcp.registration.dispose()).catch(() => {}); };
        context.signal.addEventListener("abort", abort, { once: true });
        if (context.signal.aborted) abort();
        let result, rawResult, failed = false;
        try {
          context.signal.throwIfAborted();
          rawResult = await page.evaluate(async ({ name, input }) => {
            const tool = (await document.modelContext.getTools()).find((tool) => tool.name === name);
            if (!tool) throw new Error("Native tool unavailable");
            return document.modelContext.executeTool(tool, input);
          }, { name: definition.name, input });
          result = JSON.parse(rawResult);
          context.signal.throwIfAborted();
          return result;
        } catch { failed = true; throw new Error("Native website execution did not complete"); }
        finally {
          context.signal.removeEventListener("abort", abort);
          const visibleResult = await page.locator("#result").textContent().catch(() => null);
          const event = { sequence: callSequence, name: definition.name, arguments: input,
            rawResult, result, failed, visibleResult, backend: structuredClone(observations), browser: browser.version() };
          events.push(event);
          if (evidence) {
            writes = writes.then(() => evidence.writeFile(`${JSON.stringify(event)}\n`));
            await writes;
          }
        }
      },
    }));
    bridge = await serveEmseepea(createEmseepea({ name: "native-webmcp-model-bridge", version: "0.0.0", tools }),
      { port: 0, host: "127.0.0.1" });
    return { url: bridge.url, close, page, events, observations, nativeTools: native, browserVersion: browser.version() };
  } catch (error) { await close(); throw error; }
}
