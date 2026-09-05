import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { collectMcpMaterial, startSemanticServer, stopSemanticServer } from "../semantic/material.mjs";

const cli = fileURLToPath(new URL("../semantic/cli.mjs", import.meta.url));
const helper = new URL("../semantic/test.mjs", import.meta.url).href;
const server = new URL("../../../examples/tool-server/dist/server.js", import.meta.url).href;
const protectedServer = new URL("../../../examples/sign-in-tool-server/dist/server.js", import.meta.url).href;

test("cancellation stops MCP collection and the server receives no model token", { timeout: 15_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "semantic-cancel-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const entry = join(directory, "server.mjs");
  await writeFile(entry, `
import assert from "node:assert/strict";
assert.equal(process.env.CLAUDE_CODE_OAUTH_TOKEN, undefined);
await import(${JSON.stringify(server)});
`);
  const previous = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  process.env.CLAUDE_CODE_OAUTH_TOKEN = "test-only-provider-sentinel";
  t.after(() => {
    if (previous === undefined) delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    else process.env.CLAUDE_CODE_OAUTH_TOKEN = previous;
  });
  const controller = new AbortController();
  const running = await startSemanticServer({ server: entry, directory }, controller.signal);
  t.after(() => stopSemanticServer(running.child));
  const material = collectMcpMaterial(running.url, { async exercise(client) {
    await client.callTool({ name: "get-pea-variety", arguments: { name: "Highland Snap" } });
    controller.abort();
    await new Promise(() => {});
  } }, controller.signal);
  await assert.rejects(material, /cancelled/);
});

test("interrupting the runner terminates test descendants and records failure", {
  timeout: 15_000,
  skip: process.platform === "win32",
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "semantic-interrupt-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "hanging.test.mjs");
  const pidFile = join(directory, "child.pid");
  const output = join(directory, "evidence.json");
  await writeFile(file, `
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
console.log("descendant ready");
setInterval(() => {}, 1000);
`);
  const child = spawn(process.execPath, [cli, "--smoke", "--output", output, file], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const closed = once(child, "close");
  t.after(() => child.kill("SIGTERM"));
  let errors = "";
  child.stderr.on("data", (chunk) => { errors += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Runner did not start descendant")), 5_000);
    let text = "";
    child.stdout.on("data", (chunk) => {
      text += chunk;
      if (text.includes("descendant ready")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.once("error", reject);
  });
  const pid = Number(await readFile(pidFile, "utf8"));
  child.kill("SIGTERM");
  const [code] = await closed;
  assert.equal(code, 1);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      assert.equal(error.code, "ESRCH");
      const text = await readFile(output, "utf8").catch(() => assert.fail(`No cancellation evidence: ${errors}`));
      assert.equal(JSON.parse(text).status, "failed");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("Semantic test descendant survived cancellation");
});

test("conversation tests assert exact calls, meaning, and no-call follow-ups", { timeout: 90_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "semantic-conversation-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "eval"));
  const model = join(directory, "model.mjs");
  const modelLog = join(directory, "model-log.jsonl");
  const file = join(directory, "eval", "meaning.test.mjs");
  const output = join(directory, "evidence.json");
  await writeFile(model, `#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
const prompt = process.argv[process.argv.indexOf("--print") + 1];
const selection = process.argv.includes("--json-schema");
const judge = prompt.startsWith("Judge whether");
const followUp = prompt.includes("How many packets were inbound?");
const forceFollowUpTool = prompt.includes("FORCE_TOOL_ON_FOLLOW_UP");
const forceTwoCalls = prompt.includes("TWO_ORDERED_CALLS");
let prior = [];
try { prior = readFileSync(${JSON.stringify(modelLog)}, "utf8").trim().split("\\n").filter(Boolean).map(JSON.parse); } catch {}
const firstAnswerNumber = prior.filter((entry) => !entry.selection && !entry.judge && !entry.followUp).length + 1;
const historyMarker = prompt.match(/TRIAL_MARKER_[123]/)?.[0];
appendFileSync(${JSON.stringify(modelLog)}, JSON.stringify({
  selection,
  judge,
  followUp,
  hasHistory: prompt.includes("Conversation so far:"),
  hasApplicationContext: prompt.includes("Application context:"),
  historyMarker,
  judgeGrounded: !judge || (prompt.includes("How many packets can we promise now?")
    && prompt.includes("The response says 85 packets are available to promise.")),
  hasServerToken: Object.values(process.env).includes("example-access-token"),
  cwd: process.cwd(),
}) + "\\n");
let answer;
if (selection) {
  answer = forceTwoCalls && !followUp
    ? { calls: [
      { name: "get-pea-variety", arguments: { name: "Highland Snap" } },
      { name: "get-pea-variety", arguments: { name: "Harbour Gem" } },
    ] }
    : followUp
    ? { calls: forceFollowUpTool ? [{ name: "get-private-inventory-report", arguments: {} }] : [] }
    : { calls: [{ name: "get-private-inventory-report", arguments: {} }] };
} else if (judge) {
  const pass = !prompt.includes("REJECT_THIS_RESPONSE");
  answer = JSON.stringify({ pass, score: pass ? 1 : 0, reason: "PRIVATE_JUDGE_DETAIL" });
} else {
  answer = followUp
    ? "There were 40 inbound packets, and they were not yet available to promise. " + (historyMarker ?? "NO_HISTORY_MARKER")
    : "There are 85 packets available to promise from 120 on hand minus 35 reserved. TRIAL_MARKER_" + (((firstAnswerNumber - 1) % 3) + 1);
}
const result = { type: "result", is_error: false, num_turns: 1,
  permission_denials: [], modelUsage: {
    "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" }
  } };
if (selection) result.structured_output = answer;
else result.result = answer;
process.stdout.write(JSON.stringify(result) + "\\n");
`, { mode: 0o700 });
  const source = ({
    meaning = "The response says 85 packets are available to promise.",
    context,
    expectedArguments = {},
    literal = "85 packets available to promise",
    serverUrl = protectedServer,
    expectedCalls,
  } = {}) => `
import test from "node:test";
import {
  assertNoToolCalls,
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from ${JSON.stringify(helper)};

test("inventory conversation", async (t) => {
  const chat = await createConversation(t, {
    server: new URL(${JSON.stringify(serverUrl)}),
    ${serverUrl === protectedServer ? 'authToken: "example-access-token",' : ""}
    ${context === undefined ? "" : `context: ${JSON.stringify(context)},`}
  });
  const inventory = await chat.send("How many packets can we promise now?");
  assertToolCalls(inventory, ${JSON.stringify(expectedCalls ?? [{
    name: "get-private-inventory-report",
    arguments: expectedArguments,
  }])});
  assertResponseContains(inventory, ${JSON.stringify(literal)});
  await assertResponseMeaning(inventory, { expected: ${JSON.stringify(meaning)} });

  const followUp = await chat.send("How many packets were inbound?");
  assertNoToolCalls(followUp);
  assertResponseContains(followUp, "40 inbound packets");
});
`;
  const run = () => spawnSync(process.execPath, [
    cli,
    "--smoke",
    "--model-command",
    model,
    "--output",
    output,
  ], { cwd: directory, encoding: "utf8", timeout: 30_000 });

  await writeFile(file, source());
  const passed = run();
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
  const evidenceText = await readFile(output, "utf8");
  const evidence = JSON.parse(evidenceText);
  assert.equal(evidence.status, "passed");
  assert.doesNotMatch(evidenceText, /PRIVATE_JUDGE_DETAIL|example-access-token/);
  const record = Object.values(evidence.cases)[0];
  assert.equal(record.mode, "conversation");
  assert.equal(record.answerTrials.length, 3);
  assert.equal(record.judgeVerdicts.length, 9);
  assert.ok(record.answerTrials.every(({ turns }) => turns.length === 2));
  assert.ok(record.answerTrials.every(({ turns }) => turns[0].toolCallCount === 1));
  assert.ok(record.answerTrials.every(({ turns }) => turns[1].toolCallCount === 0));
  const isHash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  assert.ok(record.answerTrials.every(({ turns }) => turns.every(({ promptSha256, answerSha256 }) =>
    isHash(promptSha256) && isHash(answerSha256))));
  assert.ok(record.judgeVerdicts.every(({ expectationSha256, requestSha256, responseSha256 }) =>
    isHash(expectationSha256) && isHash(requestSha256) && isHash(responseSha256)));
  assert.ok(record.answerTrials.every(({ turns }) => turns[0].pathEvidence[0].target
    === "get-private-inventory-report"));
  const invocations = (await readFile(modelLog, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(invocations.filter(({ selection }) => selection).length, 6);
  assert.equal(invocations.filter(({ judge }) => judge).length, 9);
  assert.ok(invocations.filter(({ followUp }) => followUp).every(({ hasHistory }) => hasHistory));
  assert.deepEqual(invocations.filter(({ followUp, selection }) => followUp && selection)
    .map(({ historyMarker }) => historyMarker), ["TRIAL_MARKER_1", "TRIAL_MARKER_2", "TRIAL_MARKER_3"]);
  assert.ok(invocations.every(({ hasApplicationContext }) => hasApplicationContext === false));
  assert.ok(invocations.filter(({ judge }) => judge).every(({ judgeGrounded }) => judgeGrounded));
  assert.ok(invocations.every(({ hasServerToken }) => hasServerToken === false));
  assert.equal(new Set(invocations.map(({ cwd }) => cwd)).size, 21);

  const contextStart = invocations.length;
  await writeFile(file, source({ context: "CONTEXT_MARKER" }));
  const contextual = run();
  assert.equal(contextual.status, 0, contextual.stdout + contextual.stderr);
  const contextInvocations = (await readFile(modelLog, "utf8")).trim().split("\n").map(JSON.parse)
    .slice(contextStart);
  assert.ok(contextInvocations.filter(({ judge }) => !judge)
    .every(({ hasApplicationContext }) => hasApplicationContext));

  for (const [options, phase] of [
    [{ expectedArguments: { PRIVATE_ARGUMENT_SENTINEL: true } }, "tool-call assertion"],
    [{ literal: "absent response text" }, "literal response assertion"],
    [{ context: "FORCE_TOOL_ON_FOLLOW_UP" }, "tool-call assertion"],
  ]) {
    await writeFile(file, source(options));
    const failed = run();
    assert.equal(failed.status, 1, `Expected ${phase} failure`);
    assert.doesNotMatch(failed.stdout + failed.stderr, /PRIVATE_ARGUMENT_SENTINEL/);
    const record = Object.values(JSON.parse(await readFile(output, "utf8")).cases)[0];
    assert.equal(record.failedPhase, phase);
  }

  const orderedCalls = [
    { name: "get-pea-variety", arguments: { name: "Highland Snap" } },
    { name: "get-pea-variety", arguments: { name: "Harbour Gem" } },
  ];
  await writeFile(file, source({
    context: "TWO_ORDERED_CALLS",
    serverUrl: server,
    expectedCalls: orderedCalls,
  }));
  const ordered = run();
  assert.equal(ordered.status, 0, ordered.stdout + ordered.stderr);
  await writeFile(file, source({
    context: "TWO_ORDERED_CALLS",
    serverUrl: server,
    expectedCalls: [...orderedCalls].reverse(),
  }));
  const reversed = run();
  assert.equal(reversed.status, 1, "Reversed tool-call order must fail");

  await writeFile(file, source({ meaning: "REJECT_THIS_RESPONSE" }));
  const rejected = run();
  assert.equal(rejected.status, 1, "A rejected meaning must fail");
  const failure = Object.values(JSON.parse(await readFile(output, "utf8")).cases)[0];
  assert.equal(failure.failedPhase, "model judgment");
});

test("literal response assertions reject numerical expectations", { timeout: 90_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "semantic-literal-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "eval"));
  const model = join(directory, "model.mjs");
  const file = join(directory, "eval", "meaning.test.mjs");
  const output = join(directory, "evidence.json");
  await writeFile(model, `#!/usr/bin/env node
const selection = process.argv.includes("--json-schema");
const result = { type: "result", is_error: false, num_turns: 1, permission_denials: [], modelUsage: {
  "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" }
} };
if (selection) result.structured_output = { calls: [{ name: "get-pea-variety", arguments: { name: "Highland Snap" } }] };
else result.result = "Highland Snap matures in 70 days.";
process.stdout.write(JSON.stringify(result) + "\\n");
`, { mode: 0o700 });
  await writeFile(file, `
import test from "node:test";
import { assertResponseContains, assertToolCalls, createConversation } from ${JSON.stringify(helper)};
test("numeric expectation", async (t) => {
  const chat = await createConversation(t, { server: new URL(${JSON.stringify(server)}) });
  const turn = await chat.send("How long does Highland Snap take to mature?");
  assertToolCalls(turn, [{ name: "get-pea-variety", arguments: { name: "Highland Snap" } }]);
  assertResponseContains(turn, 70);
});
`);
  const result = spawnSync(process.execPath, [
    cli,
    "--smoke",
    "--model-command",
    model,
    "--output",
    output,
  ], { cwd: directory, encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /Expected response content must be/);
});
