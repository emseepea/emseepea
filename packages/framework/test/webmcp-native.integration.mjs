import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { build } from "vite";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createEmseepea, defineTool, serveEmseepea } from "../dist/index.js";
import { z } from "zod";

test("native WebMCP forwards the complete official-client catalogue to the same HTTP server", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-webmcp-native-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await build({ configFile: false, logLevel: "error", build: {
    outDir: directory, lib: { entry: new URL("./webmcp-browser-client.mjs", import.meta.url).pathname,
      formats: ["es"], fileName: () => "browser.js" },
  } });
  const bundle = await readFile(join(directory, "browser.js"), "utf8");
  const executions = [];
  const protectedCalls = [];
  const tools = Array.from({ length: 62 }, (_, i) => defineTool({
    name: `catalogue-${i}`, description: `Read synthetic catalogue entry ${i}.`, access: "public",
    inputSchema: z.object({ value: z.string() }), outputSchema: z.object({ value: z.string() }),
    annotations: { readOnlyHint: true },
    handler: ({ value }) => { executions.push({ index: i, value }); return { text: value, data: { value } }; },
  }));
  tools.push(defineTool({ name: "account-entry", description: "Read the synthetic account identity.",
    access: "protected", requiredScopes: ["entry:read"], inputSchema: z.object({}),
    outputSchema: z.object({ client: z.string() }), annotations: { readOnlyHint: true },
    handler: (_input, { principal }) => { protectedCalls.push(principal.clientId);
      return { data: { client: principal.clientId } }; },
  }));
  tools.push(defineTool({ name: "write-entry", description: "Write one synthetic catalogue entry.",
    access: "public", inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    handler: ({ value }) => { executions.push({ index: "write", value }); return { data: { value } }; },
  }));
  tools.push(defineTool({ name: "declined-entry", description: "Return a synthetic tool error.",
    access: "public", inputSchema: z.object({}), outputSchema: z.object({ value: z.string() }),
    annotations: { readOnlyHint: true },
    handler: () => ({ isError: true, content: [{ type: "text", text: "Synthetic tool error." }] }),
  }));
  const app = createEmseepea({ name: "synthetic-webmcp", version: "0.0.0", tools,
    listPagination: { pageSize: 1, maxPageBytes: 16 * 1024 },
    authentication: { verifier: { async verifyAccessToken(token) { return {
      token, clientId: token, scopes: ["entry:read"],
      expiresAt: Math.floor(Date.now() / 1000) + 300, resource: new URL("https://synthetic.example/mcp"),
    }; } }, metadata: { resourceServerUrl: new URL("https://synthetic.example/mcp"), oauthMetadata: {
      issuer: "https://auth.example", authorization_endpoint: "https://auth.example/authorize",
      token_endpoint: "https://auth.example/token", response_types_supported: ["code"],
    } } },
  });
  app.get("/", (_request, reply) => reply.type("text/html").send("<!doctype html><title>Synthetic WebMCP test</title>"));
  app.get("/browser.js", (_request, reply) => reply.type("text/javascript").send(bundle));
  const running = await serveEmseepea(app, { port: 0 });
  t.after(() => running.close());
  const client = new Client({ name: "independent-native-check", version: "0.0.0" }, { listMaxPages: 0 });
  await client.connect(new StreamableHTTPClientTransport(running.url));
  t.after(() => client.close());
  const browser = await chromium.launch({
    ...(process.env.WEBMCP_CHROMIUM_PATH ? { executablePath: process.env.WEBMCP_CHROMIUM_PATH } : {}),
    args: ["--enable-features=WebMCP,WebMCPTesting"],
  });
  t.after(() => browser.close());
  console.error(`Native WebMCP browser: ${browser.version()}`);
  const page = await browser.newPage();
  await page.goto(new URL("/", running.url).href);
  const registered = await page.evaluate(async () => {
    const { Client, StreamableHTTPClientTransport, registerWebMcp } = await import("/browser.js");
    if (typeof document.modelContext?.registerTool !== "function") throw new Error("Native WebMCP unavailable");
    const capped = new Client({ name: "default-browser-client", version: "0.0.0" });
    let cappedRejected = false;
    try {
      await capped.connect(new StreamableHTTPClientTransport(new URL("/mcp", location.href)));
      try { await registerWebMcp({ client: capped }); } catch { cappedRejected = true; }
    } finally { await capped.close(); }
    const afterCapped = (await document.modelContext.getTools()).length;
    const client = new Client({ name: "synthetic-browser-client", version: "0.0.0" }, { listMaxPages: 0 });
    await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", location.href)));
    const registration = await registerWebMcp({ client });
    globalThis.syntheticWebMcp = { client, registration };
    return { cappedRejected, afterCapped, available: registration.available, tools: registration.tools,
      unsupported: registration.unsupported, native: await document.modelContext.getTools() };
  });
  assert.equal(registered.cappedRejected, true);
  assert.equal(registered.afterCapped, 0);
  assert.equal(registered.available, true);
  assert.equal(registered.tools.length, 65);
  assert.equal(registered.native.length, 65);
  assert.equal(registered.unsupported.length, 65);
  const nativeRead = registered.native.find(({ name }) => name === "catalogue-61");
  const nativeWrite = registered.native.find(({ name }) => name === "write-entry");
  assert.equal(nativeRead.annotations.readOnlyHint, true);
  assert.equal(nativeRead.annotations.consequentialHint, false);
  assert.equal(nativeRead.annotations.untrustedContentHint, true);
  assert.equal(nativeWrite.annotations.consequentialHint, true);
  assert.equal(nativeWrite.annotations.untrustedContentHint, true);
  assert.equal(nativeRead.outputSchema, undefined);
  assert.equal(nativeWrite.outputSchema, undefined);
  assert.equal(executions.length, 0);
  const result = await page.evaluate(async () => {
    const tool = (await document.modelContext.getTools()).find(({ name }) => name === "catalogue-61");
    return JSON.parse(await document.modelContext.executeTool(tool, { value: "native-read" }));
  });
  assert.deepEqual(result.structuredContent, { value: "native-read" });
  const independent = await client.callTool({ name: "catalogue-61", arguments: { value: "independent-read" } });
  assert.deepEqual(independent.structuredContent, { value: "independent-read" });
  assert.deepEqual(executions, [{ index: 61, value: "native-read" }, { index: 61, value: "independent-read" }]);
  const errorResult = await page.evaluate(async () => {
    const tool = (await document.modelContext.getTools()).find(({ name }) => name === "declined-entry");
    return JSON.parse(await document.modelContext.executeTool(tool, {}));
  });
  assert.equal(errorResult.isError, true);
  assert.deepEqual(errorResult.content, [{ type: "text", text: "Synthetic tool error." }]);
  const denied = await page.evaluate(async () => {
    const tool = (await document.modelContext.getTools()).find(({ name }) => name === "account-entry");
    return JSON.parse(await document.modelContext.executeTool(tool, {}));
  });
  assert.equal(denied.isError, true);
  assert.deepEqual(protectedCalls, []);
  await page.evaluate(async () => { syntheticWebMcp.registration.dispose(); await syntheticWebMcp.client.close(); });
  assert.equal(await page.evaluate(async () => (await document.modelContext.getTools()).length), 0);
  for (const token of ["synthetic-alice", "synthetic-bob"]) {
    const accountResult = await page.evaluate(async (token) => {
      const { Client, StreamableHTTPClientTransport, registerWebMcp } = await import("/browser.js");
      const client = new Client({ name: "account-browser", version: "0.0.0" }, { listMaxPages: 0 });
      await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", location.href),
        { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
      const registration = await registerWebMcp({ client, filter: ({ name }) => name === "account-entry" });
      const listing = await document.modelContext.getTools();
      const result = JSON.parse(await document.modelContext.executeTool(listing[0], {}));
      registration.dispose();
      let staleRejected = false;
      try { await document.modelContext.executeTool(listing[0], {}); } catch { staleRejected = true; }
      await client.close();
      return { result, names: listing.map(({ name }) => name), staleRejected };
    }, token);
    assert.deepEqual(accountResult.result.structuredContent, { client: token });
    assert.deepEqual(accountResult.names, ["account-entry"]);
    assert.equal(accountResult.staleRejected, true);
    assert.equal(await page.evaluate(async () => (await document.modelContext.getTools()).length), 0);
  }
  assert.deepEqual(protectedCalls, ["synthetic-alice", "synthetic-bob"]);
});
