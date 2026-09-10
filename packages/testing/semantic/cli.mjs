#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { discoverTests } from "./discover.mjs";
import { modelVersion } from "./provider.mjs";

const negativeFeedbackObservations = new Set([
  "error",
  "friction",
  "annoyance",
  "unnecessary_difficulty",
  "confusion",
  "repetition",
  "unexpected_bad_result",
  "capability_mismatch",
]);

const paths = [];
let provider = process.env.EMSEEPEA_EVAL_PROVIDER ?? "claude-local";
let output = "artifacts/llm-eval/evidence.json";
let modelCommand;
let smoke = false;
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg === "--provider") provider = process.argv[++i];
  else if (arg === "--output") output = process.argv[++i];
  else if (arg === "--model-command") modelCommand = process.argv[++i];
  else if (arg === "--smoke") smoke = true;
  else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
  else paths.push(arg);
}
if (!["claude-local", "claude-ci"].includes(provider)) throw new Error("Unsupported provider");
if ((smoke && provider === "claude-ci") || (modelCommand && !smoke)) throw new Error("Custom model commands are smoke-only");
if (!paths.length) paths.push("eval");
const files = await discoverTests(paths);
const directory = await mkdtemp(join(tmpdir(), "emseepea-evidence-"));
const evidence = { authoritative: provider === "claude-ci", provider, smoke,
  model: "claude-sonnet-4-6", semanticRetries: 0, revision: process.env.GITHUB_SHA,
  status: "failed", cases: {}, errors: [], startedAt: new Date().toISOString() };
try {
  const client = JSON.parse(await readFile(new URL("../package.json", import.meta.resolve("@modelcontextprotocol/client")), "utf8"));
  if (client.name !== "@modelcontextprotocol/client" || client.version !== "2.0.0") throw new Error("Unexpected MCP client version");
  evidence.dependencies = { mcpClient: client.version, claudeCli: smoke ? "simulated" : await modelVersion() };
  if (provider === "claude-ci" && evidence.dependencies.claudeCli !== "2.1.248") throw new Error("Unexpected Claude CLI version");
  let interrupted = false;
  for (const file of files) {
    const displayFile = relative(process.cwd(), file);
    const code = await new Promise((resolveCode) => {
      const environment = { ...process.env, EMSEEPEA_EVAL_PROVIDER: provider, EMSEEPEA_EVAL_SMOKE: smoke ? "1" : "0",
        EMSEEPEA_EVIDENCE_DIR: directory, EMSEEPEA_TEST_FILE: displayFile,
        EMSEEPEA_MODEL_COMMAND: modelCommand ? resolve(modelCommand) : "claude" };
      delete environment.NODE_TEST_CONTEXT;
      const child = spawn(process.execPath, ["--test", "--test-concurrency=1", file], {
        stdio: "inherit",
        env: environment,
        detached: process.platform !== "win32",
      });
      let stopped = false;
      const stop = () => {
        if (stopped || !child.pid) return;
        stopped = true;
        try {
          if (process.platform === "win32") child.kill("SIGKILL");
          else process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") {
            interrupted = true;
            evidence.errors.push("Could not confirm test-process cleanup");
            child.kill("SIGKILL");
          }
        }
      };
      const cancel = () => { interrupted = true; stop(); };
      const timer = setTimeout(cancel, 38 * 60_000);
      process.once("SIGINT", cancel);
      process.once("SIGTERM", cancel);
      const finish = (code) => {
        clearTimeout(timer);
        process.off("SIGINT", cancel);
        process.off("SIGTERM", cancel);
        stop();
        resolveCode(interrupted ? 1 : code);
      };
      child.once("exit", stop);
      child.once("error", () => finish(1));
      child.once("close", (code) => finish(code ?? 1));
    });
    if (code !== 0) evidence.errors.push(`Test file failed: ${displayFile}`);
    if (interrupted) break;
  }
  for (const name of await readdir(directory)) {
    const record = JSON.parse(await readFile(join(directory, name), "utf8"));
    evidence.cases[name.replace(/\.json$/, "")] = record;
  }
  for (const file of files) {
    const displayFile = relative(process.cwd(), file);
    const cases = Object.values(evidence.cases).filter((record) => record.file === displayFile);
    if (!cases.length || cases.some((record) => !validRecord(record, evidence.authoritative, smoke))) {
      evidence.errors.push(`Missing or failed qualification: ${displayFile}`);
    }
  }
  evidence.status = evidence.errors.length ? "failed" : "passed";
} finally {
  evidence.finishedAt = new Date().toISOString();
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  await rm(directory, { recursive: true, force: true });
}
if (evidence.status !== "passed") process.exitCode = 1;
console.log(`Semantic checks ${evidence.status}; evidence: ${output}`);

function validRecord(record, authoritative, smoke) {
  const isHash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  if (record.status !== "passed" || record.authoritative !== authoritative || record.smoke !== smoke
    || record.mode !== "conversation" || record.answerTrials?.length !== 3
    || !Number.isInteger(record.judgeVerdicts?.length) || record.judgeVerdicts.length < 9
    || record.judgeVerdicts.length % 3 !== 0
    || !record.judgeVerdicts.every((judgment) => isHash(judgment.expectationSha256)
      && isHash(judgment.requestSha256) && isHash(judgment.responseSha256)
      && typeof judgment.expectedMeaning === "string" && judgment.expectedMeaning.length > 0
      && judgment.verdict?.pass === true && judgment.verdict.score === 1
      && typeof judgment.verdict.reason === "string" && judgment.verdict.reason.length > 0)) return false;
  return record.answerTrials.every((trial) => Array.isArray(trial.turns) && trial.turns.length > 0
    && trial.turns.every((turn) => Number.isInteger(turn.advertisedToolCount)
      && turn.advertisedToolCount >= 0
      && turn.interactionMode === "native-mcp"
      && turn.answerTurnCount === 1
      && turn.answerProviderToolCount === turn.toolCallCount
      && turn.answerProviderTurnCount === turn.toolCallCount + 1
      && Number.isInteger(turn.toolCallCount) && turn.toolCallCount >= 0 && turn.toolCallCount <= 3
      && typeof turn.prompt === "string" && turn.prompt.length > 0
      && typeof turn.response === "string"
      && isHash(turn.promptSha256) && isHash(turn.answerSha256)
      && isHash(turn.advertisedToolsSha256) && isHash(turn.selectedCallsSha256)
      && Array.isArray(turn.toolCalls)
      && JSON.stringify(turn.selectedTools)
        === JSON.stringify(turn.toolCalls.map(({ name }) => name))
      && validToolAssertions(turn, isHash)
      && validNegativeFeedbackAssertion(turn)
      && validFeedbackDisclosure(turn, record.judgeVerdicts, trial.trial, isHash)
      && turn.toolCalls.every((call) => Object.hasOwn(call, "result") && typeof call.isError === "boolean")
      && Array.isArray(turn.pathEvidence) && turn.pathEvidence.length === turn.toolCallCount
      && turn.pathEvidence.every(({ method, target, requestSha256, responseSha256 }) =>
        method === "tools/call" && turn.selectedTools.includes(target)
          && isHash(requestSha256) && isHash(responseSha256))));
}

function validToolAssertions(turn, isHash) {
  if (turn.expectedOptionalFeedback === true) {
    if (!Array.isArray(turn.expectedCalls)) return false;
    const expectedHash = createHash("sha256").update(JSON.stringify({
      calls: turn.expectedCalls,
      optionalFeedback: true,
    })).digest("hex");
    const calls = turn.toolCalls.map(({ name, arguments: args }) => ({ name, arguments: args }));
    const primaryCalls = calls.slice(0, turn.expectedCalls?.length);
    const trailingCalls = calls.slice(turn.expectedCalls?.length);
    return expectedHash === turn.expectedSelectionSha256
      && JSON.stringify(primaryCalls) === JSON.stringify(turn.expectedCalls)
      && (trailingCalls.length === 0
        || (trailingCalls.length === 1 && trailingCalls[0].name === "submit-feedback"));
  }
  if (typeof turn.expectedOptionalTool === "string" && turn.expectedOptionalTool.trim()) {
    const expectedHash = createHash("sha256").update(JSON.stringify({
      optionalTool: turn.expectedOptionalTool,
    })).digest("hex");
    return expectedHash === turn.expectedSelectionSha256
      && (turn.toolCalls.length === 0
        || (turn.toolCalls.length === 1 && turn.toolCalls[0].name === turn.expectedOptionalTool));
  }
  if (JSON.stringify(turn.selectedTools) !== JSON.stringify(turn.expectedTools)) return false;
  if (isHash(turn.expectedCallsSha256)) {
    return JSON.stringify(turn.toolCalls.map(({ name, arguments: args }) => ({ name, arguments: args })))
      === JSON.stringify(turn.expectedCalls);
  }
  if (!isHash(turn.expectedSelectionSha256)) return false;
  const expectedHash = createHash("sha256").update(JSON.stringify({
    tools: turn.expectedTools,
    arguments: turn.expectedArguments,
    feedback: turn.expectedFeedback,
  })).digest("hex");
  if (expectedHash !== turn.expectedSelectionSha256) return false;
  for (const [name, expected] of Object.entries(turn.expectedArguments ?? {})) {
    const matches = turn.toolCalls.filter((call) => call.name === name);
    if (matches.length !== 1 || JSON.stringify(matches[0].arguments) !== JSON.stringify(expected)) return false;
  }
  if (turn.expectedFeedback) {
    const calls = turn.toolCalls.filter((call) => call.name === "submit-feedback");
    const detail = calls[0]?.arguments?.detail;
    if (calls.length !== 1 || !turn.expectedFeedback.observation.includes(calls[0].arguments?.observation)
      || typeof detail !== "string" || turn.expectedFeedback.detailIncludes.some(
        (value) => !detail.toLowerCase().includes(value.toLowerCase()),
      )) return false;
  }
  return true;
}

function validNegativeFeedbackAssertion(turn) {
  if (turn.expectedNegativeFeedback !== false) return true;
  const actual = turn.toolCalls.filter((call) => call.name === "submit-feedback"
    && negativeFeedbackObservations.has(call.arguments?.observation));
  return actual.length === 0 && JSON.stringify(actual) === JSON.stringify(turn.negativeFeedbackCalls);
}

function validFeedbackDisclosure(turn, judgments, trial, isHash) {
  if (turn.expectedOptionalFeedback !== true) return turn.feedbackDisclosure === undefined;
  const feedback = turn.toolCalls[turn.expectedCalls.length];
  if (!feedback) return turn.feedbackDisclosure === undefined;
  if (feedback.isError || typeof feedback.arguments?.observation !== "string"
    || !feedback.arguments.observation.trim() || typeof feedback.arguments.detail !== "string"
    || !feedback.arguments.detail.trim()) return false;
  const expectedMeaning = feedbackDisclosureExpectation(feedback);
  const expectationSha256 = createHash("sha256").update(expectedMeaning).digest("hex");
  if (!isHash(turn.feedbackDisclosure?.expectationSha256)
    || JSON.stringify(turn.feedbackDisclosure) !== JSON.stringify({
      observation: feedback.arguments.observation,
      detail: feedback.arguments.detail,
      expectationSha256,
    })) return false;
  const matching = judgments.filter((judgment) => judgment.trial === trial
    && judgment.turn === turn.turn && judgment.expectationSha256 === expectationSha256);
  return matching.length === 3 && matching.every((judgment) =>
    judgment.expectedMeaning === expectedMeaning && judgment.verdict?.pass === true);
}

function feedbackDisclosureExpectation(call) {
  return "The final assistant response makes it clear that feedback was submitted, recorded, or noted, "
    + "and communicates the substance "
    + `of this specific ${call.arguments.observation} observation: ${call.arguments.detail}`;
}
