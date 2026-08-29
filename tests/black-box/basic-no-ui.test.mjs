import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
  createEmseepea,
  defineTool,
  serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";

const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": {
    name: "emseepea-black-box",
    version: "0.0.0",
  },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("tool access must be explicit", () => {
  assert.throws(() => defineTool({
    name: "implicit-tool",
    description: "This tool must not register.",
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    handler: () => ({ text: "no", data: {} }),
  }), /access must be explicitly declared/);
});

test("the no-UI beachhead works through the public HTTP boundary", async () => {
  let handlerCalls = 0;

  const tool = defineTool({
    name: "lookup-bean",
    access: "public",
    description: "Look up a synthetic coffee bean record.",
    inputSchema: z.object({
      id: z.string().min(1),
      delayMs: z.number().int().min(0).max(1_000).optional(),
    }),
    outputSchema: z.object({
      id: z.string(),
      roast: z.enum(["light", "medium", "dark"]),
    }),
    async handler({ id, delayMs = 0 }, { signal }) {
      handlerCalls += 1;
      if (delayMs > 0) {
        await delay(delayMs, undefined, { signal });
      }
      if (id === "invalid-output") {
        return { text: "must-not-leak", data: { id } };
      }
      if (id === "oversized-output") {
        return { text: "x".repeat(1_000), data: { id, roast: "medium" } };
      }
      return { text: `${id}: medium`, data: { id, roast: "medium" } };
    },
  });

  const handler = createEmseepea({
    name: "emseepea-test",
    version: "0.0.0",
    tools: [tool],
    maxRequestBytes: 1_024,
    maxApplicationResultBytes: 256,
    operationTimeoutMs: 40,
  });
  const running = await serveEmseepea(handler, { port: 0 });

  try {
    const health = await fetch(new URL("/healthz", running.url));
    assert.equal(health.status, 200);
    assert.equal(await health.text(), "ok\n");

    const discover = await rpc(running.url, "server/discover");
    assert.equal(discover.response.status, 200);
    assert.deepEqual(discover.body.result.supportedVersions, ["2026-07-28"]);
    assert.deepEqual(discover.body.result.capabilities.tools, {
      listChanged: false,
    });

    const disabledSubscription = await rpc(
      running.url,
      "subscriptions/listen",
      { subscriptions: { toolsListChanged: true } },
    );
    assert.equal(disabledSubscription.response.status, 404);
    assert.equal(disabledSubscription.body.error.code, -32601);

    const list = await rpc(running.url, "tools/list");
    assert.equal(list.response.status, 200);
    assert.deepEqual(list.body.result.tools.map(({ name }) => name), ["lookup-bean"]);
    assert.equal(list.body.result.tools[0].inputSchema.properties.id.type, "string");
    assert.deepEqual(list.body.result.tools[0].outputSchema.properties.roast.enum, [
      "light",
      "medium",
      "dark",
    ]);

    const call = await rpc(running.url, "tools/call", {
      name: "lookup-bean",
      arguments: { id: "bean-1" },
    });
    assert.equal(call.response.status, 200);
    assert.equal(call.body.result.resultType, "complete");
    assert.equal(call.body.result.content[0].text, "bean-1: medium");
    assert.deepEqual(call.body.result.structuredContent, {
      id: "bean-1",
      roast: "medium",
    });
    assert.equal(call.body.result.isError, false);
    assert.equal(handlerCalls, 1);

    const mismatched = await rpc(
      running.url,
      "tools/call",
      { name: "lookup-bean", arguments: { id: "bean-2" } },
      { "Mcp-Name": "different-tool" },
    );
    assert.equal(mismatched.response.status, 400);
    assert.equal(mismatched.body.error.code, -32020);
    assert.equal(handlerCalls, 1);

    for (const missingHeader of ["MCP-Protocol-Version", "Mcp-Method", "Mcp-Name"]) {
      const missing = await rpc(
        running.url,
        "tools/call",
        { name: "lookup-bean", arguments: { id: "missing-header" } },
        { [missingHeader]: undefined },
      );
      assert.equal(missing.response.status, 400, `${missingHeader} must be required`);
      assert.equal(missing.body.error.code, -32020);
    }
    assert.equal(handlerCalls, 1);

    for (const headers of [
      { "MCP-Protocol-Version": "2025-11-25" },
      { "Mcp-Method": "tools/list" },
      { "Mcp-Name": "=?base64?not-valid?=" },
    ]) {
      const mismatchedHeader = await rpc(
        running.url,
        "tools/call",
        { name: "lookup-bean", arguments: { id: "mismatched-header" } },
        headers,
      );
      assert.equal(mismatchedHeader.response.status, 400);
      assert.equal(mismatchedHeader.body.error.code, -32020);
    }
    assert.equal(handlerCalls, 1);

    const unsupportedVersion = "2025-11-25";
    const unsupported = await rpc(
      running.url,
      "tools/call",
      { name: "lookup-bean", arguments: { id: "unsupported-version" } },
      { "MCP-Protocol-Version": unsupportedVersion },
      { ...requestMeta, "io.modelcontextprotocol/protocolVersion": unsupportedVersion },
    );
    assert.equal(unsupported.response.status, 400);
    assert.equal(unsupported.body.error.code, -32022);
    assert.deepEqual(unsupported.body.error.data.supported, ["2026-07-28"]);
    assert.equal(handlerCalls, 1);

    const encodedName = await rpc(
      running.url,
      "tools/call",
      { name: "lookup-bean", arguments: { id: "encoded-name" } },
      { "Mcp-Name": "=?base64?bG9va3VwLWJlYW4=?=" },
    );
    assert.equal(encodedName.response.status, 200);
    assert.equal(encodedName.body.result.isError, false);
    assert.equal(handlerCalls, 2);

    const plainUnicodeName = await rpc(
      running.url,
      "tools/call",
      { name: "lookup-béan", arguments: {} },
      { "Mcp-Name": "lookup-béan" },
    );
    assert.equal(plainUnicodeName.response.status, 400);
    assert.equal(plainUnicodeName.body.error.code, -32020);

    const encodedUnicodeName = await rpc(
      running.url,
      "tools/call",
      { name: "lookup-béan", arguments: {} },
      { "Mcp-Name": "=?base64?bG9va3VwLWLDqWFu?=" },
    );
    assert.equal(encodedUnicodeName.response.status, 200);
    assert.equal(encodedUnicodeName.body.error.code, -32602);
    assert.equal(handlerCalls, 2);

    for (const [method, field] of [
      ["tools/call", "name"],
      ["prompts/get", "name"],
      ["resources/read", "uri"],
    ]) {
      for (const value of [undefined, 42]) {
        const malformedNamedRequest = await rpc(
          running.url,
          method,
          { [field]: value },
          { "Mcp-Name": "target" },
        );
        assert.equal(malformedNamedRequest.response.status, 400);
        assert.equal(malformedNamedRequest.body.error.code, -32020);
      }
    }
    assert.equal(handlerCalls, 2);

    const invalidInput = await rpc(running.url, "tools/call", {
      name: "lookup-bean",
      arguments: { id: 42 },
    });
    assert.equal(invalidInput.response.status, 200);
    assert.equal(invalidInput.body.result.isError, true);
    assert.equal(handlerCalls, 2);

    const invalidOutput = await rpc(running.url, "tools/call", {
      name: "lookup-bean",
      arguments: { id: "invalid-output" },
    });
    assert.equal(invalidOutput.response.status, 200);
    assert.doesNotMatch(JSON.stringify(invalidOutput.body), /must-not-leak/);

    const oversizedOutput = await rpc(running.url, "tools/call", {
      name: "lookup-bean",
      arguments: { id: "oversized-output" },
    });
    assert.equal(oversizedOutput.response.status, 200);
    assert.equal(oversizedOutput.body.result.content[0].text, "Tool execution failed");
    assert.equal(oversizedOutput.body.result.structuredContent, undefined);
    assert.equal(oversizedOutput.body.result.isError, true);

    const timedOut = await rpc(running.url, "tools/call", {
      name: "lookup-bean",
      arguments: { id: "slow", delayMs: 200 },
    });
    assert.equal(timedOut.response.status, 200);
    assert.doesNotMatch(JSON.stringify(timedOut.body), /AbortError|stack|timed out/i);

    const beforeDeniedRequests = handlerCalls;
    const badOrigin = await rpc(
      running.url,
      "tools/call",
      { name: "lookup-bean", arguments: { id: "bean-3" } },
      { Origin: "https://attacker.example" },
    );
    assert.equal(badOrigin.response.status, 403);
    assert.equal(handlerCalls, beforeDeniedRequests);

    const oversized = await rpc(running.url, "tools/call", {
      name: "lookup-bean",
      arguments: { id: "x".repeat(2_000) },
    });
    assert.equal(oversized.response.status, 413);
    assert.equal(handlerCalls, beforeDeniedRequests);

    const malformed = await fetch(running.url, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error.code, -32700);
    assert.equal(handlerCalls, beforeDeniedRequests);

    for (const method of ["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      const response = await fetch(running.url, { method });
      assert.equal(response.status, 405, `${method} must be rejected`);
    }

    const client = new Client(
      { name: "emseepea-independent-client", version: "0.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await client.connect(new StreamableHTTPClientTransport(running.url));
    try {
      const result = await client.callTool({
        name: "lookup-bean",
        arguments: { id: "bean-client" },
      });
      assert.equal(result.content[0].text, "bean-client: medium");
    } finally {
      await client.close();
    }
  } finally {
    await running.close();
  }
});

async function rpc(url, method, params = {}, extraHeaders = {}, meta = requestMeta) {
  const body = {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method,
    params: { ...params, _meta: meta },
  };
  const headers = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": method,
    ...(method === "tools/call" ? { "Mcp-Name": params.name } : {}),
    ...extraHeaders,
  };
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) delete headers[name];
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}
