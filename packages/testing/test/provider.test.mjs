import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  conversationInvocation,
  modelVersion,
  mcpClientVersion,
  modelInvocation,
  parseClaudeEvents,
  parseCodexEvents,
  parseJudgeVerdict,
  parseNativeClaudeEvents,
  providerModel,
  runModel,
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

test("model transport preserves proxy and certificate settings without inheriting unrelated credentials", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "model-transport-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const names = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
    "http_proxy", "https_proxy", "all_proxy", "no_proxy",
    "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS"];
  const original = new Map([...names, "UNRELATED_SERVICE_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN",
    "OPENAI_API_KEY", "EMSEEPEA_CODEX_MODEL"]
    .map((name) => [name, process.env[name]]));
  try {
    for (const name of names) process.env[name] = `transport-${name}`;
    process.env.UNRELATED_SERVICE_TOKEN = "must-not-pass";
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "test-provider-token";
    process.env.OPENAI_API_KEY = "test-codex-key";
    process.env.EMSEEPEA_CODEX_MODEL = "gpt-test";
    for (const provider of ["claude-ci", "codex-ci"]) {
      const invocation = modelInvocation(provider, "question", directory);
      for (const name of names) assert.equal(invocation.env[name], `transport-${name}`);
      assert.equal(invocation.env.UNRELATED_SERVICE_TOKEN, undefined);
      if (provider === "codex-ci") {
        assert.equal(invocation.env.CLAUDE_CODE_OAUTH_TOKEN, undefined);
        assert.ok(invocation.args.includes('shell_environment_policy.inherit="none"'));
      } else {
        assert.equal(invocation.env.OPENAI_API_KEY, undefined);
      }
    }
  } finally {
    for (const [name, value] of original) restore(name, value);
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
  assert.equal(invocation.args.includes("--max-turns"), false);
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

});

test("native Claude accepts tool batches and longer provider journeys but retains evidence and tool checks", () => {
  const uses = Array.from({ length: 40 }, (_, index) => ({
    type: "tool_use", id: `call-${index}`, name: "mcp__emseepea_eval__get-pea",
    input: { name: `Pea ${index}` },
  }));
  const events = [
    { type: "assistant", message: { content: uses } },
    { type: "user", message: { role: "user", content: uses.map(({ id, input }) => ({
      type: "tool_result", tool_use_id: id, content: JSON.stringify(input),
    })) } },
    { ...result, num_turns: 2, result: "All forty peas are present." },
  ];
  const parsed = parseNativeClaudeEvents(events, [{ name: "get-pea" }]);
  assert.equal(parsed.calls.length, 40);
  assert.equal(parsed.toolResults.length, 40);
  assert.equal(parsed.pathEvidence.length, 40);
  assert.equal(parsed.providerTurnCount, 2);
  assert.equal(parsed.providerToolCount, 40);
  assert.deepEqual(parsed.calls.at(-1), { name: "get-pea", arguments: { name: "Pea 39" } });
  assert.equal(parseNativeClaudeEvents([...events.slice(0, -1), { ...result, num_turns: 41 }],
    [{ name: "get-pea" }]).providerTurnCount, 41);
  for (const num_turns of [-1, 0, 1.5, "5", Infinity]) {
    assert.throws(() => parseNativeClaudeEvents([...events.slice(0, -1), { ...result, num_turns }],
      [{ name: "get-pea" }]), /invalid turn count/);
  }
  assert.throws(() => parseNativeClaudeEvents(events, []), /forbidden tool/);
  assert.throws(() => parseNativeClaudeEvents([events[0], events[2]], [{ name: "get-pea" }]),
    /omitted an MCP tool result/);
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
  const emptyDiscovery = [
    { type: "item.completed", item: { type: "mcp_tool_call", server: "codex",
      tool: "list_mcp_resources", arguments: {}, status: "completed",
      result: { content: [{ type: "text", text: '{"resources":[]}' }], structured_content: null } } },
    { type: "item.completed", item: { type: "mcp_tool_call", server: "codex",
      tool: "list_mcp_resource_templates", arguments: {}, status: "completed",
      result: { content: [{ type: "text", text: '{"resourceTemplates":[]}' }], structured_content: null } } },
  ];
  const withEmptyDiscovery = parseCodexEvents([
    ...events.slice(0, 2), ...emptyDiscovery, ...events.slice(2),
  ], [{ name: "get-pea" }], undefined, 0, "gpt-test");
  assert.deepEqual(withEmptyDiscovery.calls, parsed.calls);
  assert.deepEqual(withEmptyDiscovery.toolResults, parsed.toolResults);
  const discoveryNearMisses = [
    { ...emptyDiscovery[0].item, arguments: { server: "private" } },
    { ...emptyDiscovery[0].item, status: "running" },
    { ...emptyDiscovery[0].item, result: { ...emptyDiscovery[0].item.result, structured_content: {} } },
    { ...emptyDiscovery[0].item, result: { ...emptyDiscovery[0].item.result, extra: true } },
    { ...emptyDiscovery[0].item, result: { ...emptyDiscovery[0].item.result,
      content: [{ type: "text", text: '{"resources":[]}', extra: true }] } },
    { ...emptyDiscovery[0].item, result: { ...emptyDiscovery[0].item.result,
      content: [{ type: "text", text: '{"resources":[{"name":"private"}]}' }] } },
  ];
  for (const item of discoveryNearMisses) {
    assert.throws(() => parseCodexEvents([
      ...events.slice(0, 2), { type: "item.completed", item }, ...events.slice(2),
    ], [{ name: "get-pea" }]), (error) => error.message === "Model command used a forbidden tool"
      && !JSON.stringify(error).includes("private"));
  }
  const batch = Array.from({ length: 40 }, (_, index) => ({
    ...events[2], item: { ...events[2].item, id: `call-${index}`, arguments: { name: `Pea ${index}` } },
  }));
  const batchEvents = [...events.slice(0, 2), ...batch, ...events.slice(3)];
  const batchResult = parseCodexEvents(batchEvents, [{ name: "get-pea" }]);
  assert.equal(batchResult.calls.length, 40);
  assert.equal(batchResult.toolResults.length, 40);
  assert.equal(batchResult.pathEvidence.length, 40);
  assert.deepEqual(batchResult.calls.at(-1), { name: "get-pea", arguments: { name: "Pea 39" } });
  assert.throws(() => parseCodexEvents(batchEvents, []), /forbidden tool/);
  assert.throws(() => parseCodexEvents(events, [{ name: "get-pea" }], "thread-2"), /required session/);
  assert.throws(() => parseCodexEvents(events.slice(0, -1), [{ name: "get-pea" }]), /incomplete turn/);
  assert.throws(() => parseCodexEvents(events.map((event) => event.item?.type === "mcp_tool_call"
    ? { ...event, item: { ...event.item, server: "ambient" } }
    : event), [{ name: "get-pea" }]), /forbidden tool/);
  assert.throws(() => parseCodexEvents([
    ...events.slice(0, 2),
    { ...emptyDiscovery[0], item: { ...emptyDiscovery[0].item, tool: "unknown_catalogue" } },
    ...events.slice(2),
  ], [{ name: "get-pea" }]), /forbidden tool/);
  const foreignResource = "private-account-resource-sentinel";
  assert.throws(() => parseCodexEvents([
    ...events.slice(0, 2),
    { ...emptyDiscovery[0], item: { ...emptyDiscovery[0].item, result: {
      content: [{ type: "text", text: JSON.stringify({ resources: [{ name: foreignResource }] }) }],
      structured_content: null,
    } } },
    ...events.slice(2),
  ], [{ name: "get-pea" }]), (error) => error.message === "Model command used a forbidden tool"
    && !JSON.stringify(error).includes(foreignResource));
  assert.throws(() => parseCodexEvents([
    ...events.slice(0, 2),
    { type: "item.completed", item: { type: "command_execution", command: "private command" } },
    ...events.slice(3),
  ], [{ name: "get-pea" }]), (error) => {
    assert.equal(error.message, "Model command used a forbidden tool");
    assert.deepEqual(error.forbiddenItemEvidence, {
      counts: {
        commandExecution: 1,
        computerUse: 0,
        fileChange: 0,
        mcpToolCall: 0,
        other: 0,
        webSearch: 0,
      },
      inspectedCount: 1,
      truncated: false,
    });
    assert.equal(JSON.stringify(error).includes("private command"), false);
    return true;
  });
  const unknownItems = Array.from({ length: 70 }, (_, index) => ({
    type: "item.completed", item: { type: `private-${index}`, payload: "private payload" },
  }));
  assert.throws(() => parseCodexEvents([
    ...events.slice(0, 2), ...unknownItems, ...events.slice(3),
  ], [{ name: "get-pea" }]), (error) => {
    assert.equal(error.forbiddenItemEvidence.counts.other, 64);
    assert.equal(error.forbiddenItemEvidence.inspectedCount, 64);
    assert.equal(error.forbiddenItemEvidence.truncated, true);
    assert.equal(JSON.stringify(error).includes("private-"), false);
    return true;
  });
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

test("Codex one-shot failures retain a bounded category without stderr", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "codex-failure-category-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const command = join(directory, "fake-codex.mjs");
  await writeFile(command, `#!/usr/bin/env node
const scenario = process.argv.at(-1);
const messages = {
  AUTHENTICATION: "Failed to authenticate private-token-sentinel",
  CONFIGURATION: "unknown feature key private-token-sentinel",
  HOST_STORAGE: "No space left on device private-path-/Users/example private-token-sentinel",
  PERMISSION: "sandbox permission denied private-token-sentinel",
  PROVIDER: "provider unavailable private-token-sentinel",
  TRANSPORT: "connection refused private-endpoint-https://private.example",
  UNKNOWN: "private opaque failure private-token-sentinel",
};
process.stderr.write(scenario === "BEYOND_LIMIT"
  ? "x".repeat(32 * 1024) + "No space left on device"
  : messages[scenario]);
process.exit(2);
`);
  await chmod(command, 0o755);
  const original = {
    command: process.env.EMSEEPEA_CODEX_COMMAND,
    key: process.env.OPENAI_API_KEY,
    model: process.env.EMSEEPEA_CODEX_MODEL,
  };
  process.env.EMSEEPEA_CODEX_COMMAND = command;
  process.env.OPENAI_API_KEY = "private-token-sentinel";
  process.env.EMSEEPEA_CODEX_MODEL = "gpt-test";
  t.after(() => {
    restore("EMSEEPEA_CODEX_COMMAND", original.command);
    restore("OPENAI_API_KEY", original.key);
    restore("EMSEEPEA_CODEX_MODEL", original.model);
  });
  for (const [scenario, category] of Object.entries({
    AUTHENTICATION: "authentication",
    CONFIGURATION: "configuration",
    HOST_STORAGE: "host-storage",
    PERMISSION: "permission-or-sandbox",
    PROVIDER: "provider",
    TRANSPORT: "transport",
    UNKNOWN: "unknown",
    BEYOND_LIMIT: "unknown",
  })) {
    await assert.rejects(runModel("codex-local", scenario, directory), (error) => {
      assert.equal(error.message, "Model command exited 2");
      assert.equal(error.providerFailureCategory, category);
      assert.equal(JSON.stringify(error).includes("private-path"), false);
      assert.equal(JSON.stringify(error).includes("private-token-sentinel"), false);
      assert.equal(JSON.stringify(error).includes("private.example"), false);
      return true;
    });
  }
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

test("Codex provider records CLI provenance without a version eligibility gate", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "codex-version-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const oldCommand = join(directory, "fake-old-codex.mjs");
  const newCommand = join(directory, "fake-new-codex.mjs");
  const invalidCommand = join(directory, "fake-invalid-codex.mjs");
  await writeFile(oldCommand, `#!/usr/bin/env node
process.stdout.write("codex-cli 0.161.9\\n");
`);
  await writeFile(newCommand, `#!/usr/bin/env node
process.stdout.write("codex-cli 0.162.0\\n");
`);
  await writeFile(invalidCommand, `#!/usr/bin/env node
process.stdout.write("unavailable\\n");
`);
  await chmod(oldCommand, 0o755);
  await chmod(newCommand, 0o755);
  await chmod(invalidCommand, 0o755);
  const originalCommand = process.env.EMSEEPEA_CODEX_COMMAND;
  process.env.EMSEEPEA_CODEX_COMMAND = oldCommand;
  t.after(() => restore("EMSEEPEA_CODEX_COMMAND", originalCommand));
  assert.equal(await modelVersion("codex-local"), "0.161.9");
  process.env.EMSEEPEA_CODEX_COMMAND = newCommand;
  assert.equal(await modelVersion("codex-local"), "0.162.0");
  process.env.EMSEEPEA_CODEX_COMMAND = invalidCommand;
  await assert.rejects(modelVersion("codex-local"), /Could not verify Codex CLI version/);
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
  assert.equal(invocation.args.filter((value) => value === "apps._default.enabled=false").length, 1);
  assert.equal(invocation.args.filter((value) => value === "include_apps_instructions=false").length, 1);
  assert.equal(invocation.args.filter((value) => value === "features.apps=false").length, 1);
  assert.equal(invocation.args.filter((value) => value === "features.multi_agent=false").length, 1);
  assert.equal(invocation.args.filter((value) => value === "features.plugins=false").length, 1);
  assert.equal(invocation.args.filter((value) => value === "features.remote_plugin=false").length, 1);
  assert.equal(invocation.args.filter((value) => value === "features.shell_tool=false").length, 1);
  assert.equal(invocation.args.filter((value) => value === "features.tool_suggest=false").length, 1);
  assert.equal(invocation.args.filter((value) => value === "features.unified_exec=false").length, 1);
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

test("MCP client versions are provenance rather than eligibility cutoffs", () => {
  for (const version of ["1.0.0", "2.2.0", "99.0.0-next.1"]) {
    assert.equal(mcpClientVersion({ name: "@modelcontextprotocol/client", version }), version);
  }
  for (const metadata of [undefined, {}, { name: "foreign", version: "2.2.0" },
    { name: "@modelcontextprotocol/client", version: "" },
    { name: "@modelcontextprotocol/client", version: "  " },
    { name: "@modelcontextprotocol/client", version: 2 }]) {
    assert.throws(() => mcpClientVersion(metadata), /Invalid MCP client provenance/);
  }
});

test("Claude CLI versions remain provenance without an exact eligibility guard", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "claude-version-provenance-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const original = process.env.EMSEEPEA_MODEL_COMMAND;
  t.after(() => restore("EMSEEPEA_MODEL_COMMAND", original));
  for (const version of ["2.0.0", "2.1.248", "3.0.0"]) {
    const command = join(directory, `claude-${version}.mjs`);
    await writeFile(command, `#!/usr/bin/env node\nconsole.log(${JSON.stringify(version + " (Claude Code)")});\n`);
    await chmod(command, 0o755);
    process.env.EMSEEPEA_MODEL_COMMAND = command;
    assert.equal(await modelVersion("claude-ci"), version);
  }
});
