import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadSemanticCase } from "./case.mjs";
import { collectMcpMaterial, startSemanticServer, stopSemanticServer } from "./material.mjs";

const model = "claude-sonnet-4-6";
const counters = new Map();

export function parseClaudeEvents(stdout, processExitCode = 0) {
  const events = stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const result = events.findLast(({ type }) => type === "result");
  const notLoggedIn = events.some(({ message }) => (
    Array.isArray(message?.content)
    && message.content.some(({ type, text }) => type === "text" && /not logged in/i.test(text ?? ""))
  ));
  const toolUses = events.flatMap(({ message }) => (
    Array.isArray(message?.content) ? message.content.filter(({ type }) => type === "tool_use") : []
  ));
  if (notLoggedIn) throw new Error("Model command is not signed in");
  if (processExitCode !== 0) throw new Error(`Model command exited ${processExitCode}`);
  if (result?.is_error || typeof result?.result !== "string") throw new Error("Model command returned no answer");
  if (toolUses.length > 0) throw new Error("Model command used a forbidden tool");
  if (result.num_turns !== 1) throw new Error(`Model command used ${String(result.num_turns)} turns`);
  if ((result.permission_denials?.length ?? 0) > 0) throw new Error("Model command attempted a forbidden action");
  const usage = result.modelUsage?.[model];
  if (usage?.canonicalModel !== model || usage.provider !== "firstParty") {
    throw new Error("Model command did not use the required model");
  }
  return { answer: result.result, models: Object.keys(result.modelUsage), turnCount: result.num_turns };
}

export function parseJudgeVerdict(output) {
  const verdict = JSON.parse(output);
  const keys = verdict && typeof verdict === "object" && !Array.isArray(verdict)
    ? Object.keys(verdict).sort()
    : [];
  if (
    keys.join(",") !== "pass,reason,score"
    || !((verdict.pass === true && verdict.score === 1) || (verdict.pass === false && verdict.score === 0))
    || typeof verdict.reason !== "string"
    || verdict.reason.trim() === ""
  ) throw new Error("Judge returned an invalid verdict");
  return verdict;
}

export function modelInvocation(provider, prompt, directory) {
  const token = provider === "claude-ci" ? process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim() : undefined;
  if (provider === "claude-ci" && !token) throw new Error("Claude subscription authentication is unavailable");
  const localHome = provider === "claude-local" ? process.env.HOME : undefined;
  if (provider === "claude-local" && !localHome?.startsWith("/")) {
    throw new Error("Local model evaluation requires an absolute HOME");
  }
  return {
    command: process.env.EMSEEPEA_MODEL_COMMAND ?? "claude",
    args: [
      "--print", prompt,
      "--model", model,
      "--effort", "low",
      "--safe-mode",
      "--strict-mcp-config",
      "--disable-slash-commands",
      "--no-session-persistence",
      "--permission-mode", "dontAsk",
      "--setting-sources", "",
      "--tools", "",
      "--no-chrome",
      "--prompt-suggestions", "false",
      "--output-format", "stream-json",
      "--verbose",
    ],
    cwd: directory,
    env: modelEnvironment(provider === "claude-ci"
      ? { CLAUDE_CONFIG_DIR: join(directory, "claude-config"), HOME: directory, CLAUDE_CODE_OAUTH_TOKEN: token }
      : { HOME: localHome }),
  };
}

export default class SemanticProvider {
  constructor(options = {}) {
    this.role = options.config?.role ?? "agent";
    this.provider = process.env.EMSEEPEA_EVAL_PROVIDER ?? "claude-local";
  }

  id() {
    return `${this.provider}-${this.role}`;
  }

  async callApi(prompt, context = {}) {
    const casePath = String(context.vars?.casePath ?? "");
    const trial = nextTrial(`${casePath}:${this.role}`);
    const directory = await mkdtemp(join(tmpdir(), `emseepea-${this.role}-`));
    let running;
    try {
      let effectivePrompt = prompt;
      let pathEvidence = [];
      let materialSha256;
      if (this.role === "agent") {
        const testCase = await loadSemanticCase(casePath);
        running = await startSemanticServer(testCase);
        const material = await collectMcpMaterial(running.url, testCase);
        effectivePrompt = `${material.text}\n\nAnswer only from that MCP material.\n\nQuestion:\n${prompt}`;
        pathEvidence = material.pathEvidence;
        materialSha256 = createHash("sha256").update(material.text).digest("hex");
      }
      const result = await runModel(this.provider, effectivePrompt, directory);
      const output = this.role === "judge" ? result.answer.trim() : result.answer;
      const verdict = this.role === "judge" ? parseJudgeVerdict(output) : undefined;
      const metadata = {
        casePath,
        materialSha256,
        models: result.models,
        pathEvidence,
        provider: this.provider,
        role: this.role,
        toolCallCount: 0,
        trial,
        turnCount: result.turnCount,
      };
      await recordEvidence({ ...metadata, status: "completed", verdict });
      return { output, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordEvidence({ casePath, error: message, provider: this.provider, role: this.role, status: "error", trial });
      return { error: message };
    } finally {
      if (running) await stopSemanticServer(running.child);
      await rm(directory, { force: true, recursive: true });
    }
  }
}

export async function runModel(provider, prompt, directory) {
  const invocation = modelInvocation(provider, prompt, directory);
  const execution = await runProcess(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    env: invocation.env,
  });
  if (execution.timedOut) throw new Error("Model command timed out");
  if (execution.code !== 0 && !execution.stdout) throw new Error(`Model command exited ${execution.code}`);
  return parseClaudeEvents(execution.stdout, execution.code);
}

function runProcess(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 120_000);
    let timedOut = false;
    timer.unref();
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, error: error.message, stdout, timedOut });
    });
    child.once("close", (code, signal) => {
      if (signal === "SIGKILL") timedOut = true;
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, timedOut });
    });
  });
}

function modelEnvironment(extra) {
  return Object.fromEntries(Object.entries({
    CI: "true",
    LANG: process.env.LANG ?? "C.UTF-8",
    LOGNAME: process.env.LOGNAME,
    NO_COLOR: "1",
    PATH: process.env.PATH,
    SHELL: process.env.SHELL,
    TMPDIR: process.env.TMPDIR,
    USER: process.env.USER,
    ...extra,
  }).filter(([, value]) => value !== undefined));
}

function nextTrial(key) {
  const trial = (counters.get(key) ?? 0) + 1;
  counters.set(key, trial);
  return trial;
}

async function recordEvidence(record) {
  const path = process.env.EMSEEPEA_EVAL_PROVIDER_EVIDENCE;
  if (path) await appendFile(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
}
