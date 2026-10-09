import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scriptedElicitations } from "./elicitation.mjs";

const claudeModel = "claude-sonnet-4-6";
const mcpServerName = "emseepea_eval";
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const providerErrorMessages = new Map([
  ["error_during_execution", "Model command failed during execution"],
  ["error_max_budget_usd", "Model command exceeded its budget"],
  ["error_max_turns", "Model command exceeded its turn limit"],
]);
const authenticationFailure = /not logged in|failed to authenticate|oauth session expired/i;
const hasAuthenticationFailure = (events) => events.some((event) => (
  (Array.isArray(event.message?.content)
    && event.message.content.some(({ type, text }) => type === "text" && /not logged in/i.test(text ?? "")))
  || (event.type === "result" && event.is_error === true
    && typeof event.result === "string" && authenticationFailure.test(event.result))
));

export async function modelVersion(provider = "claude-local") {
  const codex = provider.startsWith("codex-");
  const command = codex
    ? process.env.EMSEEPEA_CODEX_COMMAND ?? process.env.EMSEEPEA_MODEL_COMMAND ?? "codex"
    : process.env.EMSEEPEA_MODEL_COMMAND ?? "claude";
  const result = await runProcess(command, ["--version"], { env: modelEnvironment({}) });
  const version = result.stdout.trim().match(/(?:codex-cli\s+)?(\d+\.\d+\.\d+)\b/)?.[1];
  if (result.code !== 0 || !version) throw new Error(`Could not verify ${codex ? "Codex" : "Claude"} CLI version`);
  return version;
}

export function providerModel(provider) {
  if (!provider.startsWith("codex-")) return claudeModel;
  const selected = process.env.EMSEEPEA_CODEX_MODEL?.trim();
  if (!selected) throw new Error("Codex model is not configured");
  return selected;
}

export function providerSettings(provider) {
  return provider.startsWith("codex-")
    ? {
        approvalPolicy: "never",
        loginShell: false,
        multiAgent: false,
        sandbox: "read-only",
        shell: "forbidden",
        shellEnvironment: "empty",
        userConfig: "ignored",
        webSearch: false,
      }
    : { effort: "low", maxTurns: 4, permissionMode: "dontAsk", userSettings: false };
}

export function parseClaudeEvents(stdout, processExitCode = 0) {
  let events;
  try {
    events = stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    throw new Error("Model command returned invalid event data");
  }
  const result = events.findLast(({ type }) => type === "result");
  const answer = result?.result;
  const toolUses = events.flatMap(({ message }) => (
    Array.isArray(message?.content) ? message.content.filter(({ type }) => type === "tool_use") : []
  ));
  if (hasAuthenticationFailure(events)) throw new Error("Model command is not signed in");
  if (processExitCode !== 0) throw new Error(`Model command exited ${processExitCode}`);
  if (!result) throw new Error("Model command omitted its result event");
  if (result.is_error) {
    throw new Error(providerErrorMessages.get(result.subtype) ?? "Model command reported an error");
  }
  if (typeof answer !== "string") throw new Error("Model command returned a non-text answer");
  if (toolUses.length > 0) {
    throw Object.assign(new Error("Model command used a forbidden tool"), {
      providerToolCount: toolUses.length,
      providerTurnCount: result.num_turns,
      toolSearchToolCount: toolUses.filter(({ name }) => name === "ToolSearch").length,
      unknownToolCount: toolUses.filter(({ name }) => name !== "ToolSearch").length,
    });
  }
  const expectedTurns = toolUses.length + 1;
  if (!Number.isInteger(result.num_turns)) throw new Error("Model command returned an invalid turn count");
  if (result.num_turns !== expectedTurns) throw new Error("Model command used an unexpected number of turns");
  if ((result.permission_denials?.length ?? 0) > 0) throw new Error("Model command attempted a forbidden action");
  const usage = result.modelUsage?.[claudeModel];
  if (usage?.canonicalModel !== claudeModel || usage.provider !== "firstParty") {
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
  if (init) {
    const available = [...(init.tools ?? [])].sort();
    const expected = [...advertised.keys()].sort();
    const expectedServer = advertised.size > 0
      ? init.mcp_servers?.length === 1
        && init.mcp_servers[0]?.name === mcpServerName
        && init.mcp_servers[0]?.status === "connected"
      : init.mcp_servers?.length === 0;
    if (JSON.stringify(available) !== JSON.stringify(expected)
      || !expectedServer) {
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
  if (hasAuthenticationFailure(events)) throw new Error("Model command is not signed in");
  if (result?.is_error || typeof result?.result !== "string") {
    throw new Error("Model command returned no answer");
  }
  if ((result.permission_denials?.length ?? 0) > 0) {
    throw new Error("Model command attempted a forbidden action");
  }
  if (!Number.isInteger(result.num_turns)) throw new Error("Model command returned an invalid turn count");
  // Native rounds can contain several tool calls. Count limits apply to
  // provider rounds, independently of the number of advertised MCP calls.
  if (result.num_turns < 1 || result.num_turns > 4) {
    throw new Error("Model command exceeded its turn limit");
  }
  const usage = result.modelUsage?.[claudeModel];
  if (usage?.canonicalModel !== claudeModel || usage.provider !== "firstParty") {
    throw new Error("Model command did not use the required model");
  }
  return {
    answer: result.result,
    calls,
    toolResults: toolUses.map(({ id }) => {
      const toolResult = toolResults.get(id);
      return { content: toolResult.content, isError: toolResult.is_error === true };
    }),
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
  if (provider.startsWith("codex-")) return codexInvocation(provider, prompt, directory);
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
      "--model", claudeModel,
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
  if (provider.startsWith("codex-")) {
    return codexInvocation(provider, undefined, directory, { url, tools, authToken, context });
  }
  const nativeTools = tools.map(({ name }) => nativeToolName(name));
  const config = nativeTools.length ? {
    mcpServers: {
      [mcpServerName]: {
        type: "http",
        url,
        ...(authToken ? { headers: { Authorization: "Bearer ${EMSEEPEA_SEMANTIC_MCP_TOKEN}" } } : {}),
      },
    },
  } : undefined;
  const base = modelInvocation(provider, "", directory);
  return {
    ...base,
    args: [
      "--print",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--model", claudeModel,
      "--effort", "low",
      "--max-turns", "4",
      "--strict-mcp-config",
      ...(config ? ["--mcp-config", JSON.stringify(config)] : []),
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
    env: { ...base.env, ...(config && authToken ? { EMSEEPEA_SEMANTIC_MCP_TOKEN: authToken } : {}) },
  };
}

export function startModelConversation(provider, directory, url, tools, authToken, context, signal, serverSecrets = []) {
  if (provider.startsWith("codex-")) {
    return startCodexConversation(provider, directory, url, tools, authToken, context, signal, serverSecrets);
  }
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
  const controlIds = new Set();
  const fail = (message) => {
    if (!pending) return;
    clearTimeout(pending.timer);
    const { reject, script } = pending;
    pending = undefined;
    reject(Object.assign(new Error(message), { elicitations: script.evidence }));
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
      if (event.type === "control_request") {
        try {
          if (!pending || typeof event.request_id !== "string" || !event.request_id
            || controlIds.has(event.request_id)) throw new Error("Unexpected native control request");
          controlIds.add(event.request_id);
          const response = pending.script.respond(event.request);
          child.stdin.write(`${JSON.stringify({ type: "control_response", response: {
            subtype: "success", request_id: event.request_id, response,
          } })}\n`);
        } catch (error) {
          fail(error.message);
          child.kill("SIGKILL");
        }
        continue;
      }
      if (!pending) {
        initialEvents.push(event);
        continue;
      }
      pending.events.push(event);
      if (event.type !== "result") continue;
      clearTimeout(pending.timer);
      const { events, resolve, reject, script } = pending;
      pending = undefined;
      try {
        script.finish();
        const turn = parseNativeClaudeEvents(events, tools, !initialized);
        initialized = true;
        resolve({ ...turn, elicitations: script.evidence });
      } catch (error) { reject(Object.assign(error, { elicitations: script.evidence })); }
    }
  });
  child.once("error", () => fail("Model conversation could not start"));
  child.once("close", (code) => {
    closed = true;
    if (pending) fail(`Model conversation exited ${String(code)}`);
  });
  return Object.freeze({
    send(prompt, options) {
      if (closed || child.stdin.destroyed) throw new Error("Model conversation is closed");
      if (pending) throw new Error("Model conversation already has a pending turn");
      const script = scriptedElicitations(options, [authToken, invocation.env.CLAUDE_CODE_OAUTH_TOKEN, ...serverSecrets]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          fail("Model command timed out");
          child.kill("SIGKILL");
        }, 180_000);
        timer.unref();
        pending = { events: initialEvents, reject, resolve, timer, script };
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
  if (execution.outputLimitExceeded) throw new Error("Model command output exceeded its limit");
  if (execution.errorCode === "ABORT_ERR") throw new Error("Model command was cancelled");
  if (execution.errorCode) throw new Error("Model command could not start");
  if (execution.code !== 0 && !execution.stdout) throw new Error(`Model command exited ${execution.code}`);
  return provider.startsWith("codex-")
    ? parseCodexEvents(execution.stdout, [], undefined, execution.code,
      providerModel(provider), invocation.providerSecrets)
    : parseClaudeEvents(execution.stdout, execution.code);
}

export function parseCodexEvents(stdout, advertisedTools, expectedThreadId, processExitCode = 0, selectedModel = "test-model", secrets = []) {
  let events;
  try {
    events = typeof stdout === "string"
      ? stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
      : stdout;
  } catch {
    throw new Error("Model command returned invalid event data");
  }
  if (!Array.isArray(events)) throw new Error("Model command returned invalid event data");
  const serialized = JSON.stringify(events);
  if (secrets.some((secret) => typeof secret === "string" && secret.length > 0 && serialized.includes(secret))) {
    throw new Error("Model command exposed a configured secret");
  }
  const authentication = /(?:not logged in|authentication|unauthorized|invalid api key|oauth)/i;
  const errorText = events.flatMap((event) => [event.message, event.error?.message, event.item?.message])
    .filter((value) => typeof value === "string").join("\n");
  if (authentication.test(errorText)) throw new Error("Model command is not signed in");
  const failedTool = events.some(({ item }) => item?.type === "mcp_tool_call"
    && (item.status === "failed" || item.result?.isError === true || item.result?.is_error === true));
  if (failedTool) throw new Error("Model command reported a failed MCP tool call");
  if (processExitCode !== 0) throw new Error(`Model command exited ${processExitCode}`);
  if (events.some(({ type }) => type === "turn.failed" || type === "error")) {
    throw new Error("Model command reported an error");
  }
  const started = events.filter(({ type }) => type === "thread.started");
  const threadId = started[0]?.thread_id;
  if (started.length !== 1 || typeof threadId !== "string" || !threadId) {
    throw new Error("Model command omitted its session event");
  }
  if (expectedThreadId && threadId !== expectedThreadId) {
    throw new Error("Model command did not resume the required session");
  }
  if (events.filter(({ type }) => type === "turn.started").length !== 1
    || events.filter(({ type }) => type === "turn.completed").length !== 1) {
    throw new Error("Model command returned an incomplete turn");
  }
  const advertised = new Set(advertisedTools.map(({ name }) => name));
  const completed = events.filter(({ type }) => type === "item.completed").map(({ item }) => item);
  const forbidden = completed.filter((item) => !["agent_message", "reasoning", "mcp_tool_call"].includes(item?.type));
  if (forbidden.length) throw new Error("Model command used a forbidden tool");
  const toolItems = completed.filter(({ type }) => type === "mcp_tool_call");
  const calls = toolItems.map((item) => {
    if (item.server !== mcpServerName || !advertised.has(item.tool)
      || !item.arguments || typeof item.arguments !== "object" || Array.isArray(item.arguments)) {
      throw new Error("Model command used a forbidden tool");
    }
    if (!item.result || typeof item.result !== "object" || item.status === "failed"
      || item.result.isError === true || item.result.is_error === true) {
      throw new Error("Model command reported a failed MCP tool call");
    }
    return { name: item.tool, arguments: item.arguments };
  });
  const messages = completed.filter(({ type }) => type === "agent_message");
  const answer = messages.at(-1)?.text;
  if (typeof answer !== "string") throw new Error("Model command returned no answer");
  const toolResults = toolItems.map(({ result }) => ({ content: result.content ?? result, isError: false }));
  return {
    answer,
    calls,
    toolResults,
    pathEvidence: calls.map((call, index) => ({
      method: "tools/call",
      target: call.name,
      requestSha256: hash({ method: "tools/call", name: call.name, arguments: call.arguments }),
      responseSha256: hash(toolResults[index].content),
    })),
    models: [selectedModel],
    modelEvidence: "configured",
    turnCount: 1,
    providerTurnCount: calls.length + 1,
    providerToolCount: calls.length,
    threadId,
  };
}

function startCodexConversation(provider, directory, url, tools, authToken, context, signal, serverSecrets) {
  let threadId;
  let closed = false;
  return Object.freeze({
    async send(prompt, options) {
      if (closed) throw new Error("Model conversation is closed");
      if (options?.elicitations?.length) throw new Error("Codex provider does not support scripted elicitation");
      const invocation = conversationInvocation(provider, directory, url, tools, authToken, context);
      const args = threadId
        ? ["exec", "resume", threadId,
          ...withoutOption(withoutOption(invocation.args.slice(1), "--cd"), "--sandbox")]
        : invocation.args;
      args.push(prompt);
      const execution = await runProcess(invocation.command, args, {
        cwd: invocation.cwd, env: invocation.env, signal, killSignal: "SIGKILL",
      });
      if (execution.timedOut) throw new Error("Model command timed out");
      if (execution.outputLimitExceeded) throw new Error("Model command output exceeded its limit");
      if (execution.errorCode === "ABORT_ERR") throw new Error("Model command was cancelled");
      if (execution.errorCode) throw new Error("Model conversation could not start");
      const turn = parseCodexEvents(execution.stdout, tools, threadId, execution.code,
        providerModel(provider), [...invocation.providerSecrets, authToken, ...serverSecrets]);
      threadId = turn.threadId;
      return { ...turn, elicitations: [] };
    },
    async close() { closed = true; },
  });
}

function codexInvocation(provider, prompt, directory, conversation) {
  const model = providerModel(provider);
  const sourceHome = process.env.CODEX_HOME ?? (process.env.HOME ? join(process.env.HOME, ".codex") : undefined);
  const sourceAuth = sourceHome ? join(sourceHome, "auth.json") : undefined;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (provider === "codex-ci" && !apiKey) throw new Error("Codex CI authentication is unavailable");
  if (provider === "codex-local" && !apiKey && (!sourceAuth || !existsSync(sourceAuth))) {
    throw new Error("Codex authentication is unavailable");
  }
  const codexHome = join(directory, "codex-home");
  mkdirSync(codexHome, { recursive: true, mode: 0o700 });
  const rules = join(codexHome, "rules");
  mkdirSync(rules, { recursive: true, mode: 0o700 });
  writeFileSync(join(rules, "default.rules"), `prefix_rule(
    pattern = [["bash", "zsh", "sh", "/bin/bash", "/bin/zsh", "/bin/sh", "/usr/bin/bash", "/usr/bin/zsh", "/usr/bin/sh"], ["-c", "-lc"]],
    decision = "forbidden",
    justification = "Only the configured MCP tools are allowed.",
)\n`, { mode: 0o600 });
  const isolatedAuth = join(codexHome, "auth.json");
  if (!apiKey && sourceAuth && !existsSync(isolatedAuth)) symlinkSync(sourceAuth, isolatedAuth);
  const authSecrets = !apiKey && sourceAuth ? credentialValues(sourceAuth) : [];
  const args = [
    "exec", "--json", "--ignore-user-config", "--skip-git-repo-check", "--sandbox", "read-only",
    "--model", model, "--cd", directory,
    "-c", 'approval_policy="never"',
    "-c", 'web_search="disabled"',
    "-c", 'shell_environment_policy.inherit="none"',
    "-c", "allow_login_shell=false",
    "-c", "features.multi_agent=false",
    "-c", "features.unified_exec=false",
  ];
  if (conversation?.context) args.push("-c", `developer_instructions=${JSON.stringify(conversation.context)}`);
  if (conversation?.tools.length) {
    args.push("-c", `mcp_servers.${mcpServerName}.url=${JSON.stringify(conversation.url)}`);
    args.push("-c", `mcp_servers.${mcpServerName}.enabled_tools=${JSON.stringify(conversation.tools.map(({ name }) => name))}`);
    args.push("-c", `mcp_servers.${mcpServerName}.default_tools_approval_mode="approve"`);
    for (const { name } of conversation.tools) {
      args.push("-c", `mcp_servers.${mcpServerName}.tools.${JSON.stringify(name)}.approval_mode="approve"`);
    }
    if (conversation.authToken) {
      args.push("-c", `mcp_servers.${mcpServerName}.bearer_token_env_var="EMSEEPEA_SEMANTIC_MCP_TOKEN"`);
    }
  }
  if (prompt !== undefined) args.push(prompt);
  return {
    command: process.env.EMSEEPEA_CODEX_COMMAND ?? process.env.EMSEEPEA_MODEL_COMMAND ?? "codex",
    args,
    cwd: directory,
    providerSecrets: [apiKey, ...authSecrets].filter(Boolean),
    env: modelEnvironment({ CODEX_HOME: codexHome, ...(apiKey ? { OPENAI_API_KEY: apiKey } : {}),
      ...(conversation?.authToken ? { EMSEEPEA_SEMANTIC_MCP_TOKEN: conversation.authToken } : {}) }),
  };
}

function runProcess(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let timedOut = false;
    let outputLimitExceeded = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, 180_000);
    timer.unref();
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 1_048_576) {
        outputLimitExceeded = true;
        child.kill("SIGKILL");
      }
    });
    child.stderr.resume();
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, errorCode: error.code, outputLimitExceeded, stdout, timedOut });
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, outputLimitExceeded, stdout, timedOut });
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

function withoutOption(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? [...args] : [...args.slice(0, index), ...args.slice(index + 2)];
}

function credentialValues(path) {
  try {
    const values = [];
    const visit = (value, key = "") => {
      if (typeof value === "string" && /(?:token|secret|key|credential)/i.test(key)) values.push(value);
      else if (value && typeof value === "object") {
        for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
      }
    };
    visit(JSON.parse(readFileSync(path, "utf8")));
    return values;
  } catch {
    return [];
  }
}
