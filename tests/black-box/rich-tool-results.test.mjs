import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import {
  createEmseepea,
  defineMappedTool,
  defineStreamingTool,
  defineTool,
  serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";

const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "rich-result-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("checked tools expose complete protocol-native results", async () => {
  const rich = defineTool({
    name: "rich",
    access: "public",
    description: "Return checked protocol-native results.",
    inputSchema: z.object({ mode: z.string().optional() }),
    handler: ({ mode }) => {
      if (mode === "mixed") return { data: {}, content: [] };
      if (mode === "reserved-meta") {
        return { content: [], _meta: { "io.modelcontextprotocol/serverInfo": { name: "spoof", version: "1" } } };
      }
      if (mode === "malformed") return { content: [{ type: "image", data: "AA==", mimeType: 42 }] };
      if (mode === "oversized") return { content: [{ type: "text", text: "x".repeat(5_000) }] };
      if (mode === "unsafe") return { content: [], structuredContent: Number.NaN };
      return {
        content: [
          { type: "text", text: "ready" },
          { type: "image", data: "AA==", mimeType: "image/png" },
          { type: "audio", data: "AA==", mimeType: "audio/wav" },
          { type: "resource_link", name: "record", uri: "test://record/1" },
          { type: "resource", resource: { uri: "test://record/1", text: "record" } },
        ],
        structuredContent: ["ready", 1, true, null],
        _meta: { "example/detail": "client-visible" },
      };
    },
  });
  const mapped = defineMappedTool({
    name: "mapped",
    access: "public",
    description: "Return schema-checked protocol-native structured content.",
    inputSchema: z.object({}),
    outputSchema: z.array(z.string()),
    backendInputSchema: z.object({}),
    backendOutputSchema: z.object({ value: z.string() }),
    mapInput: () => ({}),
    adapter: () => ({ value: "mapped" }),
    mapOutput: ({ value }) => ({ content: [], structuredContent: [value] }),
  });
  const streamingError = defineStreamingTool({
    name: "streaming-error",
    access: "public",
    description: "Return a deliberate domain error without structured content.",
    inputSchema: z.object({}),
    outputSchema: z.object({ value: z.string() }),
    async handler(_input, { reportProgress }) {
      await reportProgress({ progress: 1 });
      return { content: [{ type: "text", text: "Unavailable" }], isError: true };
    },
  });
  const invalidStructured = defineTool({
    name: "invalid-structured",
    access: "public",
    description: "Reject structured content that misses its output schema.",
    inputSchema: z.object({}),
    outputSchema: z.array(z.string()),
    handler: () => ({ content: [], structuredContent: [42] }),
  });
  const missingStructured = defineTool({
    name: "missing-structured",
    access: "public",
    description: "Reject successful protocol results missing declared structured output.",
    inputSchema: z.object({}),
    outputSchema: z.array(z.string()),
    handler: () => ({ content: [] }),
  });

  const running = await serveEmseepea(createEmseepea({
    name: "rich-result-test",
    version: "0.0.0",
    tools: [rich, mapped, streamingError, invalidStructured, missingStructured],
    maxApplicationResultBytes: 2_048,
  }), { port: 0 });
  try {
    const listed = await rpc(running.url, "tools/list");
    const richListing = listed.result.tools.find(({ name }) => name === "rich");
    const mappedListing = listed.result.tools.find(({ name }) => name === "mapped");
    assert.equal(richListing.outputSchema, undefined);
    assert.equal(mappedListing.outputSchema.type, "array");

    const client = new Client(
      { name: "rich-result-client", version: "0.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await client.connect(new StreamableHTTPClientTransport(running.url));
    try {
      const result = await client.callTool({ name: "rich", arguments: {} });
      assert.deepEqual(result.content.map(({ type }) => type), [
        "text", "image", "audio", "resource_link", "resource",
      ]);
      assert.deepEqual(result.structuredContent, ["ready", 1, true, null]);
      assert.equal(result._meta["example/detail"], "client-visible");
      assert.equal(result._meta["io.modelcontextprotocol/serverInfo"].name, "rich-result-test");
    } finally {
      await client.close();
    }

    const legacyClient = new Client(
      { name: "rich-result-legacy-client", version: "0.0.0" },
      { supportedProtocolVersions: ["2025-11-25"], versionNegotiation: { mode: "legacy" } },
    );
    await legacyClient.connect(new StreamableHTTPClientTransport(running.url));
    try {
      const legacyResult = await legacyClient.callTool({ name: "rich", arguments: {} });
      assert.equal(legacyResult.content[0].text, "ready");
      assert.deepEqual(legacyResult.structuredContent, { result: ["ready", 1, true, null] });
    } finally {
      await legacyClient.close();
    }

    assert.deepEqual((await call(running.url, "mapped")).structuredContent, ["mapped"]);
    const domainError = await call(running.url, "streaming-error");
    assert.equal(domainError.isError, true);
    assert.equal(domainError.content[0].text, "Unavailable");
    assert.equal(domainError.structuredContent, undefined);

    for (const [name, args = {}] of [
      ["invalid-structured"],
      ["missing-structured"],
      ["rich", { mode: "mixed" }],
      ["rich", { mode: "reserved-meta" }],
      ["rich", { mode: "malformed" }],
      ["rich", { mode: "oversized" }],
      ["rich", { mode: "unsafe" }],
    ]) {
      const result = await call(running.url, name, args);
      assert.equal(result.isError, true, name);
      assert.deepEqual(result.content, [{ type: "text", text: "Tool execution failed" }]);
      assert.equal(result.structuredContent, undefined);
    }
  } finally {
    await running.close();
  }
});

async function call(url, name, args = {}) {
  return (await rpc(url, "tools/call", { name, arguments: args })).result;
}

async function rpc(url, method, params = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(method === "tools/call" ? { "Mcp-Name": params.name } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: { ...params, _meta: requestMeta },
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  return body;
}
