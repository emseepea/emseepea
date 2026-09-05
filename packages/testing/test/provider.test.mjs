import assert from "node:assert/strict";
import test from "node:test";

import { modelInvocation, parseClaudeEvents, parseJudgeVerdict } from "../semantic/provider.mjs";

const result = {
  type: "result",
  is_error: false,
  num_turns: 1,
  permission_denials: [],
  result: "One matching bean",
  modelUsage: {
    "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" },
  },
};

test("accepts one tool-free answer from the required model", () => {
  assert.equal(parseClaudeEvents(JSON.stringify(result)).answer, "One matching bean");
  const structured = JSON.stringify({
    ...result,
    num_turns: 2,
    result: "",
    structured_output: { calls: [{ name: "get-bean", arguments: {} }] },
  });
  const constrained = JSON.stringify({
    ...result,
    result: "",
    structured_output: { calls: [{ name: "get-bean", arguments: {} }] },
  });
  const structuredTool = JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "StructuredOutput" }] },
  });
  assert.deepEqual(parseClaudeEvents(`${structuredTool}\n${structured}`, 0, true), {
    answer: '{"calls":[{"name":"get-bean","arguments":{}}]}',
    models: ["claude-sonnet-4-6"],
    turnCount: 1,
    providerTurnCount: 2,
  });
  assert.equal(parseClaudeEvents(constrained, 0, true).answer, '{"calls":[{"name":"get-bean","arguments":{}}]}');
  assert.throws(() => parseClaudeEvents(`${structuredTool}\n${JSON.stringify(result)}`, 0, true), /no answer/);
  assert.throws(() => parseClaudeEvents(`${structuredTool}\n${structured}`), /forbidden tool/);
  assert.throws(() => parseClaudeEvents(`${structuredTool}\n${structuredTool}\n${structured}`, 0, true), /forbidden tool/);
  assert.throws(() => parseClaudeEvents(`${structuredTool}\n${JSON.stringify({
    ...result, num_turns: 3, structured_output: {},
  })}`, 0, true), /3 turns/);
  assert.throws(() => parseClaudeEvents([
    structuredTool,
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read" }] } }),
    structured,
  ].join("\n"), 0, true), /forbidden tool/);
  assert.throws(() => parseClaudeEvents([
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read" }] } }),
    JSON.stringify(result),
  ].join("\n")), /forbidden tool/);
  assert.throws(() => parseClaudeEvents(JSON.stringify({ ...result, num_turns: 2 })), /2 turns/);
  assert.throws(() => parseClaudeEvents(JSON.stringify({ ...result, modelUsage: {} })), /required model/);
});

test("isolates model credentials from ordinary environment variables", () => {
  const original = {
    apiKey: process.env.ANTHROPIC_API_KEY,
    command: process.env.EMSEEPEA_MODEL_COMMAND,
    home: process.env.HOME,
    token: process.env.CLAUDE_CODE_OAUTH_TOKEN,
  };
  process.env.ANTHROPIC_API_KEY = "must-not-pass";
  process.env.CLAUDE_CODE_OAUTH_TOKEN = "subscription-token";
  process.env.EMSEEPEA_MODEL_COMMAND = "/opt/claude";
  process.env.HOME = "/tmp/signed-in-home";
  try {
    const schema = { type: "object", required: ["calls"] };
    const invocation = modelInvocation("claude-ci", "question", "/tmp/neutral", schema);
    assert.equal(invocation.command, "/opt/claude");
    assert.equal(invocation.env.CLAUDE_CODE_OAUTH_TOKEN, "subscription-token");
    assert.equal(invocation.env.ANTHROPIC_API_KEY, undefined);
    assert.equal(invocation.env.HOME, "/tmp/neutral");
    assert.equal(invocation.args[invocation.args.indexOf("--tools") + 1], "");
    assert.deepEqual(JSON.parse(invocation.args[invocation.args.indexOf("--json-schema") + 1]), schema);
    assert.ok(invocation.args.includes("--no-session-persistence"));
  } finally {
    restore("ANTHROPIC_API_KEY", original.apiKey);
    restore("CLAUDE_CODE_OAUTH_TOKEN", original.token);
    restore("EMSEEPEA_MODEL_COMMAND", original.command);
    restore("HOME", original.home);
  }
});

test("requires exact judge JSON", () => {
  assert.deepEqual(
    parseJudgeVerdict('{"pass":true,"score":1,"reason":"All criteria passed."}'),
    { pass: true, score: 1, reason: "All criteria passed." },
  );
  assert.throws(
    () => parseJudgeVerdict('{"pass":true,"score":0,"reason":"Contradictory."}'),
    /invalid verdict/,
  );
});

function restore(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
