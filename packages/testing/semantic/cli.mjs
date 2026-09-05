#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { discoverTests } from "./discover.mjs";
import { modelVersion } from "./provider.mjs";

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
    const code = await new Promise((resolveCode) => {
      const environment = { ...process.env, EMSEEPEA_EVAL_PROVIDER: provider, EMSEEPEA_EVAL_SMOKE: smoke ? "1" : "0",
        EMSEEPEA_EVIDENCE_DIR: directory, EMSEEPEA_TEST_FILE: file,
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
    if (code !== 0) evidence.errors.push(`Test file failed: ${file}`);
    if (interrupted) break;
  }
  for (const name of await readdir(directory)) {
    const record = JSON.parse(await readFile(join(directory, name), "utf8"));
    evidence.cases[name.replace(/\.json$/, "")] = record;
  }
  for (const file of files) {
    const cases = Object.values(evidence.cases).filter((record) => record.file === file);
    if (!cases.length || cases.some((record) => !validRecord(record, evidence.authoritative, smoke))) {
      evidence.errors.push(`Missing or failed qualification: ${file}`);
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
  if (record.status !== "passed" || record.authoritative !== authoritative || record.smoke !== smoke
    || record.answerTrials?.length !== 3 || record.judgeVerdicts?.length !== 9) return false;
  if (record.mode !== "tool-selection") return record.mode === "prepared";
  return record.answerTrials.every((trial) => trial.selectionTurnCount === 1
    && Number.isInteger(trial.selectionProviderToolCount) && trial.selectionProviderToolCount >= 0
    && trial.selectionProviderToolCount <= 2
    && trial.selectionProviderTurnCount === trial.selectionProviderToolCount + 1
    && Number.isInteger(trial.toolCallCount) && trial.toolCallCount >= 1 && trial.toolCallCount <= 3
    && typeof trial.advertisedToolsSha256 === "string" && typeof trial.selectedCallsSha256 === "string"
    && JSON.stringify(trial.selectedTools) === JSON.stringify(trial.expectedTools));
}
