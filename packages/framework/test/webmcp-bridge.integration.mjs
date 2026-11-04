import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createNativeWebMcpBridge } from "../test-support/webmcp-semantic-bridge.mjs";

test("the isolated model bridge invokes only actual native page tools and records backend correlation", async (t) => {
  const fixture = await createNativeWebMcpBridge();
  t.after(() => fixture.close());
  const client = new Client({ name: "independent-bridge-check", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(fixture.url));
  t.after(() => client.close());
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(({ name }) => name).sort(), fixture.nativeTools.map(({ name }) => name).sort());
  assert.deepEqual(tools.map(({ name }) => name).sort(), ["get-batch-stock", "lookup-variety", "submit-feedback"]);
  for (const tool of tools) {
    const native = fixture.nativeTools.find(({ name }) => name === tool.name);
    assert.equal(tool.description, native.description);
    // JSON Schema omission and {} both permit arbitrary additional properties.
    const schema = structuredClone(native.inputSchema);
    if (schema.additionalProperties === undefined) schema.additionalProperties = {};
    assert.deepEqual(tool.inputSchema, schema);
  }
  const invalid = await client.callTool({ name: "lookup-variety", arguments: { name: "unknown" } });
  assert.equal(invalid.isError, true);
  assert.equal(await fixture.page.evaluate(async () => {
    const tool = (await document.modelContext.getTools()).find(({ name }) => name === "lookup-variety");
    try { return JSON.parse(await document.modelContext.executeTool(tool, { name: "unknown" })).isError === true; }
    catch { return true; }
  }), true);
  assert.equal(fixture.observations.length, 0);
  assert.equal(fixture.events.length, 0);
  const variety = await client.callTool({ name: "lookup-variety", arguments: { name: "Highland Snap" } });
  const stock = await client.callTool({ name: "get-batch-stock", arguments: { batchId: variety.structuredContent.batchId } });
  assert.deepEqual(stock.structuredContent, { batchId: "HS-27", availablePackets: 12 });
  const feedback = await client.callTool({ name: "submit-feedback", arguments: {
    observation: "notable_success", detail: "The synthetic two-step lookup preserved the stock batch identity.",
  } });
  assert.equal(typeof feedback.structuredContent.id, "string");
  assert.equal(fixture.events.length, 3);
  assert.equal(fixture.observations.length, 3);
  for (const [index, event] of fixture.events.entries()) {
    assert.equal(event.failed, false);
    assert.equal(event.backend.length, index + 1);
    assert.equal(event.backend.at(-1).name, event.name);
    assert.deepEqual(JSON.parse(JSON.stringify(event.backend.at(-1).arguments)), event.arguments);
    assert.deepEqual(JSON.parse(event.rawResult), event.result);
    assert.deepEqual(JSON.parse(event.visibleResult), event.result);
    if (event.name !== "submit-feedback") assert.deepEqual(event.backend.at(-1).data, event.result.structuredContent);
    else assert.equal(event.backend.at(-1).data.id, event.result.structuredContent.id);
  }
  await fixture.page.evaluate(() => globalThis.syntheticWebMcp.registration.dispose());
  const missingNative = await client.callTool({ name: "lookup-variety", arguments: { name: "Highland Snap" } });
  assert.equal(missingNative.isError, true);
  assert.equal(fixture.events.at(-1).failed, true);
  assert.equal(fixture.observations.length, 3);
  await fixture.close();
  assert.equal(fixture.page.isClosed(), true);
  await assert.rejects(fetch(fixture.url));
});
