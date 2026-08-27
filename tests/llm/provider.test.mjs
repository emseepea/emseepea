import assert from "node:assert/strict";
import test from "node:test";

import { parseClaudeEvents, parseCopilotEvents, parseJudgeVerdict } from "./provider.mjs";

test("Copilot evidence requires the pinned model and no tools", () => {
  const events = [
    { type: "session.mcp_servers_loaded", data: { servers: [] } },
    { type: "assistant.turn_start", data: { turnId: "1" } },
    { type: "model.call_start", data: { model: "claude-sonnet-4.6" } },
    { type: "assistant.message", data: { content: "Highland Bloom details" } },
    { type: "result", exitCode: 0 },
  ].map(JSON.stringify).join("\n");
  const parsed = parseCopilotEvents(events);
  assert.equal(parsed.answer, "Highland Bloom details");
  assert.equal(parsed.toolCallCount, 0);
  assert.throws(() => parseCopilotEvents([
    ...events.split("\n").map((line) => JSON.parse(line)),
    { type: "tool.execution_start", data: { mcpToolName: "unexpected" } },
  ].map(JSON.stringify).join("\n")), /used a tool/);
  assert.throws(
    () => parseCopilotEvents([
      { type: "session.mcp_servers_loaded", data: { servers: ["emseepea_eval"] } },
      { type: "session.warning", data: { warningType: "mcp", message: "server blocked by policy" } },
    ].map(JSON.stringify).join("\n")),
    /server blocked by policy/,
  );
  assert.throws(
    () => parseCopilotEvents(JSON.stringify({ type: "session.mcp_servers_loaded", data: { servers: [] } }), 1),
    /process exited 1 without a result/,
  );
  assert.throws(() => parseCopilotEvents(events, 1), /process exited 1/);
});

test("Claude advisory evidence rejects every tool call", () => {
  const tool = {
    type: "assistant",
    message: { content: [{ type: "tool_use", id: "tool-1", name: "mcp__emseepea_eval__create-bean-report" }] },
  };
  const result = {
    type: "result",
    is_error: false,
    result: "One matching bean",
    modelUsage: { "claude-sonnet": {} },
  };
  assert.equal(parseClaudeEvents(JSON.stringify(result)).toolCallCount, 0);
  assert.throws(() => parseClaudeEvents([tool, result].map(JSON.stringify).join("\n")), /forbidden tool/);
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
