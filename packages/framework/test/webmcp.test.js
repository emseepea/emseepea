import assert from "node:assert/strict";
import test from "node:test";
import { registerWebMcp } from "../dist/webmcp.js";

const tool = (name, extra = {}) => ({ name, description: `Execute ${name}.`,
  inputSchema: { type: "object", properties: { value: { type: "string" } } }, ...extra });

function pageContext(failAt) {
  const tools = new Map();
  let attempts = 0;
  return { tools, async getTools() { return [...tools.values()]; },
    async registerTool(definition, { signal }) {
      if (++attempts === failAt) throw new Error("Native failure");
      if (tools.has(definition.name)) throw new Error("Collision");
      signal.throwIfAborted();
      tools.set(definition.name, definition);
      signal.addEventListener("abort", () => tools.delete(definition.name), { once: true });
    } };
}

function clientFor(tools, result = { content: [{ type: "text", text: "Done." }] }) {
  const calls = [];
  return { calls, async listTools() { return { tools }; },
    async callTool(params, options) { calls.push({ params, options }); return result; } };
}

test("WebMCP is optional when no native document is present", async () => {
  assert.deepEqual(await registerWebMcp({ client: clientFor([]) }), { available: false });
});

test("all tools across more than eight pages register by default and filtering is optional", async () => {
  const modelContext = pageContext();
  const client = clientFor([]);
  const pages = [];
  client.listTools = async (params) => {
    const page = Number(params?.cursor ?? 0); pages.push(page);
    return { tools: [tool(`tool-${page}`)], ...(page === 11 ? {} : { nextCursor: String(page + 1) }) };
  };
  const registration = await registerWebMcp({ client, modelContext });
  assert.equal(registration.tools.length, 12);
  assert.deepEqual(pages, Array.from({ length: 12 }, (_, i) => i));
  registration.dispose();
  assert.equal(modelContext.tools.size, 0);
  pages.length = 0;
  const filtered = await registerWebMcp({ client, modelContext, filter: ({ name }) => name === "tool-11" });
  assert.deepEqual(filtered.tools, ["tool-11"]);
  assert.equal(pages.length, 12);
  filtered.dispose();
});

test("generic results preserve errors, metadata, structured and multimodal content without receipts", async () => {
  const result = { isError: true, _meta: { synthetic: "retained" }, structuredContent: { reason: "declined" },
    content: [{ type: "text", text: "No receipt needed." },
      { type: "image", data: "AA==", mimeType: "image/png" },
      { type: "audio", data: "AA==", mimeType: "audio/wav" },
      { type: "resource_link", name: "Entry", uri: "test://entry" },
      { type: "resource", resource: { uri: "test://entry", text: "Body", mimeType: "text/plain" } }] };
  const modelContext = pageContext();
  const client = clientFor([tool("anything")], result);
  const registration = await registerWebMcp({ client, modelContext });
  assert.deepEqual(JSON.parse(await modelContext.tools.get("anything").execute({ value: "input" })), result);
  assert.deepEqual(client.calls[0].params, { name: "anything", arguments: { value: "input" } });
  result.isError = false;
  assert.deepEqual(JSON.parse(await modelContext.tools.get("anything").execute({})), result);
  registration.dispose();
});

test("read-only declarations map explicitly and structured output schemas are not misapplied", async () => {
  const definitions = [tool("read", { title: "Read", annotations: { readOnlyHint: true }, outputSchema: { type: "object" } }),
    tool("write", { annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } }), tool("unknown")];
  const modelContext = pageContext();
  const registration = await registerWebMcp({ client: clientFor(definitions), modelContext });
  assert.deepEqual(modelContext.tools.get("read").annotations,
    { readOnlyHint: true, consequentialHint: false, untrustedContentHint: true });
  assert.equal(modelContext.tools.get("write").annotations.consequentialHint, true);
  assert.deepEqual(modelContext.tools.get("unknown").annotations,
    { consequentialHint: true, untrustedContentHint: true });
  assert.equal(modelContext.tools.get("read").outputSchema, undefined);
  assert.deepEqual(registration.unsupported, [{ tool: "read", capability: "outputSchema" }]);
  definitions[0].inputSchema.properties.value.type = "number";
  assert.equal(modelContext.tools.get("read").inputSchema.properties.value.type, "string");
  registration.dispose();
});

test("collisions and failed partial registration preserve unrelated page tools", async () => {
  for (const failAt of [undefined, 2]) {
    const modelContext = pageContext(failAt);
    const existing = tool(failAt ? "unrelated" : "one");
    modelContext.tools.set(existing.name, existing);
    await assert.rejects(registerWebMcp({ client: clientFor([tool("one"), tool("two")]), modelContext }), /registration failed/);
    assert.deepEqual([...modelContext.tools.keys()], [existing.name]);
  }
});

test("duplicate catalogue names and repeated cursors reject registration without execution", async () => {
  for (const duplicate of [true, false]) {
    const modelContext = pageContext();
    const client = clientFor([]);
    client.listTools = async () => ({ tools: duplicate ? [tool("same"), tool("same")] : [], nextCursor: "repeat" });
    await assert.rejects(registerWebMcp({ client, modelContext }), /registration failed/);
    assert.equal(modelContext.tools.size, 0);
    assert.equal(client.calls.length, 0);
  }
});

test("opaque cursors are passed unchanged, including an empty cursor", async () => {
  const modelContext = pageContext();
  const client = clientFor([]);
  const cursors = [];
  client.listTools = async (params) => {
    cursors.push(params?.cursor);
    return params === undefined ? { tools: [tool("first")], nextCursor: "" } : { tools: [tool("second")] };
  };
  const registration = await registerWebMcp({ client, modelContext });
  assert.deepEqual(cursors, [undefined, ""]);
  assert.deepEqual(registration.tools, ["first", "second"]);
  registration.dispose();
});

test("dispose cancels pending calls and stale handles cannot use another account", async () => {
  const modelContext = pageContext();
  const client = clientFor([tool("write")]);
  let resolveCall;
  let calls = 0;
  client.callTool = async () => { calls++; return new Promise((resolve) => { resolveCall = resolve; }); };
  const registration = await registerWebMcp({ client, modelContext });
  const handle = modelContext.tools.get("write");
  const pending = handle.execute({});
  await new Promise((resolve) => setImmediate(resolve));
  registration.dispose();
  assert.equal(JSON.parse(await pending).outcome, "unknown");
  assert.equal(JSON.parse(await handle.execute({})).outcome, "not-dispatched");
  assert.equal(calls, 1);
  assert.equal(modelContext.tools.size, 0);
  resolveCall({ content: [] });
});

test("no execution retry or feedback-global concurrency gate is introduced", async () => {
  const modelContext = pageContext();
  const client = clientFor([tool("one"), tool("two")]);
  let calls = 0;
  client.callTool = async () => { calls++; throw new Error("PRIVATE transport failure"); };
  const registration = await registerWebMcp({ client, modelContext });
  const results = await Promise.all([...modelContext.tools.values()].map((definition) => definition.execute({})));
  assert.equal(calls, 2);
  for (const result of results) {
    assert.equal(JSON.parse(result).outcome, "unknown");
    assert.doesNotMatch(result, /PRIVATE/);
  }
  assert.equal(JSON.parse(await modelContext.tools.get("one").execute(null)).outcome, "not-dispatched");
  assert.equal(calls, 2);
  registration.dispose();
});

test("caller cancellation bounds clients that ignore it without claiming rollback", async () => {
  const controller = new AbortController();
  const client = clientFor([]);
  client.listTools = async () => new Promise(() => {});
  const registration = registerWebMcp({ client, modelContext: pageContext(), signal: controller.signal });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(registration, /registration failed/);
});
