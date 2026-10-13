import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createEmseepea, definePrompt, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

test("repeated registrations retain recursive metadata and execute input transforms", async () => {
  const node = z.object({ label: z.string(), get children() { return z.array(node); } });
  const transformed = z.object({ value: z.string().transform((value) => value.length) });
  const app = createEmseepea({ name: "metadata-cache-contract", version: "0.0.0",
    tools: [defineTool({ name: "length", access: "public", description: "Measure a value.",
      inputSchema: transformed, handler: ({ value }) => ({ content: [{ type: "text", text: String(value) }] }) }),
    defineTool({ name: "tree", access: "public", description: "Read a tree.", inputSchema: node,
      handler: ({ label }) => ({ content: [{ type: "text", text: label }] }) })],
    prompts: [definePrompt({ name: "topic", access: "public", argsSchema: z.object({ topic: z.string() }),
      complete: { topic: () => ["coffee"] },
      handler: ({ topic }) => ({ messages: [{ role: "user", content: { type: "text", text: topic } }] }) })],
  });
  const running = await serveEmseepea(app, { port: 0 });
  const client = new Client({ name: "metadata-cache-test", version: "0.0.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(running.url));
    const first = await client.listTools();
    const original = structuredClone(first);
    assert.match(JSON.stringify(first.tools.find(({ name }) => name === "tree").inputSchema), /"\$ref"/);
    first.tools.find(({ name }) => name === "length").inputSchema.properties.value.type = "number";
    assert.deepEqual(await client.listTools(), original);
    const result = await client.callTool({ name: "length", arguments: { value: "coffee" } });
    assert.equal(result.content[0].text, "6");
    const invalid = await client.callTool({ name: "tree", arguments: { label: "root", children: [{ label: 1, children: [] }] } });
    assert.equal(invalid.isError, true);
    assert.equal((await client.listPrompts()).prompts[0].arguments[0].name, "topic");
    const completion = await client.complete({ ref: { type: "ref/prompt", name: "topic" }, argument: { name: "topic", value: "co" } });
    assert.deepEqual(completion.completion.values, ["coffee"]);
  } finally {
    await client.close();
    await running.close();
  }
});
