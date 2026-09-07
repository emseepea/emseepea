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

test("conversation tests assert exact calls, meaning, and no-call follow-ups", { timeout: 180_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "semantic-conversation-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "eval"));
  const model = join(directory, "model.mjs");
  const modelLog = join(directory, "model-log.jsonl");
  const file = join(directory, "eval", "meaning.test.mjs");
  const output = join(directory, "evidence.json");
  const directoryPattern = new RegExp(directory.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  await writeFile(model, `#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
const log = (value) => appendFileSync(${JSON.stringify(modelLog)}, JSON.stringify(value) + "\\n");
process.stderr.write("MODEL_STDERR_SENTINEL\\n");
const result = (answer, calls = 0) => ({
  type: "result", is_error: false, num_turns: calls + 1, result: answer,
  raw_provider_event_sentinel: "RAW_PROVIDER_EVENT_SENTINEL",
  permission_denials: [], modelUsage: {
    "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" },
  },
});
if (!process.argv.includes("--input-format")) {
  const prompt = process.argv[process.argv.indexOf("--print") + 1];
  if (prompt.includes("JUDGE_EXIT_23")) process.exit(23);
  if (prompt.includes("JUDGE_PROVIDER_SECRET")) {
    process.stdout.write(JSON.stringify({ ...result("PRIVATE_PROVIDER_MESSAGE"), is_error: true,
      subtype: "sk-ant-private-secret" }) + "\\n");
    process.exit(0);
  }
  const pass = !prompt.includes("REJECT_THIS_RESPONSE");
  log({ judge: true, prompt });
  const answer = prompt.includes("MALFORMED_JUDGE") ? "not-json" : JSON.stringify({
    pass, score: pass ? 1 : 0,
    reason: pass ? "The response communicates the expected quantity." : "The response omits the expected meaning.",
  });
  process.stdout.write(JSON.stringify(result(answer)) + "\\n");
} else {
  const tools = (process.argv[process.argv.indexOf("--tools") + 1] ?? "").split(",").filter(Boolean);
  const config = JSON.parse(process.argv[process.argv.indexOf("--mcp-config") + 1]);
  const context = process.argv.includes("--append-system-prompt")
    ? process.argv[process.argv.indexOf("--append-system-prompt") + 1]
    : undefined;
  log({ native: true, tools, config, context,
    hasServerToken: process.env.EMSEEPEA_SEMANTIC_MCP_TOKEN !== undefined,
    hasJsonSchema: process.argv.includes("--json-schema") });
  const answerTrial = readFileSync(${JSON.stringify(modelLog)}, "utf8").trim().split("\\n")
    .map(JSON.parse).filter((entry) => entry.native && entry.context === "ANSWER_FAIL_THIRD").length;
  process.stdout.write(JSON.stringify({ type: "system", subtype: "init", tools,
    mcp_servers: [{ name: "emseepea_eval", status: "connected" }] }) + "\\n");
  let turn = 0;
  createInterface({ input: process.stdin }).on("line", (line) => {
    turn += 1;
    const input = JSON.parse(line);
    const prompt = input.message.content[0].text;
    if (context === "ANSWER_FAIL_THIRD" && answerTrial === 3) {
      process.stderr.write("PRIVATE_ANSWER_PROVIDER_SECRET\\n");
      process.exit(23);
    }
    const followUp = prompt === "How many packets were inbound?";
    const forceTwoCalls = context === "TWO_ORDERED_CALLS";
    const forceFollowUpTool = context === "FORCE_TOOL_ON_FOLLOW_UP";
    const calls = forceTwoCalls && !followUp
      ? [
        { name: "get-pea-variety", arguments: { name: "Highland Snap" } },
        { name: "get-pea-variety", arguments: { name: "Harbour Gem" } },
      ]
      : followUp
        ? (forceFollowUpTool ? [{ name: "get-private-inventory-report", arguments: {} }] : [])
        : [{ name: "get-private-inventory-report", arguments: {} }];
    log({ nativeTurn: true, prompt, turn });
    calls.forEach((call, index) => {
      const id = \`call-\${turn}-\${index}\`;
      process.stdout.write(JSON.stringify({ type: "assistant", message: { content: [{
        type: "tool_use", id, name: \`mcp__emseepea_eval__\${call.name}\`, input: call.arguments,
      }] } }) + "\\n");
      process.stdout.write(JSON.stringify({ type: "user", message: { role: "user", content: [{
        type: "tool_result", tool_use_id: id,
        content: "{\\"onHand\\":120,\\"reserved\\":35,\\"inbound\\":40}",
      }] } }) + "\\n");
    });
    const answer = followUp
      ? "40 inbound packets"
      : "There are 85 packets available to promise from 120 on hand minus 35 reserved; 40 inbound packets do not count.";
    process.stdout.write(JSON.stringify(result(answer, calls.length)) + "\\n");
  });
}
`, { mode: 0o700 });
  const source = ({
    meaning = "The response says 85 packets are available to promise.",
    context,
    expectedArguments = {},
    firstResponseAssertions = true,
    followUpMeaning,
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
  ${firstResponseAssertions ? `assertResponseContains(inventory, ${JSON.stringify(literal)});` : ""}

  const followUp = await chat.send("How many packets were inbound?");
  assertNoToolCalls(followUp);
  assertResponseContains(followUp, "40 inbound packets");
  ${followUpMeaning ? `await assertResponseMeaning(followUp, { expected: ${JSON.stringify(followUpMeaning)} });` : ""}
  ${firstResponseAssertions ? `await assertResponseMeaning(inventory, { expected: ${JSON.stringify(meaning)} });` : ""}
});
`;
  const run = () => spawnSync(process.execPath, [
    cli,
    "--smoke",
    "--model-command",
    model,
    "--output",
    output,
  ], {
    cwd: directory,
    encoding: "utf8",
    timeout: 60_000,
    env: {
      ...process.env,
      CLAUDE_CODE_OAUTH_TOKEN: "PROVIDER_SECRET_SENTINEL",
      UNRELATED_ENV_SENTINEL_KEY: "UNRELATED_ENV_SENTINEL_VALUE",
    },
  });

  await writeFile(file, source());
  const passed = run();
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
  const evidenceText = await readFile(output, "utf8");
  const evidence = JSON.parse(evidenceText);
  assert.equal(evidence.status, "passed");
  assert.doesNotMatch(evidenceText,
    /PROVIDER_SECRET_SENTINEL|example-access-token|RAW_PROVIDER_EVENT_SENTINEL|MODEL_STDERR_SENTINEL|UNRELATED_ENV_SENTINEL/);
  assert.doesNotMatch(evidenceText, /mcpServers|Authorization|EMSEEPEA_SEMANTIC_MCP_TOKEN|127\.0\.0\.1:\d+\/mcp/);
  assert.doesNotMatch(evidenceText, directoryPattern);
  const record = Object.values(evidence.cases)[0];
  assert.equal(record.mode, "conversation");
  assert.equal(record.answerTrials.length, 3);
  assert.equal(record.judgeVerdicts.length, 9);
  assert.ok(record.answerTrials.every(({ turns }) => turns.length === 2));
  assert.ok(record.answerTrials.every(({ turns }) => turns[0].interactionMode === "native-mcp"));
  assert.ok(record.answerTrials.every(({ turns }) => turns[0].toolCallCount === 1));
  assert.ok(record.answerTrials.every(({ turns }) => turns[1].toolCallCount === 0));
  assert.ok(record.answerTrials.every(({ turns }) =>
    turns[0].prompt === "How many packets can we promise now?"
      && turns[0].response.includes("85 packets available to promise")
      && turns[0].toolCalls[0].name === "get-private-inventory-report"
      && turns[0].toolCalls[0].result.includes('"onHand":120')
      && turns[0].expectedCalls[0].name === "get-private-inventory-report"
      && turns[0].expectedResponseContent.includes("85 packets available to promise")
      && turns[0].expectedMeaning === "The response says 85 packets are available to promise."));
  assert.ok(record.judgeVerdicts.every(({ expectedMeaning, verdict }) =>
    expectedMeaning === "The response says 85 packets are available to promise."
      && verdict.reason === "The response communicates the expected quantity."));
  const isHash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  assert.ok(record.answerTrials.every(({ turns }) => turns.every(({ promptSha256, answerSha256 }) =>
    isHash(promptSha256) && isHash(answerSha256))));
  assert.ok(record.judgeVerdicts.every(({ expectationSha256, requestSha256, responseSha256 }) =>
    isHash(expectationSha256) && isHash(requestSha256) && isHash(responseSha256)));
  assert.ok(record.answerTrials.every(({ turns }) => turns[0].pathEvidence[0].target
    === "get-private-inventory-report"));
  const invocations = (await readFile(modelLog, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(invocations.filter(({ native }) => native).length, 3);
  assert.equal(invocations.filter(({ judge }) => judge).length, 9);
  assert.ok(invocations.filter(({ judge }) => judge).every(({ prompt }) =>
    prompt.includes("How many packets can we promise now?")
      && !prompt.includes("How many packets were inbound?")));
  assert.deepEqual(invocations.filter(({ nativeTurn }) => nativeTurn).map(({ prompt }) => prompt), [
    "How many packets can we promise now?",
    "How many packets can we promise now?",
    "How many packets can we promise now?",
    "How many packets were inbound?",
    "How many packets were inbound?",
    "How many packets were inbound?",
  ]);
  assert.ok(invocations.filter(({ native }) => native).every(({ tools, config, hasJsonSchema, hasServerToken }) =>
    tools.length === 1 && Object.keys(config.mcpServers).join() === "emseepea_eval"
      && hasJsonSchema === false && hasServerToken === true));

  const contextStart = invocations.length;
  await writeFile(file, source({ context: "CONTEXT_MARKER" }));
  const contextual = run();
  assert.equal(contextual.status, 0, contextual.stdout + contextual.stderr);
  const contextInvocations = (await readFile(modelLog, "utf8")).trim().split("\n").map(JSON.parse)
    .slice(contextStart);
  assert.ok(contextInvocations.filter(({ native }) => native).every(({ context }) => context === "CONTEXT_MARKER"));

  await writeFile(file, source({
    firstResponseAssertions: false,
    followUpMeaning: "The response says 40 packets were inbound.",
  }));
  const focusedStart = (await readFile(modelLog, "utf8")).trim().split("\n").length;
  const focusedFollowUp = run();
  assert.equal(focusedFollowUp.status, 0, focusedFollowUp.stdout + focusedFollowUp.stderr);
  const focusedInvocations = (await readFile(modelLog, "utf8")).trim().split("\n").map(JSON.parse)
    .slice(focusedStart);
  assert.ok(focusedInvocations.filter(({ judge }) => judge).every(({ prompt }) =>
    prompt.includes("How many packets can we promise now?")
      && prompt.includes("85 packets available to promise")
      && prompt.includes("How many packets were inbound?")
      && prompt.includes("40 inbound packets")));

  for (const [options, phase] of [
    [{ expectedArguments: { PRIVATE_ARGUMENT_SENTINEL: true } }, "tool-call assertion"],
    [{ literal: "absent response text" }, "literal response assertion"],
    [{ context: "FORCE_TOOL_ON_FOLLOW_UP" }, "tool-call assertion"],
  ]) {
    await writeFile(file, source(options));
    const failed = run();
    assert.equal(failed.status, 1, `Expected ${phase} failure`);
    assert.doesNotMatch(failed.stdout + failed.stderr, /PRIVATE_ARGUMENT_SENTINEL/);
    const failedEvidence = await readFile(output, "utf8");
    assert.doesNotMatch(failedEvidence, directoryPattern);
    const record = Object.values(JSON.parse(failedEvidence).cases)[0];
    assert.equal(record.failedPhase, phase);
    const failedTurn = record.answerTrials[0].turns[0];
    if (options.expectedArguments) {
      assert.deepEqual(failedTurn.expectedCalls[0].arguments, options.expectedArguments);
      assert.deepEqual(failedTurn.toolCalls[0].arguments, {});
    }
    if (options.literal) assert.deepEqual(failedTurn.expectedResponseContent, [options.literal]);
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
  assert.equal(failure.judgeVerdicts.length, 9);
  assert.ok(failure.judgeVerdicts.every(({ verdict }) => verdict.reason
    === "The response omits the expected meaning."));

  await writeFile(file, source({ meaning: "MALFORMED_JUDGE" }));
  const malformed = run();
  assert.equal(malformed.status, 1, "A malformed judgment must fail");
  const malformedEvidence = Object.values(JSON.parse(await readFile(output, "utf8")).cases)[0];
  assert.equal(malformedEvidence.judgeVerdicts.length, 9);
  assert.ok(malformedEvidence.judgeVerdicts.every(({ error }) => error === "invalid judge verdict"));

  await writeFile(file, source({ meaning: "JUDGE_EXIT_23" }));
  const unavailable = run();
  assert.equal(unavailable.status, 1, "A failed judge invocation must fail");
  const unavailableEvidence = Object.values(JSON.parse(await readFile(output, "utf8")).cases)[0];
  assert.equal(unavailableEvidence.judgeVerdicts.length, 9);
  assert.ok(unavailableEvidence.judgeVerdicts.every(({ error }) => error === "model command exited 23"));

  await writeFile(file, source({ meaning: "JUDGE_PROVIDER_SECRET" }));
  const providerFailure = run();
  assert.equal(providerFailure.status, 1, "A provider-reported judge failure must fail");
  const providerEvidenceText = await readFile(output, "utf8");
  assert.doesNotMatch(providerEvidenceText, /sk-ant-private-secret|PRIVATE_PROVIDER_MESSAGE/);
  const providerEvidence = Object.values(JSON.parse(providerEvidenceText).cases)[0];
  assert.ok(providerEvidence.judgeVerdicts.every(({ error }) => error === "model command reported an error"));

  await writeFile(file, source({ context: "ANSWER_FAIL_THIRD" }));
  const answerFailure = run();
  assert.equal(answerFailure.status, 1, "A failed answer invocation must fail");
  const answerEvidenceText = await readFile(output, "utf8");
  assert.doesNotMatch(answerEvidenceText, /PRIVATE_ANSWER_PROVIDER_SECRET/);
  const answerEvidence = Object.values(JSON.parse(answerEvidenceText).cases)[0];
  assert.equal(answerEvidence.failedPhase, "conversation turn");
  assert.ok(answerEvidence.answerTrials.slice(0, 2).every(({ turns, error }) => (
    turns.length === 1 && error === undefined
  )));
  assert.equal(answerEvidence.answerTrials[2].turns.length, 0);
  assert.equal(answerEvidence.answerTrials[2].error, "model conversation exited 23");
});

test("literal response assertions reject numerical expectations", { timeout: 120_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "semantic-literal-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "eval"));
  const model = join(directory, "model.mjs");
  const file = join(directory, "eval", "meaning.test.mjs");
  const output = join(directory, "evidence.json");
  await writeFile(model, `#!/usr/bin/env node
import { createInterface } from "node:readline";
const tools = process.argv[process.argv.indexOf("--tools") + 1].split(",");
process.stdout.write(JSON.stringify({ type: "system", subtype: "init", tools,
  mcp_servers: [{ name: "emseepea_eval", status: "connected" }] }) + "\\n");
createInterface({ input: process.stdin }).on("line", () => {
  process.stdout.write(JSON.stringify({ type: "assistant", message: { content: [{
    type: "tool_use", id: "call-1", name: "mcp__emseepea_eval__get-pea-variety",
    input: { name: "Highland Snap" },
  }] } }) + "\\n");
  process.stdout.write(JSON.stringify({ type: "user", message: { role: "user", content: [{
    type: "tool_result", tool_use_id: "call-1", content: "{}",
  }] } }) + "\\n");
  process.stdout.write(JSON.stringify({ type: "result", is_error: false, num_turns: 2,
    result: "Highland Snap matures in 70 days.", permission_denials: [], modelUsage: {
      "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" },
    } }) + "\\n");
});
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
  ], { cwd: directory, encoding: "utf8", timeout: 60_000 });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const evidence = Object.values(JSON.parse(await readFile(output, "utf8")).cases)[0];
  assert.equal(evidence.failedPhase, "literal response assertion");
});
