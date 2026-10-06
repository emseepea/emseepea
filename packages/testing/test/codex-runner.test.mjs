import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const cli = fileURLToPath(new URL("../semantic/cli.mjs", import.meta.url));
const helper = new URL("../semantic/test.mjs", import.meta.url).href;
const server = new URL("../../../examples/tool-server/dist/server.js", import.meta.url).href;

test("Codex runner starts, resumes, and refreshes exact native sessions", { timeout: 30_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "codex-runner-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const model = await writeFakeCodex(directory);
  const evalDirectory = join(directory, "eval");
  await mkdir(evalDirectory);
  const file = join(evalDirectory, "conversation.test.mjs");
  const output = join(directory, "evidence.json");
  await writeFile(file, `
import test from "node:test";
import { assertNoToolCalls, assertResponseContains, assertResponseMeaning, assertToolCalls, createConversation } from ${JSON.stringify(helper)};
test("Codex lifecycle", async (t) => {
  const chat = await createConversation(t, { server: new URL(${JSON.stringify(server)}), authToken: "server-secret-sentinel" });
  const first = await chat.send("Remember Highland Snap.");
  assertToolCalls(first, [{ name: "get-pea-variety", arguments: { name: "Highland Snap" } }]);
  assertResponseContains(first, "Highland Snap");
  const followUp = await chat.send("What was its name?");
  assertNoToolCalls(followUp);
  assertResponseContains(followUp, "Highland Snap");
  await chat.fresh();
  const fresh = await chat.send("Retrieve Highland Snap from saved application data.");
  assertToolCalls(fresh, [{ name: "get-pea-variety", arguments: { name: "Highland Snap" } }]);
  await assertResponseMeaning(fresh, { expected: "The saved variety is Highland Snap." });
});
`);
  const key = "provider-secret-sentinel";
  const result = runCli(model, output, file, { OPENAI_API_KEY: key });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const evidenceText = await readFile(output, "utf8");
  assert.equal(evidenceText.includes(key), false);
  assert.equal(evidenceText.includes("server-secret-sentinel"), false);
  const evidence = JSON.parse(evidenceText);
  assert.equal(evidence.provider, "codex-local");
  assert.equal(evidence.configuredModel, "gpt-test");
  assert.equal(evidence.modelEvidence, "configured");
  assert.deepEqual(evidence.settings, {
    approvalPolicy: "never",
    loginShell: false,
    multiAgent: false,
    sandbox: "read-only",
    shell: "forbidden",
    shellEnvironment: "empty",
    userConfig: "ignored",
    webSearch: false,
  });
  const record = Object.values(evidence.cases)[0];
  assert.deepEqual(record.answerTrials[0].turns.map(({ conversation }) => conversation), [1, 1, 2]);

  const log = (await readFile(join(directory, "model-log.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  const answerRuns = log.filter(({ mcpUrl }) => mcpUrl);
  const groups = Map.groupBy(answerRuns, ({ codexHome }) => codexHome);
  assert.equal(groups.size, 3);
  for (const runs of groups.values()) {
    assert.deepEqual(runs.map(({ prompt }) => prompt), [
      "Remember Highland Snap.",
      "What was its name?",
      "Retrieve Highland Snap from saved application data.",
    ]);
    assert.deepEqual(runs.map(({ resumed }) => resumed), [false, true, false]);
    assert.equal(runs[0].threadId, runs[1].threadId);
    assert.notEqual(runs[1].threadId, runs[2].threadId);
    assert.equal(new Set(runs.map(({ mcpUrl }) => mcpUrl)).size, 1);
    assert.ok(runs.every(({ shellEnvironmentEmpty, shellForbidden }) => shellEnvironmentEmpty && shellForbidden));
  }
});

test("Codex runner never retains provider or server credential sentinels", { timeout: 30_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "codex-secret-evidence-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const model = await writeFakeCodex(directory);
  const evalDirectory = join(directory, "eval");
  await mkdir(evalDirectory);
  for (const [kind, sentinel] of [["PROVIDER", "provider-secret-sentinel"], ["SERVER", "server-secret-sentinel"]]) {
    const file = join(evalDirectory, `${kind.toLowerCase()}.test.mjs`);
    const output = join(directory, `${kind.toLowerCase()}-evidence.json`);
    await writeFile(file, `
import test from "node:test";
import { createConversation } from ${JSON.stringify(helper)};
test("secret guard", async (t) => {
  const chat = await createConversation(t, { server: new URL(${JSON.stringify(server)}), authToken: "server-secret-sentinel" });
  await chat.send("LEAK_${kind}");
});
`);
    const result = runCli(model, output, file, { OPENAI_API_KEY: "provider-secret-sentinel" });
    assert.equal(result.status, 1);
    const evidenceText = await readFile(output, "utf8");
    assert.equal(evidenceText.includes(sentinel), false);
    const evidence = JSON.parse(evidenceText);
    const record = Object.values(evidence.cases)[0];
    assert.ok(record.answerTrials.every(({ error }) => error === "model command exposed a configured secret"));
  }
});

async function writeFakeCodex(directory) {
  const path = join(directory, "fake-codex.mjs");
  const log = join(directory, "model-log.jsonl");
  await writeFile(path, `#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2);
const resumed = args[0] === "exec" && args[1] === "resume";
const prompt = args.at(-1);
const codexHome = process.env.CODEX_HOME;
const counter = join(codexHome, "fake-session-count");
let threadId;
if (resumed) threadId = args[2];
else {
  const next = existsSync(counter) ? Number(readFileSync(counter, "utf8")) + 1 : 1;
  writeFileSync(counter, String(next));
  threadId = "thread-" + next;
}
const configs = args.flatMap((value, index) => args[index - 1] === "-c" ? [value] : []);
const urlConfig = configs.find((value) => value.startsWith("mcp_servers.emseepea_eval.url="));
const mcpUrl = urlConfig ? JSON.parse(urlConfig.slice(urlConfig.indexOf("=") + 1)) : undefined;
const rules = readFileSync(join(codexHome, "rules", "default.rules"), "utf8");
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ codexHome, mcpUrl, prompt, resumed, threadId,
  shellEnvironmentEmpty: configs.includes('shell_environment_policy.inherit="none"'),
  shellForbidden: rules.includes('decision = "forbidden"') }) + "\\n");
const event = (value) => process.stdout.write(JSON.stringify(value) + "\\n");
event({ type: "thread.started", thread_id: threadId });
event({ type: "turn.started" });
let answer;
if (prompt === "LEAK_PROVIDER") answer = process.env.OPENAI_API_KEY;
else if (prompt === "LEAK_SERVER") answer = process.env.EMSEEPEA_SEMANTIC_MCP_TOKEN;
else if (!mcpUrl) answer = JSON.stringify({ pass: true, score: 1, reason: "The response has the expected meaning." });
else if (prompt === "What was its name?") answer = "Its name was Highland Snap.";
else {
  event({ type: "item.completed", item: { id: "tool-1", type: "mcp_tool_call", server: "emseepea_eval",
    tool: "get-pea-variety", arguments: { name: "Highland Snap" }, status: "completed",
    result: { content: [{ type: "text", text: '{"name":"Highland Snap"}' }] } } });
  answer = "The saved variety is Highland Snap.";
}
event({ type: "item.completed", item: { id: "answer-1", type: "agent_message", text: answer } });
event({ type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } });
`);
  await chmod(path, 0o755);
  return path;
}

function runCli(model, output, file, extraEnvironment) {
  return spawnSync(process.execPath, [cli, "--smoke", "--provider", "codex-local",
    "--model-command", model, "--output", output, file], {
    encoding: "utf8",
    timeout: 25_000,
    env: { ...process.env, EMSEEPEA_CODEX_MODEL: "gpt-test", ...extraEnvironment },
  });
}
