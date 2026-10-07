import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  conversationInvocation,
  modelInvocation,
  parseClaudeEvents,
  parseCodexEvents,
  parseJudgeVerdict,
  parseNativeClaudeEvents,
  providerModel,
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

test("Codex events retain native MCP calls and require a complete resumable turn", () => {
  const events = [
    { type: "thread.started", thread_id: "thread-1" },
    { type: "turn.started" },
    { type: "item.completed", item: { id: "item-1", type: "mcp_tool_call",
      server: "emseepea_eval", tool: "get-pea", arguments: { name: "Snap" },
      status: "completed", result: { content: [{ type: "text", text: '{"name":"Snap"}' }] } } },
    { type: "item.completed", item: { id: "item-2", type: "agent_message", text: "Snap is a pea." } },
    { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } },
  ];
  const parsed = parseCodexEvents(events, [{ name: "get-pea" }], undefined, 0, "gpt-test");
  assert.equal(parsed.threadId, "thread-1");
  assert.deepEqual(parsed.models, ["gpt-test"]);
  assert.equal(parsed.modelEvidence, "configured");
  assert.deepEqual(parsed.calls, [{ name: "get-pea", arguments: { name: "Snap" } }]);
  assert.deepEqual(parsed.toolResults, [{ content: [{ type: "text", text: '{"name":"Snap"}' }], isError: false }]);
  assert.throws(() => parseCodexEvents(events, [{ name: "get-pea" }], "thread-2"), /required session/);
  assert.throws(() => parseCodexEvents(events.slice(0, -1), [{ name: "get-pea" }]), /incomplete turn/);
  assert.throws(() => parseCodexEvents(events.map((event) => event.item?.type === "mcp_tool_call"
    ? { ...event, item: { ...event.item, server: "ambient" } }
    : event), [{ name: "get-pea" }]), /forbidden tool/);
  assert.throws(() => parseCodexEvents(events.map((event) => event.item?.type === "mcp_tool_call"
    ? { ...event, item: { ...event.item, result: { isError: true, content: [] } } }
    : event), [{ name: "get-pea" }]), /failed MCP tool call/);
  assert.throws(() => parseCodexEvents(events.map((event) => event.item?.type === "mcp_tool_call"
    ? { ...event, item: { ...event.item, status: "failed", message: "private failure detail" } }
    : event), [{ name: "get-pea" }], undefined, 1),
  (error) => error.message === "Model command reported a failed MCP tool call"
    && !error.message.includes("private failure detail"));
  assert.throws(() => parseCodexEvents([
    { type: "error", message: "Unauthorized: provider-secret-sentinel" },
  ], [], undefined, 1),
  (error) => error.message === "Model command is not signed in"
    && !error.message.includes("provider-secret-sentinel"));
  assert.throws(() => parseCodexEvents(events, [{ name: "get-pea" }], undefined, 0, "gpt-test", ["Snap"]),
    /configured secret/);
});

test("Codex provider requires an explicit model", () => {
  const previous = process.env.EMSEEPEA_CODEX_MODEL;
  delete process.env.EMSEEPEA_CODEX_MODEL;
  try {
    assert.throws(() => providerModel("codex-local"), /model is not configured/);
    process.env.EMSEEPEA_CODEX_MODEL = "gpt-test";
    assert.equal(providerModel("codex-local"), "gpt-test");
    assert.equal(providerModel("claude-local"), "claude-sonnet-4-6");
  } finally {
    restore("EMSEEPEA_CODEX_MODEL", previous);
  }
});

test("Codex invocation isolates configuration and pre-approves only discovered tools", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "codex-invocation-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const original = {
    key: process.env.OPENAI_API_KEY,
    model: process.env.EMSEEPEA_CODEX_MODEL,
  };
  process.env.OPENAI_API_KEY = "private-openai-key";
  process.env.EMSEEPEA_CODEX_MODEL = "gpt-test";
  t.after(() => {
    restore("OPENAI_API_KEY", original.key);
    restore("EMSEEPEA_CODEX_MODEL", original.model);
  });
  const invocation = conversationInvocation("codex-ci", directory,
    "http://127.0.0.1:4321/mcp", [{ name: "get-pea" }], "private-server-token");
  assert.equal(invocation.command, "codex");
  assert.ok(invocation.args.includes("--ignore-user-config"));
  assert.equal(invocation.args.includes("--ignore-rules"), false);
  assert.ok(invocation.args.includes("--skip-git-repo-check"));
  assert.equal(invocation.args[invocation.args.indexOf("--sandbox") + 1], "read-only");
  assert.ok(invocation.args.includes('shell_environment_policy.inherit="none"'));
  assert.ok(invocation.args.includes("allow_login_shell=false"));
  assert.ok(invocation.args.includes('mcp_servers.emseepea_eval.enabled_tools=["get-pea"]'));
  assert.ok(invocation.args.includes('mcp_servers.emseepea_eval.default_tools_approval_mode="approve"'));
  assert.ok(invocation.args.includes('mcp_servers.emseepea_eval.tools."get-pea".approval_mode="approve"'));
  assert.equal(JSON.stringify(invocation.args).includes("private-server-token"), false);
  assert.equal(JSON.stringify(invocation.args).includes("private-openai-key"), false);
  assert.equal(invocation.env.OPENAI_API_KEY, "private-openai-key");
  assert.equal(invocation.env.EMSEEPEA_SEMANTIC_MCP_TOKEN, "private-server-token");
  assert.equal(invocation.env.CODEX_API_KEY, undefined);
  assert.deepEqual(invocation.providerSecrets, ["private-openai-key"]);
});

function restore(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
