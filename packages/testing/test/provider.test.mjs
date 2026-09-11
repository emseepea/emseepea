import assert from "node:assert/strict";
import test from "node:test";

import {
  conversationInvocation,
  modelInvocation,
  parseClaudeEvents,
  parseJudgeVerdict,
  parseNativeClaudeEvents,
} from "../semantic/provider.mjs";

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
const expiredAuthentication = {
  ...result,
  is_error: true,
  result: "Failed to authenticate: OAuth session expired and could not be refreshed",
};

test("accepts one tool-free answer from the required model", () => {
  assert.equal(parseClaudeEvents(JSON.stringify(result)).answer, "One matching bean");
  const forbiddenTool = JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "PRIVATE_MODEL_TEXT" }] },
  });
  assert.throws(() => parseClaudeEvents([
    JSON.stringify({ type: "assistant", message: { content: [
      { type: "tool_use", name: "ToolSearch" },
      { type: "tool_use", name: "PRIVATE_MODEL_TEXT" },
    ] } }),
    JSON.stringify({ ...result, num_turns: 3 }),
  ].join("\n")), (error) => error.toolSearchToolCount === 1 && error.unknownToolCount === 1
    && !JSON.stringify(error).includes("PRIVATE_MODEL_TEXT"));
  assert.throws(() => parseClaudeEvents(`${forbiddenTool}\n${JSON.stringify(result)}`), /forbidden tool/);
  assert.throws(() => parseClaudeEvents(JSON.stringify({ ...result, num_turns: 2 })), /unexpected number/);
  assert.throws(
    () => parseClaudeEvents(JSON.stringify({ ...result, num_turns: "sk-ant-private-secret" })),
    (error) => error.message === "Model command returned an invalid turn count",
  );
  assert.throws(() => parseClaudeEvents(JSON.stringify({ ...result, modelUsage: {} })), /required model/);
  assert.throws(
    () => parseClaudeEvents(JSON.stringify({ ...result, is_error: true, subtype: "error_max_turns" })),
    /exceeded its turn limit/,
  );
  assert.throws(
    () => parseClaudeEvents(JSON.stringify({ ...result, is_error: true, subtype: "sk-ant-private-secret" })),
    (error) => error.message === "Model command reported an error",
  );
  assert.throws(
    () => parseClaudeEvents(JSON.stringify(expiredAuthentication)),
    (error) => error.message === "Model command is not signed in" && !error.message.includes("OAuth"),
  );
  assert.equal(parseClaudeEvents(JSON.stringify({
    ...result,
    result: expiredAuthentication.result,
  })).answer, expiredAuthentication.result);
  assert.throws(() => parseClaudeEvents("not-json"), /invalid event data/);
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
    const invocation = modelInvocation("claude-ci", "question", "/tmp/neutral");
    assert.equal(invocation.command, "/opt/claude");
    assert.equal(invocation.env.CLAUDE_CODE_OAUTH_TOKEN, "subscription-token");
    assert.equal(invocation.env.ANTHROPIC_API_KEY, undefined);
    assert.equal(invocation.env.ENABLE_TOOL_SEARCH, "false");
    assert.equal(invocation.env.HOME, "/tmp/neutral");
    assert.equal(invocation.args[invocation.args.indexOf("--tools") + 1], "");
    assert.equal(invocation.args.includes("--json-schema"), false);
    assert.ok(invocation.args.includes("--no-session-persistence"));
    assert.equal(invocation.args[invocation.args.indexOf("--max-turns") + 1], "4");
  } finally {
    restore("ANTHROPIC_API_KEY", original.apiKey);
    restore("CLAUDE_CODE_OAUTH_TOKEN", original.token);
    restore("EMSEEPEA_MODEL_COMMAND", original.command);
    restore("HOME", original.home);
  }
});

test("native conversations expose only the target MCP tools without coaching", () => {
  const tools = [{ name: "get-pea", description: "Get a pea.", inputSchema: { type: "object" } }];
  const invocation = conversationInvocation(
    "claude-local",
    "/tmp/neutral",
    "http://127.0.0.1:4321/mcp",
    tools,
    "private-token",
  );
  assert.equal(invocation.args[invocation.args.indexOf("--input-format") + 1], "stream-json");
  assert.equal(invocation.args[invocation.args.indexOf("--tools") + 1], "mcp__emseepea_eval__get-pea");
  assert.equal(invocation.args.includes("--json-schema"), false);
  assert.equal(invocation.args.includes("--safe-mode"), false);
  assert.equal(invocation.args.includes("Choose the MCP tool calls"), false);
  const config = JSON.parse(invocation.args[invocation.args.indexOf("--mcp-config") + 1]);
  assert.deepEqual(config, { mcpServers: { emseepea_eval: {
    type: "http",
    url: "http://127.0.0.1:4321/mcp",
    headers: { Authorization: "Bearer ${EMSEEPEA_SEMANTIC_MCP_TOKEN}" },
  } } });
  assert.equal(JSON.stringify(invocation.args).includes("private-token"), false);
  assert.equal(invocation.env.EMSEEPEA_SEMANTIC_MCP_TOKEN, "private-token");
});

test("native conversations do not expose a server with no advertised tools", () => {
  const invocation = conversationInvocation(
    "claude-local",
    "/tmp/neutral",
    "http://127.0.0.1:4321/mcp",
    [],
    "private-token",
  );
  assert.equal(invocation.args.includes("--mcp-config"), false);
  assert.equal(invocation.args[invocation.args.indexOf("--tools") + 1], "");
  assert.equal(invocation.env.EMSEEPEA_SEMANTIC_MCP_TOKEN, undefined);

  const parsed = parseNativeClaudeEvents([
    { type: "system", subtype: "init", tools: [], mcp_servers: [] },
    { ...result, num_turns: 1, result: "No lookup tool is available." },
  ], [], true);
  assert.deepEqual(parsed.calls, []);
});

test("native tool assertions come from provider MCP events", () => {
  const tools = [{ name: "get-pea" }];
  const events = [
    { type: "system", subtype: "init", tools: ["mcp__emseepea_eval__get-pea"],
      mcp_servers: [{ name: "emseepea_eval", status: "connected" }] },
    { type: "assistant", message: { content: [{
      type: "tool_use", id: "call-1", name: "mcp__emseepea_eval__get-pea", input: { name: "Snap" },
    }] } },
    { type: "user", message: { role: "user", content: [{
      type: "tool_result", tool_use_id: "call-1", content: '{"name":"Snap"}',
    }] } },
    { ...result, num_turns: 2, result: "Snap is a pea." },
  ];
  const parsed = parseNativeClaudeEvents(events, tools);
  assert.deepEqual(parsed.calls, [{ name: "get-pea", arguments: { name: "Snap" } }]);
  assert.deepEqual(parsed.toolResults, [{ content: '{"name":"Snap"}', isError: false }]);
  const failedResult = structuredClone(events);
  failedResult[2].message.content[0].is_error = true;
  assert.deepEqual(parseNativeClaudeEvents(failedResult, tools).toolResults, [
    { content: '{"name":"Snap"}', isError: true },
  ]);
  assert.equal(parsed.pathEvidence[0].target, "get-pea");
  assert.throws(() => parseNativeClaudeEvents(events.map((event) => event.type === "assistant"
    ? { ...event, message: { content: [{
      type: "tool_use", id: "call-1", name: "Read", input: {},
    }] } }
    : event), tools), /forbidden tool/);
  assert.throws(() => parseNativeClaudeEvents(events.slice(1), tools, true), /initialization evidence/);
  assert.throws(
    () => parseNativeClaudeEvents([expiredAuthentication], []),
    (error) => error.message === "Model command is not signed in" && !error.message.includes("OAuth"),
  );
  assert.equal(parseNativeClaudeEvents([{ ...expiredAuthentication, is_error: false }], []).answer,
    expiredAuthentication.result);

  const excessive = Array.from({ length: 4 }, (_, index) => ({
    type: "assistant",
    message: { content: [{
      type: "tool_use",
      id: `call-${index}`,
      name: "mcp__emseepea_eval__get-pea",
      input: { name: `Pea ${index}` },
    }] },
  }));
  assert.throws(
    () => parseNativeClaudeEvents(excessive, tools),
    (error) => error.message === "Model command used more than three tools"
      && error.attemptedToolCalls.length === 4,
  );
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
