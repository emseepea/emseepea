import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startGuardedMcpProxy } from "./material.mjs";

const claudeModel = "claude-sonnet-4-6";
const openAiModel = "gpt-5.6-sol";
const codexVersionRequired = "0.145.0";
const mcpServerName = "emseepea_eval";
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const providerErrorMessages = new Map([
  ["error_during_execution", "Model command failed during execution"],
  ["error_max_budget_usd", "Model command exceeded its budget"],
  ["error_max_turns", "Model command exceeded its turn limit"],
]);

export async function modelVersion() {
  const result = await runProcess("claude", ["--version"], { env: modelEnvironment({}) });
  const version = result.stdout.trim().match(/^(\d+\.\d+\.\d+)\b/)?.[1];
  if (result.code !== 0 || !version) throw new Error("Could not verify Claude CLI version");
  return version;
}

export async function codexVersion() {
  const result = await runProcess("codex", ["--version"], { env: modelEnvironment({}) });
  const version = result.stdout.trim().match(/codex-cli (\d+\.\d+\.\d+)/)?.[1];
  if (result.code !== 0 || version !== codexVersionRequired) throw new Error("Could not verify required Codex CLI version");
  return version;
}

export function providerModel(provider) {
  return provider === "openai-local" ? openAiModel : claudeModel;
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
  const notLoggedIn = events.some(({ message }) => (
    Array.isArray(message?.content)
    && message.content.some(({ type, text }) => type === "text" && /not logged in/i.test(text ?? ""))
  ));
  const toolUses = events.flatMap(({ message }) => (
    Array.isArray(message?.content) ? message.content.filter(({ type }) => type === "tool_use") : []
  ));
  if (notLoggedIn) throw new Error("Model command is not signed in");
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
  if (toolUses.length > 3) {
    throw Object.assign(new Error("Model command used more than three tools"), {
      attemptedToolCalls: calls,
    });
  }
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
  const notLoggedIn = events.some(({ message }) => Array.isArray(message?.content)
    && message.content.some(({ type, text }) => type === "text" && /not logged in/i.test(text ?? "")));
  if (notLoggedIn) throw new Error("Model command is not signed in");
  if (result?.is_error || typeof result?.result !== "string") {
    throw new Error("Model command returned no answer");
  }
  if ((result.permission_denials?.length ?? 0) > 0) {
    throw new Error("Model command attempted a forbidden action");
  }
  if (!Number.isInteger(result.num_turns)) throw new Error("Model command returned an invalid turn count");
  if (result.num_turns !== toolUses.length + 1) {
    throw new Error("Model command used an unexpected number of turns");
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

export async function startModelConversation(provider, directory, url, tools, authToken, context, signal, mcpSession) {
  if (provider === "openai-local") return startOpenAiConversation(tools, context, signal, mcpSession, directory);
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
        }, 180_000);
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
  if (provider === "openai-local") return runOpenAiJudge(prompt, directory, signal);
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
  return parseClaudeEvents(execution.stdout, execution.code);
}

async function startOpenAiConversation(tools, context, signal, mcpSession, directory) {
  if (!mcpSession) throw new Error("OpenAI model conversation needs an MCP tool session");
  const home = await prepareCodexHome(directory);
  const token = randomBytes(32).toString("hex");
  let proxy;
  try {
    proxy = await startGuardedMcpProxy(mcpSession, token, signal);
    await verifyCodexLogin(home, directory);
  } catch (error) {
    await proxy?.close();
    await rm(home, { recursive: true });
    throw error;
  }
  let threadId;
  let pending = false;
  let closed = false;
  return Object.freeze({
    async send(prompt) {
      if (closed) throw new Error("Model conversation is closed");
      if (pending) throw new Error("Model conversation already has a pending turn");
      pending = true;
      proxy.beginTurn();
      try {
        const invocation = codexInvocation({ context, directory, home, prompt, proxyUrl: proxy.url, token, tools, threadId });
        const execution = await runProcess(invocation.command, invocation.args, {
          cwd: directory, env: invocation.env, signal, timeout: 120_000,
        });
        ensureProcessSucceeded(execution);
        const parsed = parseCodexEvents(execution.stdout);
        threadId ??= parsed.threadId;
        if (parsed.threadId !== threadId) throw new Error("Codex resumed a different conversation");
        const material = proxy.finishTurn();
        pending = false;
        const eventCalls = parsed.toolEvents.map(({ tool, arguments: args }) => ({ name: tool, arguments: args }));
        if (JSON.stringify(eventCalls) !== JSON.stringify(material.calls)) throw Object.assign(
          new Error("Codex tool evidence did not match the guarded MCP proxy"),
          { codexToolEvents: parsed.toolEvents, eventToolCalls: parsed.toolCalls,
            forwardedToolCalls: material.calls.length },
        );
        const model = await codexSessionModel(home, threadId);
        const auxiliaryCount = Object.values(parsed.auxiliaryDiscovery).reduce((sum, count) => sum + count, 0);
        return { ...parsed, ...material, models: [model], turnCount: 1,
          providerTurnCount: material.calls.length + auxiliaryCount + 1,
          providerToolCount: material.calls.length + auxiliaryCount };
      } finally {
        try { if (pending) proxy.finishTurn(); } catch {}
        pending = false;
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      await proxy.close();
      await rm(home, { recursive: true });
    },
  });
}

async function runOpenAiJudge(prompt, directory, signal) {
  const home = await prepareCodexHome(directory);
  const schema = join(directory, "judge-schema.json");
  await writeFile(schema, JSON.stringify({ type: "object", properties: {
    pass: { type: "boolean" }, score: { type: "integer", enum: [0, 1] }, reason: { type: "string" },
  }, required: ["pass", "score", "reason"], additionalProperties: false }), { mode: 0o600 });
  try {
    await verifyCodexLogin(home, directory);
    const invocation = codexInvocation({ directory, home, prompt, schema });
    const execution = await runProcess(invocation.command, invocation.args, {
      cwd: directory, env: invocation.env, signal, timeout: 120_000,
    });
    ensureProcessSucceeded(execution);
    const parsed = parseCodexEvents(execution.stdout);
    if (parsed.toolCalls !== 0) throw new Error("Codex judge used a forbidden tool");
    return { answer: parsed.answer, models: [openAiModel], turnCount: 1, providerTurnCount: 1, providerToolCount: 0 };
  } finally {
    await rm(home, { recursive: true });
    await rm(schema);
  }
}

export function codexInvocation({ context, directory, home, prompt, proxyUrl, schema, threadId, token, tools = [] }) {
  if (Buffer.byteLength(prompt) > 1_048_576 || Buffer.byteLength(context ?? "") > 1_048_576) {
    throw new Error("Codex input exceeded its limit");
  }
  const disabled = ["apps", "browser_use", "computer_use", "hooks", "image_generation", "memories",
    "multi_agent", "multi_agent_v2", "plugins", "remote_plugin", "shell_tool", "skill_mcp_dependency_install",
    "skill_search", "standalone_web_search", "tool_suggest", "unified_exec", "workspace_dependencies"];
  const config = [
    "approval_policy='never'", "forced_login_method='chatgpt'", "model_reasoning_effort='low'",
    "sandbox_mode='read-only'", "web_search='disabled'", "tools.web_search=false", "history.persistence='none'",
    ...(context ? [`developer_instructions=${JSON.stringify(context)}`] : []),
    ...(proxyUrl ? [
      `mcp_servers.${mcpServerName}.url=${JSON.stringify(proxyUrl)}`,
      `mcp_servers.${mcpServerName}.required=true`,
      `mcp_servers.${mcpServerName}.bearer_token_env_var='EMSEEPEA_CODEX_MCP_TOKEN'`,
      `mcp_servers.${mcpServerName}.default_tools_approval_mode='approve'`,
      `mcp_servers.${mcpServerName}.enabled_tools=${JSON.stringify(tools.map(({ name }) => name))}`,
    ] : []),
  ];
  const common = ["--strict-config", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check",
    "--json", "--model", openAiModel, ...disabled.flatMap((feature) => ["--disable", feature]),
    ...config.flatMap((value) => ["--config", value]), ...(schema ? ["--ephemeral", "--output-schema", schema] : [])];
  return {
    command: process.env.NODE_TEST_CONTEXT && process.env.EMSEEPEA_CODEX_COMMAND || "codex",
    args: threadId ? ["exec", "resume", ...common, threadId, prompt]
      : ["exec", ...common, "--sandbox", "read-only", "--cd", directory, prompt],
    cwd: directory,
    env: modelEnvironment({ CODEX_HOME: home, HOME: directory, ...(token ? { EMSEEPEA_CODEX_MCP_TOKEN: token } : {}) }),
  };
}

export function parseCodexEvents(stdout) {
  let events;
  try { events = stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }
  catch { throw new Error("Codex returned invalid event data"); }
  const allowed = new Set(["thread.started", "turn.started", "item.started", "item.updated", "item.completed",
    "turn.completed", "turn.failed", "error"]);
  if (events.some(({ type }) => !allowed.has(type))) throw new Error("Codex returned a forbidden event");
  const thread = events.find(({ type }) => type === "thread.started");
  const completed = events.findLast(({ type }) => type === "turn.completed");
  if (!thread?.thread_id || !completed) throw new Error("Codex omitted completion evidence");
  if (events.some(({ type }) => type === "error" || type === "turn.failed")) throw new Error("Codex reported an error");
  const items = events.filter(({ type }) => type.startsWith("item.")).map(({ item }) => item);
  const forbidden = items.find(({ type }) => !["agent_message", "reasoning", "mcp_tool_call"].includes(type));
  if (forbidden) throw Object.assign(new Error("Codex used a forbidden capability"), { capability: forbidden.type });
  const answers = events.filter(({ type, item }) => type === "item.completed" && item?.type === "agent_message")
    .map(({ item }) => item.text);
  const calls = events.filter(({ type, item }) => type === "item.completed" && item?.type === "mcp_tool_call");
  if (calls.some(({ item }) => item.status !== "completed" || item.error)) throw new Error("Codex MCP tool call failed");
  const targetCalls = calls.filter(({ item }) => item.server === mcpServerName);
  const auxiliary = calls.filter(({ item }) => item.server !== mcpServerName).map(({ item }) => auxiliaryDiscovery(item));
  const auxiliaryDiscoveryCounts = { resourceTemplates: 0, resources: 0 };
  for (const type of auxiliary) {
    auxiliaryDiscoveryCounts[type] += 1;
    if (auxiliaryDiscoveryCounts[type] > 1) throw new Error("Codex repeated auxiliary MCP discovery");
  }
  if (!answers.length || typeof answers.at(-1) !== "string") throw new Error("Codex returned no answer");
  const result = { answer: answers.at(-1), auxiliaryDiscovery: auxiliaryDiscoveryCounts,
    threadId: thread.thread_id, toolCalls: targetCalls.length };
  Object.defineProperty(result, "toolEvents", { value: targetCalls.map(({ item }) => item) });
  return result;
}

function auxiliaryDiscovery(item) {
  if (item.server !== "codex" || JSON.stringify(item.arguments) !== "{}") {
    throw new Error("Codex used a non-target MCP tool");
  }
  const contracts = {
    list_mcp_resources: ["resources", '{"resources":[]}'],
    list_mcp_resource_templates: ["resourceTemplates", '{"resourceTemplates":[]}'],
  };
  const contract = contracts[item.tool];
  if (!contract || JSON.stringify(item.result) !== JSON.stringify({
    content: [{ type: "text", text: contract[1] }], structured_content: null,
  })) throw new Error("Codex auxiliary MCP discovery changed");
  return contract[0];
}

async function prepareCodexHome(directory) {
  const source = join(process.env.CODEX_HOME ?? join(process.env.HOME ?? "", ".codex"), "auth.json");
  const home = join(directory, "codex-home");
  await mkdir(home, { mode: 0o700 });
  try { await copyFile(source, join(home, "auth.json")); }
  catch { throw new Error("Codex ChatGPT authentication is unavailable"); }
  await chmod(join(home, "auth.json"), 0o600);
  return home;
}

async function verifyCodexLogin(home, directory) {
  const result = await runProcess("codex", ["login", "status"], {
    cwd: directory, env: modelEnvironment({ CODEX_HOME: home, HOME: directory }), timeout: 15_000,
  });
  if (result.code !== 0 || !/logged in using chatgpt/i.test(result.stderr)) throw new Error("Codex CLI is not logged in with ChatGPT");
}

async function codexSessionModel(home, threadId) {
  const files = await recursiveFiles(home);
  for (const file of files.filter((name) => name.endsWith(".jsonl"))) {
    const text = await readFile(file, "utf8");
    if (Buffer.byteLength(text) > 1_048_576) throw new Error("Codex session evidence exceeded its limit");
    const events = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const session = events.find(({ type, payload }) => type === "session_meta" && payload?.id === threadId);
    if (!session) continue;
    const models = events.filter(({ type }) => type === "turn_context").map(({ payload }) => payload?.model);
    if (session.payload.model_provider !== "openai" || !models.length || models.some((model) => model !== openAiModel)) {
      throw new Error("Codex did not use the required OpenAI model");
    }
    return openAiModel;
  }
  throw new Error("Codex omitted model identity evidence");
}

async function recursiveFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await recursiveFiles(path));
    else files.push(path);
  }
  return files;
}

function ensureProcessSucceeded(execution) {
  if (execution.timedOut) throw new Error("Model command timed out");
  if (execution.outputLimitExceeded) throw new Error("Model command output exceeded its limit");
  if (execution.errorCode === "ABORT_ERR") throw new Error("Model command was cancelled");
  if (execution.errorCode) throw new Error("Model command could not start");
  if (execution.code !== 0) throw new Error(`Model command exited ${execution.code}`);
}

function runProcess(command, args, options) {
  return new Promise((resolve) => {
    const { timeout = 180_000, signal, ...spawnOptions } = options;
    signal?.throwIfAborted();
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32", ...spawnOptions,
    });
    let stdout = "";
    let stderr = "";
    let stderrLength = 0;
    let aborted = false;
    let timedOut = false;
    let outputLimitExceeded = false;
    const kill = () => {
      try {
        if (process.platform === "win32" || !child.pid) child.kill("SIGKILL");
        else process.kill(-child.pid, "SIGKILL");
      } catch (error) { if (error.code !== "ESRCH") child.kill("SIGKILL"); }
    };
    const timer = setTimeout(() => { timedOut = true; kill(); }, timeout);
    timer.unref();
    const abort = () => { aborted = true; kill(); };
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 1_048_576) {
        outputLimitExceeded = true;
        kill();
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      stderrLength += chunk.length;
      if (stderrLength > 1_048_576) { outputLimitExceeded = true; kill(); }
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve({ code: 1, errorCode: error.code, outputLimitExceeded, stderr, stdout, timedOut });
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve({ code: code ?? 1, errorCode: aborted ? "ABORT_ERR" : undefined,
        outputLimitExceeded, stderr, stdout, timedOut });
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
