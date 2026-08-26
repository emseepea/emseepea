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
      return { text: `${id}: medium`, data: { id, roast: "medium" } };
    },
  });

  const handler = createEmseepea({
    name: "emseepea-test",
    version: "0.0.0",
    tools: [tool],
    maxRequestBytes: 1_024,
    toolTimeoutMs: 40,
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

    const invalidInput = await rpc(running.url, "tools/call", {
      name: "lookup-bean",
      arguments: { id: 42 },
    });
    assert.equal(invalidInput.response.status, 200);
    assert.equal(invalidInput.body.result.isError, true);
    assert.equal(handlerCalls, 1);

    const invalidOutput = await rpc(running.url, "tools/call", {
      name: "lookup-bean",
      arguments: { id: "invalid-output" },
    });
    assert.equal(invalidOutput.response.status, 200);
    assert.doesNotMatch(JSON.stringify(invalidOutput.body), /must-not-leak/);

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

    const get = await fetch(running.url);
    assert.equal(get.status, 405);

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

async function rpc(url, method, params = {}, extraHeaders = {}) {
  const body = {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method,
    params: { ...params, _meta: requestMeta },
  };
  const headers = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": method,
    ...extraHeaders,
  };

  if (method === "tools/call" && !("Mcp-Name" in headers)) {
    headers["Mcp-Name"] = params.name;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}
