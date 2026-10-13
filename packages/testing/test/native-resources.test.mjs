import assert from "node:assert/strict";
import test from "node:test";
import { collectResourceCatalogue, assertResourceHelperCollisions } from "../semantic/resources.mjs";
import { parseCodexEvents } from "../semantic/provider.mjs";
import { validateConversationOptions } from "../semantic/case.mjs";

const catalogue = { resources: [{ uri: "notes://welcome", name: "Welcome" }],
  resourceTemplates: [{ uriTemplate: "notes://routes/{route}", name: "Route" }] };
const helper = (tool, args, result) => ({ type: "mcp_tool_call", server: "emseepea_eval", tool,
  arguments: args, status: "completed", result: {
    content: [{ type: "text", text: JSON.stringify(result) }], structured_content: null,
  } });
const read = (uri = "notes://welcome") => helper("read_mcp_resource", { server: "emseepea_eval", uri }, {
  server: "emseepea_eval", uri, contents: [{ uri, mimeType: "text/plain", text: "Welcome" }],
});
const events = (items) => [{ type: "thread.started", thread_id: "native-thread" }, { type: "turn.started" },
  ...items.map((item) => ({ type: "item.completed", item })),
  { type: "item.completed", item: { type: "agent_message", text: "Welcome" } }, { type: "turn.completed" }];
const parse = (items, tools = []) => parseCodexEvents(events(items), tools, undefined, 0, "gpt-test", [], undefined, catalogue);

test("native resource evidence is opt-in and leaves application tool calls separate", () => {
  assert.throws(() => parseCodexEvents(events([read()]), []), /forbidden tool/);
  const tool = { type: "mcp_tool_call", server: "emseepea_eval", tool: "record", arguments: { route: "east" },
    status: "completed", result: { content: [{ type: "text", text: "Recorded" }] } };
  const result = parse([tool, read(), tool], [{ name: "record" }]);
  assert.deepEqual(result.calls, [{ name: "record", arguments: { route: "east" } }, { name: "record", arguments: { route: "east" } }]);
  assert.equal(result.resourceOperations.length, 1);
  assert.equal(result.resourceOperations[0].source, "provider-native-helper");
  assert.equal(result.providerToolCount, 2);
  assert.equal(result.providerResourceOperationCount, 1);
  assert.deepEqual(result.pathEvidence.map(x => x.method), ["tools/call", "resources/read", "tools/call"]);
});

test("static and RFC6570 template reads must match the authenticated inventory", () => {
  assert.equal(parse([read(), read("notes://routes/east")]).resourceOperations.length, 2);
  assert.throws(() => parse([read("private://unknown")]), /forbidden tool/);
  assert.throws(() => parse([{ ...read(), arguments: { server: "foreign", uri: "notes://welcome" } }]), /forbidden tool/);
  assert.throws(() => parse([{ ...read(), server: "foreign" }]), /forbidden tool/);
});

test("registered aggregate reads retain distinct content URIs without granting follow-up scope", () => {
  const result = { server: "emseepea_eval", uri: "notes://welcome", contents: [
    { uri: "notes://routes/east", text: "A returned summary." },
    { uri: "returned://synthetic/data", mimeType: "application/octet-stream", blob: "AAE=" },
  ] };
  const parsed = parse([helper("read_mcp_resource", read().arguments, result)]);
  assert.deepEqual(parsed.resourceOperations[0].result, result);
  assert.equal(parsed.providerResourceOperationCount, 1);
  assert.equal(parsed.providerToolCount, 0);
  assert.equal(parsed.pathEvidence.length, 1);
  assert.throws(() => parse([read("returned://synthetic/data")]), /forbidden tool/);
});

test("successful empty reads are recorded without inventing retrieved material", () => {
  const result = { server: "emseepea_eval", uri: "notes://welcome", contents: [] };
  const parsed = parse([helper("read_mcp_resource", read().arguments, result)]);
  assert.deepEqual(parsed.resourceOperations[0].result, result);
  assert.equal(parsed.providerResourceOperationCount, 1);
  assert.equal(parsed.providerTurnCount, 2);
  assert.equal(parsed.calls.length, 0);
});

test("resource reads reject mismatched envelopes, extra arguments and malformed results", () => {
  const invalid = [
    { ...read(), arguments: { ...read().arguments, extra: true } },
    helper("read_mcp_resource", read().arguments, { server: "foreign", uri: "notes://welcome", contents: [] }),
    helper("read_mcp_resource", read().arguments, { server: "emseepea_eval", uri: "notes://routes/east", contents: [{ uri: "notes://welcome", text: "Mismatched envelope" }] }),
    { ...read(), result: { ...read().result, structured_content: {} } },
    { ...read(), result: { content: [{ type: "text", text: "invalid" }], structured_content: null } },
    { ...read(), status: "running" },
  ];
  for (const contents of [
    [{ uri: "notes://welcome", text: "Welcome", mimeType: 42 }],
    [{ uri: "notes://welcome", text: "Welcome", blob: "SGk=" }],
    [{ uri: "notes://welcome", blob: 42 }],
  ]) invalid.push(helper("read_mcp_resource", read().arguments, { server: "emseepea_eval", uri: "notes://welcome", contents }));
  for (const item of invalid) assert.throws(() => parse([item]), /forbidden tool/);
});

test("native inventories only admit entries from the configured server and catalogue", () => {
  const listed = helper("list_mcp_resources", {}, { resources: [{ ...catalogue.resources[0], server: "emseepea_eval" }] });
  listed.server = "codex";
  const templates = helper("list_mcp_resource_templates", { server: "emseepea_eval" }, {
    resourceTemplates: [{ ...catalogue.resourceTemplates[0], server: "emseepea_eval" }],
  });
  assert.equal(parse([listed, templates]).resourceOperations.length, 2);
  for (const entry of [{ uri: "private://unknown", server: "emseepea_eval" }, { ...catalogue.resources[0], server: "foreign" }]) {
    assert.throws(() => parse([helper("list_mcp_resources", {}, { resources: [entry] })]), /forbidden tool/);
  }
});

test("empty global discovery remains noise while scoped empty inventories remain evidence", () => {
  for (const [tool, key] of [["list_mcp_resources", "resources"], ["list_mcp_resource_templates", "resourceTemplates"]]) {
    const global = helper(tool, {}, { [key]: [] });
    global.server = "codex";
    const unscoped = parse([global]);
    assert.deepEqual(unscoped.resourceOperations, []);
    assert.deepEqual(unscoped.pathEvidence, []);
    assert.equal(unscoped.providerResourceOperationCount, 0);
    const scoped = parse([{ ...global, arguments: { server: "emseepea_eval" } }]);
    assert.equal(scoped.resourceOperations.length, 1);
    assert.equal(scoped.pathEvidence.length, 1);
    assert.equal(scoped.providerResourceOperationCount, 1);
    assert.equal(scoped.resourceOperations[0].target, "emseepea_eval");
  }
});

test("failed, secret-bearing and incomplete turns remain failures with resource support", () => {
  assert.throws(() => parse([{ ...read(), status: "failed" }]), /failed MCP tool/);
  assert.throws(() => parseCodexEvents(events([read()]).slice(0, -1), [], undefined, 0, "gpt-test", [], undefined, catalogue), /incomplete turn/);
  assert.throws(() => parseCodexEvents(events([read()]), [], undefined, 0, "gpt-test", ["Welcome"], undefined, catalogue), /exposed a configured secret/);
});

test("helper/tool collisions fail closed only in opted-in conversations", () => {
  assert.throws(() => assertResourceHelperCollisions([{ name: "read_mcp_resource" }]), /collide/);
  assert.throws(() => parse([read()], [{ name: "read_mcp_resource" }]), /collide/);
  const actualTool = { ...read(), arguments: { uri: "notes://welcome" }, result: { content: [{ type: "text", text: "Welcome" }] } };
  assert.deepEqual(parseCodexEvents(events([actualTool]), [{ name: "read_mcp_resource" }]).calls,
    [{ name: "read_mcp_resource", arguments: { uri: "notes://welcome" } }]);
});

test("resource options require a boolean", () => {
  const server = new URL("./fixture.mjs", import.meta.url);
  assert.equal(validateConversationOptions({ server, nativeResources: true }).nativeResources, true);
  assert.throws(() => validateConversationOptions({ server, nativeResources: "yes" }), /boolean/);
});

test("servers without resource capability are not sent resource methods", async () => {
  assert.deepEqual(await collectResourceCatalogue({ getServerCapabilities: () => ({}) }), { resources: [], resourceTemplates: [] });
});

test("authenticated inventories consume bounded pagination for both methods", async () => {
  const requests = [];
  const client = { getServerCapabilities: () => ({ resources: {} }),
    listResources: async (args) => { requests.push(args); return args.cursor
      ? { resources: [{ uri: "notes://second" }] } : { resources: catalogue.resources, nextCursor: "page2" }; },
    listResourceTemplates: async () => ({ resourceTemplates: catalogue.resourceTemplates }) };
  const result = await collectResourceCatalogue(client);
  assert.deepEqual(requests, [{}, { cursor: "page2" }]);
  assert.equal(result.resources.length, 2);
});

test("inventories reject repeated cursors, excessive pages and oversized payloads", async () => {
  const client = { getServerCapabilities: () => ({ resources: {} }),
    listResourceTemplates: async () => ({ resourceTemplates: [] }) };
  await assert.rejects(collectResourceCatalogue({ ...client,
    listResources: async () => ({ resources: [], nextCursor: "repeat" }) }), /invalid cursor/);
  let cursor = 0;
  await assert.rejects(collectResourceCatalogue({ ...client,
    listResources: async () => ({ resources: [], nextCursor: String(++cursor) }) }), /page bound/);
  await assert.rejects(collectResourceCatalogue({ ...client,
    listResources: async () => ({ resources: [{ uri: "notes://large", description: "a".repeat(1_048_576) }] }) }), /bounds/);
});

test("cancelled resource discovery does not continue pagination", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(collectResourceCatalogue({ getServerCapabilities: () => ({ resources: {} }) }, controller.signal), /abort/i);
});
