import { spawn } from "node:child_process";
import { join } from "node:path";


const model = "claude-sonnet-4-6";

export async function modelVersion() {
  const result = await runProcess("claude", ["--version"], { env: modelEnvironment({}) });
  const version = result.stdout.trim().match(/^(\d+\.\d+\.\d+)\b/)?.[1];
  if (result.code !== 0 || !version) throw new Error("Could not verify Claude CLI version");
  return version;
}

export function parseClaudeEvents(stdout, processExitCode = 0, expectsStructuredOutput = false) {
  const events = stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const result = events.findLast(({ type }) => type === "result");
  const answer = expectsStructuredOutput
    ? result?.structured_output === undefined ? undefined : JSON.stringify(result.structured_output)
    : result?.result;
  const notLoggedIn = events.some(({ message }) => (
    Array.isArray(message?.content)
    && message.content.some(({ type, text }) => type === "text" && /not logged in/i.test(text ?? ""))
  ));
  const toolUses = events.flatMap(({ message }) => (
    Array.isArray(message?.content) ? message.content.filter(({ type }) => type === "tool_use") : []
  ));
  if (notLoggedIn) throw new Error("Model command is not signed in");
  if (processExitCode !== 0) throw new Error(`Model command exited ${processExitCode}`);
  if (result?.is_error || typeof answer !== "string") throw new Error("Model command returned no answer");
  if (toolUses.some(({ name }) => name !== "StructuredOutput" || !expectsStructuredOutput)) {
    throw new Error("Model command used a forbidden tool");
  }
  if (result.num_turns !== 1) throw new Error(`Model command used ${String(result.num_turns)} turns`);
  if ((result.permission_denials?.length ?? 0) > 0) throw new Error("Model command attempted a forbidden action");
  const usage = result.modelUsage?.[model];
  if (usage?.canonicalModel !== model || usage.provider !== "firstParty") {
    throw new Error("Model command did not use the required model");
  }
  return { answer, models: Object.keys(result.modelUsage), turnCount: result.num_turns };
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

export function modelInvocation(provider, prompt, directory, jsonSchema) {
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
      ...(jsonSchema ? ["--json-schema", JSON.stringify(jsonSchema)] : []),
      "--output-format", "stream-json",
      "--verbose",
    ],
    cwd: directory,
    env: modelEnvironment(provider === "claude-ci"
      ? { CLAUDE_CONFIG_DIR: join(directory, "claude-config"), HOME: directory, CLAUDE_CODE_OAUTH_TOKEN: token }
      : { HOME: localHome }),
  };
}

export async function runModel(provider, prompt, directory, signal, jsonSchema) {
  signal?.throwIfAborted();
  const invocation = modelInvocation(provider, prompt, directory, jsonSchema);
  const execution = await runProcess(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    env: invocation.env,
    signal,
    killSignal: "SIGKILL",
  });
  if (execution.timedOut) throw new Error("Model command timed out");
  if (execution.code !== 0 && !execution.stdout) throw new Error(`Model command exited ${execution.code}`);
  return parseClaudeEvents(execution.stdout, execution.code, jsonSchema !== undefined);
}

function runProcess(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 120_000);
    let timedOut = false;
    timer.unref();
    child.stdout.on("data", (chunk) => { stdout += chunk; if (stdout.length > 1_048_576) child.kill("SIGKILL"); });
    child.stderr.resume();
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
