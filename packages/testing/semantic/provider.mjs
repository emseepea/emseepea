import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";

const model = "claude-sonnet-4-6";
const mcpServerName = "emseepea_eval";
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function modelVersion() {
  const result = await runProcess("claude", ["--version"], { env: modelEnvironment({}) });
  const version = result.stdout.trim().match(/^(\d+\.\d+\.\d+)\b/)?.[1];
  if (result.code !== 0 || !version) throw new Error("Could not verify Claude CLI version");
  return version;
}

export function parseClaudeEvents(stdout, processExitCode = 0) {
  const events = stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const result = events.findLast(({ type }) => type === "result");
  const answer = result?.result;
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
  if (toolUses.length > 0) {
    throw Object.assign(new Error("Model command used a forbidden tool"), {
      providerToolCount: toolUses.length,
      providerTurnCount: result.num_turns,
      toolSearchToolCount: toolUses.filter(({ name }) => name === "ToolSearch").length,
      unknownToolCount: toolUses.filter(({ name }) => name !== "ToolSearch").length,
    });
  }
  const expectedTurns = toolUses.length + 1;
  if (result.num_turns !== expectedTurns) throw new Error(`Model command used ${String(result.num_turns)} turns`);
  if ((result.permission_denials?.length ?? 0) > 0) throw new Error("Model command attempted a forbidden action");
  const usage = result.modelUsage?.[model];
  if (usage?.canonicalModel !== model || usage.provider !== "firstParty") {
    throw new Error("Model command did not use the required model");
  }
  return {
    answer,
    models: Object.keys(result.modelUsage),
    turnCount: result.num_turns - toolUses.length,
    providerTurnCount: result.num_turns,
    providerToolCount: toolUses.length,
  };
}

export function parseNativeClaudeEvents(stdout, advertisedTools, requireInit = false) {
  const events = typeof stdout === "string"
    ? stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
    : stdout;
  const result = events.findLast(({ type }) => type === "result");
  const init = events.find(({ type, subtype }) => type === "system" && subtype === "init");
  const toolUses = events.flatMap(({ message }) => (
    Array.isArray(message?.content) ? message.content.filter(({ type }) => type === "tool_use") : []
  ));
  const advertised = new Map(advertisedTools.map(({ name }) => [nativeToolName(name), name]));
  if (requireInit && !init) throw new Error("Model command omitted MCP initialization evidence");
  const calls = toolUses.map(({ name, input }) => {
    const publicName = advertised.get(name);
    if (!publicName || !input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("Model command used a forbidden tool");
    }
    return { name: publicName, arguments: input };
  });
  if (toolUses.length > 3) throw new Error("Model command used more than three tools");
  if (init) {
    const available = [...(init.tools ?? [])].sort();
    const expected = [...advertised.keys()].sort();
    if (JSON.stringify(available) !== JSON.stringify(expected)
      || init.mcp_servers?.length !== 1
      || init.mcp_servers[0]?.name !== mcpServerName
      || init.mcp_servers[0]?.status !== "connected") {
      throw new Error("Model command did not expose exactly the target MCP tools");
    }
  }
  const toolResults = new Map(events.flatMap(({ message }) => (
    message?.role === "user" && Array.isArray(message.content)
      ? message.content.filter(({ type }) => type === "tool_result")
      : []
  )).map((item) => [item.tool_use_id, item]));
  const pathEvidence = toolUses.map((use, index) => {
    const response = toolResults.get(use.id);
    if (!response) throw new Error("Model command omitted an MCP tool result");
    const call = calls[index];
    return {
      method: "tools/call",
      target: call.name,
      requestSha256: hash({ method: "tools/call", name: call.name, arguments: call.arguments }),
      responseSha256: hash(response.content),
    };
  });
  const notLoggedIn = events.some(({ message }) => Array.isArray(message?.content)
    && message.content.some(({ type, text }) => type === "text" && /not logged in/i.test(text ?? "")));
  if (notLoggedIn) throw new Error("Model command is not signed in");
  if (result?.is_error || typeof result?.result !== "string") {
    throw new Error("Model command returned no answer");
  }
  if ((result.permission_denials?.length ?? 0) > 0) {
    throw new Error("Model command attempted a forbidden action");
  }
  if (result.num_turns !== toolUses.length + 1) {
    throw new Error(`Model command used ${String(result.num_turns)} turns`);
  }
  const usage = result.modelUsage?.[model];
  if (usage?.canonicalModel !== model || usage.provider !== "firstParty") {
    throw new Error("Model command did not use the required model");
  }
  return {
    answer: result.result,
    calls,
    pathEvidence,
    models: Object.keys(result.modelUsage),
    turnCount: 1,
    providerTurnCount: result.num_turns,
    providerToolCount: toolUses.length,
  };
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
      "--max-turns", "4",
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

export function conversationInvocation(provider, directory, url, tools, authToken, context) {
  const nativeTools = tools.map(({ name }) => nativeToolName(name));
  const config = {
    mcpServers: {
      [mcpServerName]: {
        type: "http",
        url,
        ...(authToken ? { headers: { Authorization: "Bearer ${EMSEEPEA_SEMANTIC_MCP_TOKEN}" } } : {}),
      },
    },
  };
  const base = modelInvocation(provider, "", directory);
  return {
    ...base,
    args: [
      "--print",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--model", model,
      "--effort", "low",
      "--max-turns", "4",
      "--strict-mcp-config",
      "--mcp-config", JSON.stringify(config),
      "--disable-slash-commands",
      "--no-session-persistence",
      "--permission-mode", "dontAsk",
      "--setting-sources", "",
      "--tools", nativeTools.join(","),
      ...(nativeTools.length ? ["--allowedTools", nativeTools.join(",")] : []),
      ...(context ? ["--append-system-prompt", context] : []),
      "--no-chrome",
      "--prompt-suggestions", "false",
    ],
    env: { ...base.env, ...(authToken ? { EMSEEPEA_SEMANTIC_MCP_TOKEN: authToken } : {}) },
  };
}

export function startModelConversation(provider, directory, url, tools, authToken, context, signal) {
  signal?.throwIfAborted();
  const invocation = conversationInvocation(provider, directory, url, tools, authToken, context);
  const child = spawn(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    env: invocation.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  let buffered = "";
  let pending;
  let initialEvents = [];
  let initialized = false;
  let closed = false;
  const fail = (message) => {
    if (!pending) return;
    clearTimeout(pending.timer);
    const reject = pending.reject;
    pending = undefined;
    reject(new Error(message));
  };
  const abort = () => { fail("Model conversation was cancelled"); child.kill("SIGKILL"); };
  signal?.addEventListener("abort", abort, { once: true });
  child.stdout.on("data", (chunk) => {
    buffered += chunk;
    if (buffered.length > 1_048_576) {
      fail("Model command output exceeded its limit");
      child.kill("SIGKILL");
      return;
    }
    let newline;
    while ((newline = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      if (!line) continue;
      let event;
      try { event = JSON.parse(line); } catch {
        fail("Model command returned invalid event data");
        child.kill("SIGKILL");
        return;
      }
      if (!pending) {
        initialEvents.push(event);
        continue;
      }
      pending.events.push(event);
      if (event.type !== "result") continue;
      clearTimeout(pending.timer);
      const { events, resolve, reject } = pending;
      pending = undefined;
      try {
        const turn = parseNativeClaudeEvents(events, tools, !initialized);
        initialized = true;
        resolve(turn);
      } catch (error) { reject(error); }
    }
  });
  child.once("error", () => fail("Model conversation could not start"));
  child.once("close", (code) => {
    closed = true;
    if (pending) fail(`Model conversation exited ${String(code)}`);
  });
  return Object.freeze({
    send(prompt) {
      if (closed || child.stdin.destroyed) throw new Error("Model conversation is closed");
      if (pending) throw new Error("Model conversation already has a pending turn");
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          fail("Model command timed out");
          child.kill("SIGKILL");
        }, 120_000);
        timer.unref();
        pending = { events: initialEvents, reject, resolve, timer };
        initialEvents = [];
        child.stdin.write(`${JSON.stringify({
          type: "user",
          message: { role: "user", content: [{ type: "text", text: prompt }] },
        })}\n`);
      });
    },
    async close() {
      signal?.removeEventListener("abort", abort);
      if (closed) return;
      const exited = new Promise((resolve) => child.once("close", resolve));
      child.stdin.end();
      const timer = setTimeout(() => child.kill("SIGKILL"), 3_000);
      timer.unref();
      await exited;
      clearTimeout(timer);
    },
  });
}

export async function runModel(provider, prompt, directory, signal) {
  signal?.throwIfAborted();
  const invocation = modelInvocation(provider, prompt, directory);
  const execution = await runProcess(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    env: invocation.env,
    signal,
    killSignal: "SIGKILL",
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
    ENABLE_TOOL_SEARCH: "false",
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

function nativeToolName(name) {
  return `mcp__${mcpServerName}__${name}`;
}
