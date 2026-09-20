import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

// A recursive schema is what actually forces the converter to emit a $defs entry
// behind a $ref. A merely reused schema is inlined, so it would not exercise it.
const treeNode = z.object({
  label: z.string(),
  get children() { return z.array(treeNode); },
});

const app = createEmseepea({
  name: "output-schema-openness-test",
  version: "0.0.0",
  tools: [
    defineTool({
      name: "plain-output",
      access: "public",
      description: "Publishes an ordinary object result.",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({
        id: z.string(),
        nested: z.object({ total: z.number() }),
        rows: z.array(z.object({ label: z.string() })),
      }),
      handler({ value }) {
        return { data: { id: value, nested: { total: 1 }, rows: [{ label: "a" }] } };
      },
    }),
    defineTool({
      name: "recursive-output",
      access: "public",
      description: "Publishes a recursive object result, which emits $defs.",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ root: treeNode }),
      handler({ value }) {
        return { data: { root: { label: value, children: [] } } };
      },
    }),
    defineTool({
      name: "strict-output",
      access: "public",
      description: "Publishes a deliberately strict object result.",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.strictObject({ id: z.string() }),
      handler({ value }) {
        return { data: { id: value } };
      },
    }),
    defineTool({
      name: "diverging-output",
      access: "public",
      description: "Publishes a strict object whose input counterpart is a string.",
      inputSchema: z.object({ value: z.string() }),
      // The transform makes the two directions disagree in shape: on the input
      // side `box` is a string, on the output side it is a strict object. A node
      // paired against a counterpart of a different kind cannot be verified, so
      // it must keep its closure rather than open.
      outputSchema: z.object({
        box: z.string().transform((id) => ({ id })).pipe(z.strictObject({ id: z.string() })),
      }),
      handler({ value }) {
        return { data: { box: value } };
      },
    }),
  ],
});

/** Every object node in a converted JSON Schema document, including $defs and array items. */
function objectNodes(node, found = []) {
  if (node === null || typeof node !== "object") return found;
  if (Array.isArray(node)) {
    for (const item of node) objectNodes(item, found);
    return found;
  }
  if (node.type === "object" || node.properties !== undefined) found.push(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "additionalProperties" && typeof value === "boolean") continue;
    objectNodes(value, found);
  }
  return found;
}

test("published output schemas are open by default and strict declarations stay closed", async () => {
  const running = await serveEmseepea(app, { port: 0 });
  const transport = new StreamableHTTPClientTransport(running.url);
  const client = new Client({ name: "openness", version: "0.0.0" });
  await client.connect(transport);

  try {
    const { tools } = await client.listTools();
    const plain = tools.find(({ name }) => name === "plain-output");
    const recursive = tools.find(({ name }) => name === "recursive-output");
    const strict = tools.find(({ name }) => name === "strict-output");

    // An ordinary object result publishes an open contract at EVERY object node --
    // top level, nested, and inside arrays.
    const plainNodes = objectNodes(plain.outputSchema);
    assert.ok(plainNodes.length >= 3, `expected several object nodes, saw ${plainNodes.length}`);
    for (const node of plainNodes) {
      assert.notEqual(
        node.additionalProperties,
        false,
        `an ordinary object result must not publish a closed node: ${JSON.stringify(node)}`,
      );
    }

    // The node reached only through $defs must open too. This is the one an
    // incomplete recursive transform misses without failing anything else.
    assert.ok(recursive.outputSchema.$defs, "expected the recursive schema to emit $defs");
    const defNodes = objectNodes(recursive.outputSchema.$defs);
    assert.ok(defNodes.length >= 1, "expected at least one object node inside $defs");
    for (const node of defNodes) {
      assert.notEqual(node.additionalProperties, false, "a $defs node must not publish closed");
    }

    // Openness is spelled the same way the input direction spells it, so the two agree.
    assert.equal(Object.hasOwn(plain.outputSchema, "additionalProperties"), false);
    assert.equal(Object.hasOwn(plain.inputSchema, "additionalProperties"), false);

    // A deliberately strict declaration keeps its closed contract.
    assert.equal(strict.outputSchema.additionalProperties, false);

    // A strict node whose input counterpart is a different kind of node must also
    // stay closed. Pairing it structurally would drop a closure the author declared.
    const diverging = tools.find(({ name }) => name === "diverging-output");
    assert.equal(diverging.outputSchema.properties.box.additionalProperties, false);
    assert.equal(Object.hasOwn(diverging.outputSchema, "additionalProperties"), false);

    // Runtime behaviour is unchanged: the response still carries only declared fields.
    const result = await client.callTool({ name: "plain-output", arguments: { value: "abc" } });
    assert.deepEqual(Object.keys(result.structuredContent).sort(), ["id", "nested", "rows"]);
    assert.equal(result.structuredContent.id, "abc");
  } finally {
    await client.close();
    await running.close();
  }
});
