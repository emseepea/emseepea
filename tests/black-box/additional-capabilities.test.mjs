import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { z } from "zod";

test("additional capabilities extend rather than replace an application's catalogue", async (t) => {
  const ownTool = tool("own-tool");
  const addedTool = tool("added-tool");
  const app = createEmseepea({
    name: "additional-capabilities-test",
    version: "0.0.0",
    tools: [ownTool],
    additionalTools: [addedTool],
  });
  const running = await serveEmseepea(app, { port: 0 });
  const client = new Client(
    { name: "additional-capabilities-test", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  t.after(async () => {
    await client.close();
    await running.close();
  });
  await client.connect(new StreamableHTTPClientTransport(running.url));

  assert.deepEqual((await client.listTools()).tools.map(({ name }) => name), [
    "own-tool",
    "added-tool",
  ]);
});

test("duplicate names across own and additional capabilities fail before listening", () => {
  assert.throws(() => createEmseepea({
    name: "duplicate-additional-capabilities-test",
    version: "0.0.0",
    tools: [tool("same-tool")],
    additionalTools: [tool("same-tool")],
  }), /Duplicate tool name/);
});

function tool(name) {
  return defineTool({
    name,
    access: "public",
    description: `Return ${name}.`,
    inputSchema: z.object({}),
    outputSchema: z.object({ name: z.string() }),
    handler: () => ({ data: { name } }),
  });
}
