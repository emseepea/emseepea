import assert from "node:assert/strict";
import test from "node:test";

import { parseClaudeEvents, parseCopilotEvents, parseJudgeVerdict } from "./provider.mjs";

test("Copilot evidence requires the pinned model and named MCP tool", () => {
  const events = [
    { type: "session.mcp_servers_loaded", data: { servers: [{ name: "emseepea_eval" }] } },
    { type: "assistant.turn_start", data: { turnId: "1" } },
    { type: "model.call_start", data: { model: "claude-sonnet-4.6" } },
    {
      type: "tool.execution_start",
      data: {
        mcpServerName: "emseepea_eval",
        mcpToolName: "get-bean-details",
        toolCallId: "tool-1",
      },
    },
    { type: "tool.execution_complete", data: { toolCallId: "tool-1", success: true } },
    { type: "assistant.message", data: { content: "Highland Bloom details" } },
    { type: "result", exitCode: 0 },
  ].map(JSON.stringify).join("\n");
  const parsed = parseCopilotEvents(events, "get-bean-details");
  assert.equal(parsed.answer, "Highland Bloom details");
  assert.deepEqual(parsed.pathEvidence, [{
    server: "emseepea_eval",
    method: "tools/call",
    target: "get-bean-details",
  }]);
  assert.throws(
    () => parseCopilotEvents(events.replace("get-bean-details", "wrong-tool"), "get-bean-details"),
    /outside the named MCP path/,
  );
  assert.throws(
    () => parseCopilotEvents(events.replace('"success":true', '"success":false'), "get-bean-details"),
    /did not complete successfully/,
  );
  assert.throws(
    () => parseCopilotEvents(events.replace(/\n\{"type":"tool.execution_complete"[^\n]+/, ""), "get-bean-details"),
    /did not complete successfully/,
  );
  assert.throws(
    () => parseCopilotEvents([
      { type: "session.mcp_servers_loaded", data: { servers: [] } },
      { type: "session.warning", data: { warningType: "mcp", message: "server blocked by policy" } },
    ].map(JSON.stringify).join("\n"), "get-bean-details"),
    /server blocked by policy/,
  );
});

test("Claude advisory evidence rejects excess MCP calls", () => {
  const tool = {
    type: "assistant",
    message: { content: [{ type: "tool_use", id: "tool-1", name: "mcp__emseepea_eval__create-bean-report" }] },
  };
  const toolResult = {
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: "tool-1", content: "result" }] },
  };
  const result = {
    type: "result",
    is_error: false,
    result: "One matching bean",
    modelUsage: { "claude-sonnet": {} },
  };
  const valid = [tool, toolResult, result].map(JSON.stringify).join("\n");
  assert.equal(parseClaudeEvents(valid, "create-bean-report").toolCallCount, 1);
  const excessive = [tool, tool, tool, tool, toolResult, result].map(JSON.stringify).join("\n");
  assert.throws(() => parseClaudeEvents(excessive, "create-bean-report"), /exceeded 3/);
  assert.throws(
    () => parseClaudeEvents([tool, result].map(JSON.stringify).join("\n"), "create-bean-report"),
    /did not complete successfully/,
  );
  assert.throws(
    () => parseClaudeEvents([tool, {
      ...toolResult,
      message: { content: [{ ...toolResult.message.content[0], is_error: true }] },
    }, result].map(JSON.stringify).join("\n"), "create-bean-report"),
    /did not complete successfully/,
  );
});

test("judge verdicts require the exact passing contract", () => {
  assert.deepEqual(
    parseJudgeVerdict('{"pass":true,"score":1,"reason":"All criteria passed."}'),
    { pass: true, score: 1, reason: "All criteria passed." },
  );
  assert.deepEqual(
    parseJudgeVerdict('{"pass":false,"score":0,"reason":"A criterion failed."}'),
    { pass: false, score: 0, reason: "A criterion failed." },
  );
  for (const verdict of [
    '{"pass":true,"score":0,"reason":"Contradictory."}',
    '{"pass":false,"score":1,"reason":"Contradictory."}',
    '{"pass":true,"score":1,"reason":""}',
    '{"pass":true,"score":1,"reason":"Pass.","extra":true}',
  ]) {
    assert.throws(() => parseJudgeVerdict(verdict), /invalid verdict/);
  }
  assert.throws(
    () => parseJudgeVerdict('Result: {"pass":true,"score":1,"reason":"Pass."}'),
    /Unexpected token|Unexpected non-whitespace character/,
  );
});
