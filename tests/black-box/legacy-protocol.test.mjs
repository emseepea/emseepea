import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createEmseepea, defineResource, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const legacyVersions = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07",
];

test("the same stateless POST endpoint serves the exact legacy protocol subset", async () => {
  let handlerCalls = 0;
  let resourceCalls = 0;
  const app = createEmseepea({
    name: "legacy-protocol-test",
    version: "0.0.0",
    tools: [defineTool({
      name: "echo-version",
      access: "public",
      description: "Echo a protocol test value.",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      handler({ value }) {
        handlerCalls += 1;
        return { data: { value } };
      },
    })],
    resources: [defineResource({
      access: "public",
      name: "legacy-resource",
      uri: "legacy://resource/aggregate",
      handler() {
        resourceCalls += 1;
        return { contents: [
          { uri: "returned://legacy/summary", text: "legacy summary" },
          { uri: "returned://legacy/data", mimeType: "application/octet-stream", blob: "BAU=" },
        ] };
      },
    })],
  });
  const running = await serveEmseepea(app, { port: 0 });

  try {
    await Promise.all(legacyVersions.map(async (version) => {
      const transport = new StreamableHTTPClientTransport(running.url);
      const client = new Client(
        { name: `legacy-${version}`, version: "0.0.0" },
        { supportedProtocolVersions: [version], versionNegotiation: { mode: "legacy" } },
      );
      await client.connect(transport);
      try {
        assert.equal(client.getNegotiatedProtocolVersion(), version);
        assert.equal(transport.sessionId, undefined);
        assert.deepEqual((await client.listTools()).tools.map(({ name }) => name), ["echo-version"]);
        const result = await client.callTool({ name: "echo-version", arguments: { value: version } });
        assert.deepEqual(result.structuredContent, { value: version });
        assert.deepEqual(
          (await client.readResource({ uri: "legacy://resource/aggregate" })).contents,
          [
            { uri: "returned://legacy/summary", text: "legacy summary" },
            { uri: "returned://legacy/data", mimeType: "application/octet-stream", blob: "BAU=" },
          ],
        );
        assert.equal(transport.sessionId, undefined);
      } finally {
        await client.close();
      }
    }));
    assert.equal(handlerCalls, legacyVersions.length);
    assert.equal(resourceCalls, legacyVersions.length);

    const conflictingHeaders = await rawRequest(running.url, {
      "MCP-Protocol-Version": ["2025-11-25", "2024-11-05"],
    }, {
      jsonrpc: "2.0",
      id: "conflicting-headers",
      method: "tools/call",
      params: { name: "echo-version", arguments: { value: "blocked" } },
    });
    assert.equal(conflictingHeaders.status, 400);
    assert.equal(handlerCalls, legacyVersions.length);

    const modernTransport = new StreamableHTTPClientTransport(running.url);
    const modernClient = new Client(
      { name: "modern-regression", version: "0.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await modernClient.connect(modernTransport);
    try {
      assert.deepEqual((await modernClient.listTools()).tools.map(({ name }) => name), ["echo-version"]);
      assert.equal(modernTransport.sessionId, undefined);
    } finally {
      await modernClient.close();
    }

    for (const request of [
      {
        body: { jsonrpc: "2.0", id: "missing-version", method: "initialize", params: {} },
      },
      {
        body: {
          jsonrpc: "2.0",
          id: "unknown-version",
          method: "initialize",
          params: {
            protocolVersion: "2025-01-01",
            capabilities: {},
            clientInfo: { name: "unknown-version", version: "0.0.0" },
          },
        },
      },
      {
        headers: { "MCP-Protocol-Version": "2026-07-28" },
        body: {
          jsonrpc: "2.0",
          id: "mixed-legacy-body",
          method: "tools/call",
          params: { name: "echo-version", arguments: { value: "blocked" } },
        },
      },
      {
        headers: {
          "MCP-Protocol-Version": "2025-11-25",
          "Mcp-Method": "tools/call",
          "Mcp-Name": "echo-version",
        },
        body: {
          jsonrpc: "2.0",
          id: "mixed-modern-body",
          method: "tools/call",
          params: {
            name: "echo-version",
            arguments: { value: "blocked" },
            _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" },
          },
        },
      },
    ]) {
      const before = handlerCalls;
      const response = await fetch(running.url, {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          ...request.headers,
        },
        body: JSON.stringify(request.body),
      });
      assert.match(await response.text(), /"error"/);
      assert.equal(handlerCalls, before);
      assert.equal(response.headers.get("mcp-session-id"), null);
    }

    for (const method of ["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      const response = await fetch(running.url, { method });
      assert.equal(response.status, 405);
      assert.equal(response.headers.get("allow"), "POST");
    }
  } finally {
    await running.close();
  }
});

function rawRequest(url, extraHeaders, bodyValue) {
  const body = JSON.stringify(bodyValue);
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(url, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        ...extraHeaders,
      },
    }, (incoming) => {
      incoming.resume();
      incoming.on("end", () => resolve({ status: incoming.statusCode }));
    });
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}
