import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { createEmseepea, defineMappedTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "mapped-adapter-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("mapped adapters share the checked tool lifecycle", async () => {
  const filePath = join(tmpdir(), `emseepea-${crypto.randomUUID()}.json`);
  await writeFile(filePath, JSON.stringify({ id: "file-bean", roast: "light" }));
  const records = new Map([["map-bean", { id: "map-bean", roast: "medium" }]]);
  let inputMaps = 0;
  let memoryCalls = 0;
  let fileCalls = 0;
  let outputMaps = 0;
  let adapterCancelled = false;
  let adapterDeadline;
  let slowInputAdapterCalls = 0;
  let slowOutputAdapterCalls = 0;

  const memoryTool = defineMappedTool({
    name: "lookup-memory-bean",
    access: "public",
    description: "Look up a synthetic in-memory bean.",
    inputSchema: z.object({ id: z.string(), invalidCommand: z.boolean().optional() }),
    outputSchema: z.object({ id: z.string(), roast: z.string() }),
    backendInputSchema: z.object({ key: z.string() }),
    backendOutputSchema: z.object({ record: z.object({ id: z.string(), roast: z.string() }) }),
    mapInput({ id, invalidCommand }) {
      inputMaps += 1;
      return invalidCommand ? { key: 42 } : { key: id };
    },
    async adapter({ key }, { signal, deadlineMs }) {
      memoryCalls += 1;
      adapterDeadline = deadlineMs;
      if (key === "backend-secret") throw new Error("backend-secret-sentinel");
      if (key === "slow") {
        try {
          await delay(200, undefined, { signal });
        } catch (error) {
          adapterCancelled = signal.aborted;
          throw error;
        }
      }
      if (key === "invalid-backend") return { record: { id: key, roast: 42 } };
      const record = records.get(key) ?? { id: key, roast: "dark" };
      return { record };
    },
    mapOutput({ record }) {
      outputMaps += 1;
      if (record.id === "invalid-final") {
        return { text: "invalid", data: { ...record, roast: 42 } };
      }
      return { text: `${record.id}: ${record.roast}`, data: record };
    },
  });
  const fileTool = defineMappedTool({
    name: "lookup-file-bean",
    access: "public",
    description: "Look up a synthetic file-backed bean.",
    inputSchema: z.object({ id: z.literal("file-bean") }),
    outputSchema: z.object({ id: z.string(), roast: z.string() }),
    backendInputSchema: z.object({ path: z.literal(filePath) }),
    backendOutputSchema: z.object({ id: z.string(), roast: z.string() }),
    mapInput: () => ({ path: filePath }),
    async adapter({ path }, { signal }) {
      fileCalls += 1;
      return JSON.parse(await readFile(path, { encoding: "utf8", signal }));
    },
    mapOutput: (record) => ({ text: `${record.id}: ${record.roast}`, data: record }),
  });
  const slowInputTool = defineMappedTool({
    name: "slow-input-schema",
    access: "public",
    description: "Exercise an asynchronous input schema.",
    inputSchema: z.object({ id: z.string() }).refine(async () => {
      await delay(200);
      return true;
    }),
    outputSchema: z.object({ id: z.string() }),
    backendInputSchema: z.object({ id: z.string() }),
    backendOutputSchema: z.object({ id: z.string() }),
    mapInput: ({ id }) => ({ id }),
    adapter: ({ id }) => {
      slowInputAdapterCalls += 1;
      return { id };
    },
    mapOutput: ({ id }) => ({ text: id, data: { id } }),
  });
  const slowOutputTool = defineMappedTool({
    name: "slow-output-schema",
    access: "public",
    description: "Exercise an asynchronous output schema.",
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.object({ id: z.string() }).refine(async () => {
      await delay(200);
      return true;
    }),
    backendInputSchema: z.object({ id: z.string() }),
    backendOutputSchema: z.object({ id: z.string() }),
    mapInput: ({ id }) => ({ id }),
    adapter: ({ id }) => {
      slowOutputAdapterCalls += 1;
      return { id };
    },
    mapOutput: ({ id }) => ({ text: id, data: { id } }),
  });
  const app = createEmseepea({
    name: "mapped-adapter-test",
    version: "0.0.0",
    tools: [memoryTool, fileTool, slowInputTool, slowOutputTool],
    toolTimeoutMs: 40,
  });
  const running = await serveEmseepea(app, { port: 0 });

  try {
    const invalidInput = await rpc(running.url, "lookup-memory-bean", { id: 42 });
    assert.equal(invalidInput.body.result.isError, true);
    assert.equal(inputMaps, 0);
    assert.equal(memoryCalls, 0);

    const invalidCommand = await rpc(
      running.url,
      "lookup-memory-bean",
      { id: "map-bean", invalidCommand: true },
    );
    assert.equal(invalidCommand.response.status, 200);
    assert.equal(memoryCalls, 0);
    assert.equal(outputMaps, 0);

    const valid = await rpc(running.url, "lookup-memory-bean", { id: "map-bean" });
    assert.deepEqual(valid.body.result.structuredContent, { id: "map-bean", roast: "medium" });
    assert.equal(memoryCalls, 1);
    assert.equal(outputMaps, 1);
    assert.ok(adapterDeadline > Date.now() - 1_000);

    const file = await rpc(running.url, "lookup-file-bean", { id: "file-bean" });
    assert.deepEqual(file.body.result.structuredContent, { id: "file-bean", roast: "light" });
    assert.equal(fileCalls, 1);

    const invalidBackend = await rpc(running.url, "lookup-memory-bean", { id: "invalid-backend" });
    assert.equal(invalidBackend.response.status, 200);
    assert.equal(outputMaps, 1);
    assert.doesNotMatch(JSON.stringify(invalidBackend.body), /invalid-backend/);

    const invalidFinal = await rpc(running.url, "lookup-memory-bean", { id: "invalid-final" });
    assert.equal(invalidFinal.response.status, 200);
    assert.equal(invalidFinal.body.result.structuredContent, undefined);
    assert.equal(invalidFinal.body.result.content[0].text, "Tool execution failed");

    const backendError = await rpc(running.url, "lookup-memory-bean", { id: "backend-secret" });
    assert.equal(backendError.response.status, 200);
    assert.doesNotMatch(JSON.stringify(backendError.body), /backend-secret-sentinel/);

    const timedOut = await rpc(running.url, "lookup-memory-bean", { id: "slow" });
    assert.equal(timedOut.response.status, 200);
    assert.equal(adapterCancelled, true);
    assert.doesNotMatch(JSON.stringify(timedOut.body), /AbortError|stack|slow/i);

    const slowInputStarted = Date.now();
    const slowInput = await rpc(running.url, "slow-input-schema", { id: "slow-input" });
    assert.equal(slowInput.body.result.content[0].text, "Tool execution failed");
    assert.equal(slowInputAdapterCalls, 0);
    assert.ok(Date.now() - slowInputStarted < 150, "input validation exceeded the tool deadline");

    const slowOutputStarted = Date.now();
    const slowOutput = await rpc(running.url, "slow-output-schema", { id: "slow-output" });
    assert.equal(slowOutput.body.result.content[0].text, "Tool execution failed");
    assert.equal(slowOutputAdapterCalls, 1);
    assert.ok(Date.now() - slowOutputStarted < 150, "output validation exceeded the tool deadline");
    await delay(220);
    assert.equal(slowInputAdapterCalls, 0);
  } finally {
    await running.close();
    await rm(filePath);
  }
});

test("disconnect cancels a cooperating adapter", async () => {
  let startAdapter;
  const adapterStarted = new Promise((resolve) => { startAdapter = resolve; });
  let observeCancellation;
  const cancelled = new Promise((resolve) => { observeCancellation = resolve; });
  const tool = defineMappedTool({
    name: "disconnect-adapter",
    access: "public",
    description: "Wait until the caller disconnects.",
    inputSchema: z.object({}),
    outputSchema: z.object({ done: z.boolean() }),
    backendInputSchema: z.object({}),
    backendOutputSchema: z.object({ done: z.boolean() }),
    mapInput: () => ({}),
    async adapter(_command, { signal }) {
      startAdapter();
      signal.addEventListener("abort", observeCancellation, { once: true });
      await delay(5_000, undefined, { signal });
    },
    mapOutput: (value) => ({ text: "done", data: value }),
  });
  const app = createEmseepea({
    name: "disconnect-test",
    version: "0.0.0",
    tools: [tool],
    toolTimeoutMs: 1_000,
  });
  const running = await serveEmseepea(app, { port: 0 });
  const controller = new AbortController();

  try {
    const request = rpc(running.url, "disconnect-adapter", {}, undefined, controller.signal);
    await adapterStarted;
    controller.abort();
    await assert.rejects(request, /abort/i);
    await Promise.race([
      cancelled,
      delay(200).then(() => assert.fail("adapter did not observe disconnect cancellation")),
    ]);
  } finally {
    await running.close();
  }
});

test("protected mapped tools reject authorization failures before adapter execution", async () => {
  let verifierCalls = 0;
  let adapterCalls = 0;
  const tool = defineMappedTool({
    name: "protected-adapter",
    access: "protected",
    requiredScopes: ["beans:read"],
    description: "Read one protected synthetic bean.",
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.object({ id: z.string() }),
    backendInputSchema: z.object({ id: z.string() }),
    backendOutputSchema: z.object({ id: z.string() }),
    mapInput: ({ id }) => ({ id }),
    adapter: ({ id }) => {
      adapterCalls += 1;
      return { id };
    },
    mapOutput: ({ id }) => ({ text: id, data: { id } }),
  });
  const app = createEmseepea({
    name: "protected-adapter-test",
    version: "0.0.0",
    tools: [tool],
    oauth: {
      verifier: {
        async verifyAccessToken() {
          verifierCalls += 1;
          throw new OAuthError(OAuthErrorCode.InvalidToken, "invalid");
        },
      },
      metadata: {
        resourceServerUrl: new URL("https://api.example/mcp"),
        scopesSupported: ["beans:read"],
        oauthMetadata: {
          issuer: "https://auth.example",
          authorization_endpoint: "https://auth.example/authorize",
          token_endpoint: "https://auth.example/token",
          response_types_supported: ["code"],
        },
      },
    },
  });
  const running = await serveEmseepea(app, { port: 0 });

  try {
    assert.equal((await rpc(running.url, "protected-adapter", { id: "missing" })).response.status, 401);
    assert.equal(verifierCalls, 0);
    assert.equal(adapterCalls, 0);
    assert.equal((await rpc(running.url, "protected-adapter", { id: "invalid" }, "bad")).response.status, 401);
    assert.equal(verifierCalls, 1);
    assert.equal(adapterCalls, 0);
  } finally {
    await running.close();
  }
});

async function rpc(url, name, args, token, signal) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": "tools/call",
    "Mcp-Name": name,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name, arguments: args, _meta: meta },
    }),
  });
  return { response, body: await response.json() };
}
