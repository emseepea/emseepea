import assert from "node:assert/strict";
import test from "node:test";

import { createMcpAppController } from "@emseepea/server/ui";
import { createMcpAppHostSimulator } from "../dist/index.js";

test("simulates the complete MCP Apps controller lifecycle", async () => {
  const host = createMcpAppHostSimulator({
    hostContext: { theme: "light", displayMode: "inline" },
  });
  const controller = createMcpAppController({
    name: "Test result",
    version: "1.0.0",
    requestId: "test-app",
    parseResult: parseResult,
  });

  controller.connect(host.channel);
  assert.equal(host.initialized(), true);
  assert.deepEqual(controller.getState(), {
    status: "ready",
    result: null,
    resultRevision: 0,
    hostContext: { theme: "light", displayMode: "inline" },
    error: undefined,
  });

  host.deliverToolResult({ value: "first" });
  assert.equal(controller.getState().result.value, "first");
  assert.equal(controller.getState().resultRevision, 1);

  host.changeHostContext({ theme: "dark" });
  assert.deepEqual(controller.getState().hostContext, { theme: "dark", displayMode: "inline" });

  const successful = controller.sendMessage("Continue with the result.");
  const successRequest = host.messageRequests()[0];
  assert.equal(successRequest.text, "Continue with the result.");
  successRequest.succeed();
  await successful;

  const rejected = controller.sendMessage("Reject this action.");
  const rejectedRequest = host.messageRequests()[1];
  assert.equal(rejectedRequest.text, "Reject this action.");
  rejectedRequest.reject("Action denied");
  await assert.rejects(rejected, /host rejected the message/i);

  host.cancel("user cancelled");
  assert.equal(controller.getState().status, "cancelled");
  await host.teardown("test complete");
  assert.equal(controller.getState().status, "cancelled");
});

test("keeps malformed and untrusted host messages outside the controller boundary", () => {
  const host = createMcpAppHostSimulator();
  const controller = createMcpAppController({
    name: "Test result",
    version: "1.0.0",
    requestId: "boundary-app",
    parseResult,
  });
  controller.connect(host.channel);
  host.deliverToolResult({ value: "trusted" });

  host.dispatch({
    jsonrpc: "1.0",
    method: "ui/notifications/tool-result",
    params: { structuredContent: { value: "malformed" } },
  });
  host.dispatchUntrusted({
    jsonrpc: "2.0",
    method: "ui/notifications/tool-result",
    params: { structuredContent: { value: "forged" } },
  });
  assert.equal(controller.getState().result.value, "trusted");
  assert.equal(controller.getState().resultRevision, 1);

  host.deliverToolResult({ value: 42 });
  assert.equal(controller.getState().status, "error");
  assert.equal(controller.getState().error, "The result could not be displayed.");
});

function parseResult(value) {
  if (!value || typeof value !== "object" || typeof value.value !== "string") {
    throw new TypeError("Invalid result");
  }
  return { value: value.value };
}
