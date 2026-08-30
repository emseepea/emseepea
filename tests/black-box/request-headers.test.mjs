import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const header = (name) => ({ "x-mcp-header": name });

test("invalid custom request-header declarations fail when a tool is defined", () => {
  const invalid = [
    z.object({ value: z.string() }).meta(header("Root")),
    z.object({ value: z.string().meta(header("")) }),
    z.object({ value: z.string().meta(header(42)) }),
    z.object({ value: z.string().meta(header("Bad Header")) }),
    z.object({ value: z.number().meta(header("Value")) }),
    z.object({ value: z.object({ nested: z.string() }).meta(header("Value")) }),
    z.object({ values: z.array(z.string().meta(header("Value"))) }),
    z.object({ left: z.string().meta(header("Value")), right: z.boolean().meta(header("value")) }),
  ];

  for (const inputSchema of invalid) {
    assert.throws(() => defineTool({
      name: "invalid-header-tool",
      access: "public",
      description: "This tool must not be registered.",
      inputSchema,
      outputSchema: z.object({}),
      handler: () => ({ text: "no", data: {} }),
    }), /x-mcp-header/);
  }
});

test("custom request headers mirror checked primitive tool arguments", async () => {
  let handlerCalls = 0;
  const inputSchema = z.object({
    route: z.object({ region: z.string().meta(header("Region")) }),
    priority: z.number().int().meta(header("Priority")),
    preview: z.boolean().meta(header("Preview")),
    note: z.string().optional().meta(header("Note")),
  });
  const tool = defineTool({
    name: "route-report",
    access: "public",
    description: "Return the checked routing arguments.",
    inputSchema,
    outputSchema: inputSchema,
    handler: (input) => {
      handlerCalls += 1;
      return { text: "routed", data: input };
    },
  });
  const app = createEmseepea({ name: "request-header-test", version: "0.0.0", tools: [tool] });
  const running = await serveEmseepea(app, { port: 0 });
  const client = new Client(
    { name: "request-header-client", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(new StreamableHTTPClientTransport(running.url));

  try {
    const listed = await client.listTools();
    const listedInput = listed.tools.find(({ name }) => name === "route-report").inputSchema;
    assert.equal(listedInput.properties.route.properties.region["x-mcp-header"], "Region");
    assert.equal(listedInput.properties.priority["x-mcp-header"], "Priority");
    assert.equal(listedInput.properties.preview["x-mcp-header"], "Preview");

    const ordinary = await client.callTool({
      name: "route-report",
      arguments: { route: { region: "north" }, priority: 3, preview: false },
    });
    assert.equal(ordinary.isError, false);
    const encoded = await client.callTool({
      name: "route-report",
      arguments: { route: { region: "Café\nNorth" }, priority: 4, preview: true },
    });
    assert.equal(encoded.isError, false);
    assert.equal(handlerCalls, 2);

    const matching = await rpc(running.url, {
      Region: "north",
      Priority: "3",
      Preview: "false",
      Unknown: "ignored",
    });
    assert.equal(matching.response.status, 200);
    assert.equal(handlerCalls, 3);

    for (const headers of [
      { Priority: "3", Preview: "false" },
      { Region: "south", Priority: "3", Preview: "false" },
      { Region: "=?base64?not-valid?=", Priority: "3", Preview: "false" },
    ]) {
      const rejected = await rpc(running.url, headers);
      assert.equal(rejected.response.status, 400);
      assert.equal(rejected.body.error.code, -32020);
    }
    assert.equal(handlerCalls, 3);
  } finally {
    await client.close();
    await running.close();
  }
});

async function rpc(url, parameters) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "tools/call",
      "Mcp-Name": "route-report",
      ...Object.fromEntries(Object.entries(parameters).map(([name, value]) => [`Mcp-Param-${name}`, value])),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: "route-report",
        arguments: { route: { region: "north" }, priority: 3, preview: false },
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "raw-header-client", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  return { response, body: await response.json() };
}
