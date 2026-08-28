import assert from "node:assert/strict";
import test from "node:test";

import {
  claudeInvocation,
  exampleEnvironment,
  parseClaudeEvents,
  parseJudgeVerdict,
} from "./provider.mjs";

test("Claude evidence requires one tool-free turn with the pinned main model", () => {
  const tool = {
    type: "assistant",
    message: { content: [{ type: "tool_use", id: "tool-1", name: "Read" }] },
  };
  const result = {
    type: "result",
    is_error: false,
    num_turns: 1,
    permission_denials: [],
    result: "One matching bean",
    modelUsage: {
      "claude-haiku-4-5-20251001": { canonicalModel: "claude-haiku-4-5", provider: "firstParty" },
      "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" },
    },
  };
  const parsed = parseClaudeEvents(JSON.stringify(result));
  assert.equal(parsed.model, "claude-sonnet-4-6");
  assert.deepEqual(parsed.models, ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"]);
  assert.equal(parsed.toolCallCount, 0);
  assert.throws(() => parseClaudeEvents([tool, result].map(JSON.stringify).join("\n")), /forbidden tool/);
  assert.throws(() => parseClaudeEvents(JSON.stringify({ ...result, num_turns: 2 })), /2 turns/);
  assert.throws(() => parseClaudeEvents(JSON.stringify({ ...result, permission_denials: [{ tool: "Read" }] })), /forbidden action/);
  assert.throws(() => parseClaudeEvents(JSON.stringify({ ...result, modelUsage: {} })), /required model/);
  assert.throws(() => parseClaudeEvents(JSON.stringify({ ...result, modelUsage: {
    "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-5", provider: "firstParty" },
  } })), /required model/);
  assert.throws(() => parseClaudeEvents(JSON.stringify({ ...result, is_error: true })), /Claude failed/);
  assert.throws(() => parseClaudeEvents("", 0), /Claude failed/);
  assert.throws(() => parseClaudeEvents(JSON.stringify(result), 1), /Claude exited 1/);
  assert.throws(
    () => parseClaudeEvents(JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "Not logged in · Please run /login" }] },
    }), 1),
    /not signed in/,
  );
});

test("Claude invocation is isolated and keeps subscription auth away from examples", () => {
  const originalToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  const originalHome = process.env.HOME;
  process.env.CLAUDE_CODE_OAUTH_TOKEN = "sentinel-subscription-token";
  process.env.ANTHROPIC_API_KEY = "sentinel-api-key";
  process.env.HOME = "/tmp/emseepea-signed-in-home";
  try {
    const invocation = claudeInvocation("claude-ci", "question", "/tmp/emseepea-neutral");
    assert.match(invocation.command, /node_modules\/\.bin\/claude$/);
    assert.equal(invocation.env.CLAUDE_CODE_OAUTH_TOKEN, "sentinel-subscription-token");
    assert.equal(invocation.env.ANTHROPIC_API_KEY, undefined);
    assert.equal(invocation.env.HOME, "/tmp/emseepea-neutral");
    for (const pair of [
      ["--model", "claude-sonnet-4-6"],
      ["--tools", ""],
      ["--setting-sources", ""],
      ["--permission-mode", "dontAsk"],
      ["--output-format", "stream-json"],
    ]) {
      const index = invocation.args.indexOf(pair[0]);
      assert.equal(invocation.args[index + 1], pair[1]);
    }
    for (const flag of ["--safe-mode", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence", "--no-chrome"]) {
      assert.ok(invocation.args.includes(flag), `${flag} is required`);
    }
    for (const flag of ["--mcp-config", "--plugin-dir", "--fallback-model", "--max-budget-usd"]) {
      assert.equal(invocation.args.includes(flag), false, `${flag} must be absent`);
    }
    const example = exampleEnvironment({ NODE_ENV: "test", PORT: "0" });
    assert.equal(example.CLAUDE_CODE_OAUTH_TOKEN, undefined);
    assert.equal(example.ANTHROPIC_API_KEY, undefined);
    const local = claudeInvocation("claude-local", "question", "/tmp/emseepea-neutral");
    assert.equal(local.env.HOME, "/tmp/emseepea-signed-in-home");
    assert.equal(local.env.CLAUDE_CONFIG_DIR, undefined);
    assert.equal(local.env.CLAUDE_CODE_OAUTH_TOKEN, undefined);
    assert.equal(local.env.ANTHROPIC_API_KEY, undefined);
    delete process.env.HOME;
    assert.throws(
      () => claudeInvocation("claude-local", "question", "/tmp/emseepea-neutral"),
      /absolute HOME/,
    );
  } finally {
    if (originalToken === undefined) delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    else process.env.CLAUDE_CODE_OAUTH_TOKEN = originalToken;
    if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalApiKey;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
  }
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
