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
  timeout: 15_000, skip: process.platform === "win32",
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
  const child = spawn(process.execPath, [cli, "--smoke", "--output", output, file], { stdio: ["ignore", "pipe", "pipe"] });
  const closed = once(child, "close");
  t.after(() => child.kill("SIGTERM"));
  let errors = "";
  child.stderr.on("data", (chunk) => { errors += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Runner did not start descendant")), 5_000);
    let text = "";
    child.stdout.on("data", (chunk) => {
      text += chunk;
      if (text.includes("descendant ready")) { clearTimeout(timeout); resolve(); }
    });
    child.once("error", reject);
  });
  const pid = Number(await readFile(pidFile, "utf8"));
  child.kill("SIGTERM");
  const [code] = await closed;
  assert.equal(code, 1);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { process.kill(pid, 0); } catch (error) {
      assert.equal(error.code, "ESRCH");
      const evidence = await readFile(output, "utf8").catch(() => assert.fail(`No cancellation evidence: ${errors}`));
      assert.equal(JSON.parse(evidence).status, "failed");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("Semantic test descendant survived cancellation");
});

test("executable cases keep fresh trials, custom assertions, and failure gates", { timeout: 90_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "semantic-runner-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "eval", "peas"), { recursive: true });
  const model = join(directory, "model.mjs");
  const calls = join(directory, "calls.jsonl");
  await writeFile(model, `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
const prompt = process.argv[process.argv.indexOf("--print") + 1];
const judge = prompt.includes("Return only JSON with this exact shape");
appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ judge, cwd: process.cwd() }) + "\\n");
const pass = !prompt.includes("REJECT_THIS_ANSWER");
const answer = judge ? JSON.stringify({ pass, score: pass ? 1 : 0, reason: "PRIVATE_JUDGE_DETAIL" }) : "climbing";
process.stdout.write(JSON.stringify({ type: "result", is_error: false, num_turns: 1,
  permission_denials: [], result: answer, modelUsage: {
    "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" }
  } }) + "\\n");
`, { mode: 0o700 });
  const file = join(directory, "eval", "peas", "meaning.test.mjs");
  const output = join(directory, "evidence.json");
  const source = (overrides = "", suffix = "") => `
import assert from "node:assert/strict";
import { before, after } from "node:test";
import { semanticTest } from ${JSON.stringify(helper)};
let ready = false;
before(() => { ready = true; });
after(() => { ready = false; });
const options = {
  server: new URL(${JSON.stringify(server)}), question: "Which variety?",
  criticalFacts: ["climbing"], criteria: "Correctly identify the growth habit.",
  requiredPaths: ["tools/call:get-pea-variety"],
  async exercise(client) {
    assert.equal(ready, true);
    for (const name of ["Highland Snap", "Highland Snap"]) {
      const result = await client.callTool({ name: "get-pea-variety", arguments: { name } });
      assert.notEqual(result.isError, true);
      assert.ok(result.content.length > 0);
    }
  },
  assertAnswer(answer) { assert.equal(answer, "climbing"); },
  ${overrides}
};
semanticTest("variety", options);
${suffix}`;
  const run = () => spawnSync(process.execPath, [cli, "--smoke", "--model-command", model, "--output", output], {
    cwd: directory, encoding: "utf8", timeout: 30_000,
  });

  await writeFile(file, source());
  const passed = run();
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
  const evidence = JSON.parse(await readFile(output, "utf8"));
  assert.equal(evidence.authoritative, false);
  assert.equal(evidence.smoke, true);
  assert.equal(evidence.status, "passed");
  assert.deepEqual(evidence.dependencies, { mcpClient: "2.0.0", claudeCli: "simulated" });
  assert.doesNotMatch(JSON.stringify(evidence), /PRIVATE_JUDGE_DETAIL/);
  const record = Object.values(evidence.cases)[0];
  assert.equal(record.answerTrials.length, 3);
  assert.equal(record.judgeVerdicts.length, 9);
  assert.ok(record.answerTrials.every((trial) => trial.pathEvidence.length === 2));
  const invocations = (await readFile(calls, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(invocations.filter((call) => !call.judge).length, 3);
  assert.equal(invocations.filter((call) => call.judge).length, 9);
  assert.equal(new Set(invocations.map((call) => call.cwd)).size, 12);

  for (const [overrides, phase] of [
    ['criticalFacts: ["absent fact"],', "required facts and answer assertions"],
    ['assertAnswer() { throw new Error("PRIVATE_DETAIL"); },', "required facts and answer assertions"],
    ['criteria: "REJECT_THIS_ANSWER",', "model judgment"],
    ['requiredPaths: ["tools/call:not-called"],', "MCP exercise"],
    ['async exercise() { throw new Error("PRIVATE_DETAIL"); },', "MCP exercise"],
  ]) {
    await writeFile(file, source(overrides));
    const failed = run();
    assert.equal(failed.status, 1, failed.stdout + failed.stderr);
    const failedText = await readFile(output, "utf8");
    assert.doesNotMatch(failedText + failed.stdout + failed.stderr, /PRIVATE_DETAIL/);
    const failure = JSON.parse(failedText);
    assert.equal(failure.status, "failed");
    assert.equal(Object.values(failure.cases)[0].failedPhase, phase);
    if (overrides.startsWith("criticalFacts:")) {
      assert.equal(Object.values(failure.cases)[0].failureCode, "missing-critical-facts");
      assert.deepEqual(Object.values(failure.cases)[0].missingFactIndices, [0]);
      assert.doesNotMatch(failedText, /absent fact/);
    }
  }
  await writeFile(file, source("", 'semanticTest("variety", options);'));
  assert.equal(run().status, 1, "Duplicate test names must fail");
});

test("tool-selection trials choose advertised tools without exposing authentication", { timeout: 90_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "tool-selection-runner-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "eval"));
  const model = join(directory, "model.mjs");
  const modelLog = join(directory, "model-log.jsonl");
  const file = join(directory, "eval", "meaning.test.mjs");
  const output = join(directory, "evidence.json");
  await writeFile(file, `
import { toolSelectionTest } from ${JSON.stringify(helper)};
toolSelectionTest("inventory", {
  server: new URL(${JSON.stringify(protectedServer)}),
  authToken: "example-access-token",
  question: "How many bags can we promise now, and do inbound bags count?",
  criticalFacts: ["120", "35", "85", "40"],
  criteria: "Calculate available bags and exclude inbound stock.",
  expectedTools: ["get-private-inventory-report"],
});
`);
  const modelSource = (plan) => `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
const prompt = process.argv[process.argv.indexOf("--print") + 1];
appendFileSync(${JSON.stringify(modelLog)}, JSON.stringify({
  hasServerToken: Object.values(process.env).includes("example-access-token"),
  selection: prompt.includes("JSON tool plan"),
  avoidsToolInvocation: prompt.includes("Do not invoke tools in this model session"),
  cwd: process.cwd(),
}) + "\\n");
const answer = prompt.includes("JSON tool plan")
  ? ${JSON.stringify(plan)}
  : prompt.includes("Return only JSON with this exact shape")
    ? '{"pass":true,"score":1,"reason":"Every criterion passed."}'
    : "120 on hand minus 35 reserved leaves 85 available; the 40 inbound bags do not count yet.";
const result = { type: "result", is_error: false, num_turns: 1,
  permission_denials: [], modelUsage: {
    "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" }
  } };
if (process.argv.includes("--json-schema")) result.structured_output = JSON.parse(answer);
else result.result = answer;
process.stdout.write(JSON.stringify(result) + "\\n");
`;
  const run = () => spawnSync(process.execPath, [cli, "--smoke", "--model-command", model, "--output", output], {
    cwd: directory, encoding: "utf8", timeout: 30_000,
  });

  await writeFile(model, modelSource('{"calls":[{"name":"get-private-inventory-report","arguments":{}}]}'), { mode: 0o700 });
  const passed = run();
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
  const record = Object.values(JSON.parse(await readFile(output, "utf8")).cases)[0];
  assert.equal(record.mode, "tool-selection");
  assert.equal(record.answerTrials.length, 3);
  assert.ok(record.answerTrials.every((trial) => trial.toolCallCount === 1));
  assert.ok(record.answerTrials.every((trial) => trial.selectionTurnCount === 1));
  assert.ok(record.answerTrials.every((trial) => trial.selectionProviderTurnCount === 1));
  assert.ok(record.answerTrials.every((trial) => trial.selectionProviderToolCount === 0));
  assert.ok(record.answerTrials.every((trial) => trial.selectedTools[0] === "get-private-inventory-report"));
  assert.ok(record.answerTrials.every((trial) => trial.pathEvidence[0].target === "get-private-inventory-report"));
  const modelCalls = (await readFile(modelLog, "utf8")).trim().split("\n").map(JSON.parse);
  assert.ok(modelCalls.every(({ hasServerToken }) => hasServerToken === false));
  assert.ok(modelCalls.filter(({ selection }) => selection).every(({ avoidsToolInvocation }) => avoidsToolInvocation));
  assert.equal(modelCalls.filter(({ selection }) => selection).length, 3);
  assert.equal(new Set(modelCalls.map(({ cwd }) => cwd)).size, 15);

  for (const plan of [
    '{"calls":[]}',
    '{"calls":[{"name":"unknown-tool","arguments":{}}]}',
    '{"calls":[{"name":"get-private-inventory-report","arguments":{}},{"name":"get-private-inventory-report","arguments":{}}]}',
  ]) {
    await writeFile(model, modelSource(plan), { mode: 0o700 });
    const failed = run();
    assert.equal(failed.status, 1, failed.stdout + failed.stderr);
    const failure = Object.values(JSON.parse(await readFile(output, "utf8")).cases)[0];
    assert.equal(failure.failedPhase, "tool selection validation");
    assert.match(failure.failureReason, /^Tool selection |^Model selected /);
  }

  await writeFile(model, '#!/usr/bin/env node\nprocess.stdout.write("PRIVATE_MODEL_TEXT{");\n', { mode: 0o700 });
  const malformed = run();
  assert.equal(malformed.status, 1, malformed.stdout + malformed.stderr);
  const malformedText = await readFile(output, "utf8");
  assert.doesNotMatch(malformedText, /PRIVATE_MODEL_TEXT/);
  assert.equal(
    Object.values(JSON.parse(malformedText).cases)[0].failureReason,
    "Unclassified tool-selection failure",
  );
});
