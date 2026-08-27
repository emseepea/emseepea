import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const mcpServerName = "emseepea_eval";
const copilotModel = "claude-sonnet-4.6";
const providerTimeoutMs = 120_000;
const copilotCreditCap = 30;
const counters = new Map();
const sha256 = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const examples = {
  "basic-no-ui": {
    script: "examples/basic-no-ui/dist/server.js",
    tool: "get-bean-details",
    arguments: { name: "Highland Bloom" },
  },
  "backend-no-ui": {
    script: "examples/backend-no-ui/dist/server.js",
    tool: "create-bean-report",
    arguments: { roast: "dark" },
  },
  "resources-prompts": {
    script: "examples/resources-prompts/dist/server.js",
    async material(url) {
      const client = new Client(
        { name: "emseepea-semantic-eval", version: "0.0.0" },
        { versionNegotiation: { mode: { pin: "2026-07-28" } } },
      );
      await client.connect(new StreamableHTTPClientTransport(new URL(url)));
      try {
        const resourceRequest = { method: "resources/read", uri: "guide://coffee/getting-started" };
        const promptRequest = {
          method: "prompts/get",
          name: "brew-guide",
          arguments: { topic: "brew-ratio" },
        };
        const resource = await client.readResource({ uri: resourceRequest.uri });
        const prompt = await client.getPrompt({
          name: promptRequest.name,
          arguments: promptRequest.arguments,
        });
        return {
          text: [
            "The following material was retrieved through the official MCP client.",
            "Resource contents:",
            String(resource.contents[0]?.text ?? ""),
            "Rendered prompt:",
            String(prompt.messages[0]?.content?.text ?? ""),
          ].join("\n\n"),
          pathEvidence: [
            {
              server: mcpServerName,
              method: resourceRequest.method,
              target: resourceRequest.uri,
              requestSha256: sha256(resourceRequest),
              responseSha256: sha256(resource),
            },
            {
              server: mcpServerName,
              method: promptRequest.method,
              target: promptRequest.name,
              requestSha256: sha256(promptRequest),
              responseSha256: sha256(prompt),
            },
          ],
        };
      } finally {
        await client.close();
      }
    },
  },
  "streaming-progress": {
    script: "examples/streaming-progress/dist/server.js",
    tool: "roast-sample-batch",
    arguments: { batch: "sample-batch" },
  },
};

async function toolMaterial(url, definition) {
  const client = new Client(
    { name: "emseepea-semantic-eval", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  const progress = [];
  try {
    const result = await client.callTool(
      { name: definition.tool, arguments: definition.arguments },
      { onprogress: (update) => progress.push(update) },
    );
    if (result.isError) throw new Error(`${definition.tool} returned a tool error`);
    const request = { method: "tools/call", name: definition.tool, arguments: definition.arguments };
    const response = { progress, result };
    const requestSha256 = sha256(request);
    const responseSha256 = sha256(response);
    return {
      text: [
        "The following material was retrieved through the official MCP client.",
        `Operation: ${JSON.stringify(request)}`,
        `Progress notifications: ${JSON.stringify(progress)}`,
        `Final result: ${JSON.stringify(result)}`,
      ].join("\n\n"),
      pathEvidence: [{
        server: mcpServerName,
        method: "tools/call",
        target: definition.tool,
        requestSha256,
        responseSha256,
      }],
    };
  } finally {
    await client.close();
  }
}

function nextTrial(example, role) {
  const key = `${example}:${role}`;
  const trial = (counters.get(key) ?? 0) + 1;
  counters.set(key, trial);
  return trial;
}

function childEnvironment(extra = {}) {
  return {
    CI: "true",
    HOME: process.env.HOME,
    LANG: process.env.LANG ?? "C.UTF-8",
    LOGNAME: process.env.LOGNAME,
    NO_COLOR: "1",
    PATH: process.env.PATH,
    SHELL: process.env.SHELL,
    TMPDIR: process.env.TMPDIR,
    USER: process.env.USER,
    ...extra,
  };
}

function runProcess(command, args, options = {}) {
  const { timeoutMs = providerTimeoutMs, ...spawnOptions } = options;
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...spawnOptions,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      resolveRun({ code: 1, error: error.message, stderr, stdout, timedOut });
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolveRun({ code: code ?? 1, stderr, stdout, timedOut });
    });
  });
}

async function startExample(example) {
  const definition = examples[example];
  if (!definition) throw new Error(`unknown example: ${example}`);
  const child = spawn(process.execPath, [resolve(repoRoot, definition.script)], {
    cwd: repoRoot,
    env: childEnvironment({ NODE_ENV: "test", PORT: "0" }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let errors = "";
  child.stdout.on("data", (chunk) => {
    output = `${output}${chunk}`.slice(-16_384);
  });
  child.stderr.on("data", (chunk) => {
    errors = `${errors}${chunk}`.slice(-16_384);
  });
  try {
    const url = await new Promise((resolveUrl, rejectUrl) => {
      const timer = setTimeout(() => rejectUrl(new Error("example startup timed out")), 10_000);
      const inspect = () => {
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/mcp/);
        if (match) {
          clearTimeout(timer);
          resolveUrl(match[0]);
        }
      };
      child.stdout.on("data", inspect);
      child.once("error", (error) => {
        clearTimeout(timer);
        rejectUrl(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        rejectUrl(new Error(`example exited ${code}: ${errors.slice(0, 500)}`));
      });
      inspect();
    });
    return { child, url };
  } catch (error) {
    await stopExample(child);
    throw error;
  }
}

async function stopExample(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveClose) => child.once("close", resolveClose)),
    new Promise((resolveWait) => setTimeout(resolveWait, 3_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function parseJsonLines(stdout) {
  return stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

export function parseCopilotEvents(stdout, processExitCode = 0) {
  const events = parseJsonLines(stdout);
  const errors = events.filter(({ type }) => type === "session.error");
  const mcpWarnings = events.filter(({ type, data }) => (
    type === "session.warning" && data?.warningType === "mcp"
  ));
  const result = events.findLast(({ type }) => type === "result");
  const models = events
    .filter(({ type }) => type === "model.call_start" || type === "assistant.usage")
    .map(({ data }) => data?.model)
    .filter(Boolean);
  const toolEvents = events.filter(({ type }) => type === "tool.execution_start");
  const forbiddenEvents = events.filter(({ type }) => [
    "skill.invoked",
    "subagent.started",
    "subagent.selected",
    "user_input.requested",
  ].includes(type));
  const loadedServers = events
    .filter(({ type }) => type === "session.mcp_servers_loaded")
    .flatMap(({ data }) => data?.servers ?? [])
    .map((server) => typeof server === "string" ? server : server?.name ?? server?.serverName)
    .filter(Boolean);
  const answer = events
    .filter(({ type, data }) => type === "assistant.message" && typeof data?.content === "string")
    .map(({ data }) => data.content)
    .filter(Boolean)
    .at(-1);
  if (mcpWarnings.length > 0) throw new Error(`Copilot MCP failed: ${mcpWarnings[0].data?.message ?? "unknown"}`);
  if (errors.length > 0) throw new Error(`Copilot session failed: ${errors[0].data?.errorType ?? "unknown"}`);
  if (processExitCode !== 0) throw new Error(
    `Copilot process exited ${processExitCode}${result ? "" : " without a result"}`,
  );
  if (!result) throw new Error(
    "Copilot exited without a result",
  );
  if (result.exitCode !== 0) throw new Error(`Copilot exited ${result.exitCode}`);
  if (!answer) throw new Error("Copilot emitted no final answer");
  if (models.length === 0 || models.some((model) => model !== copilotModel)) {
    throw new Error(`Copilot effective model was ${models.join(", ") || "unreported"}`);
  }
  if (forbiddenEvents.length > 0) throw new Error(`Copilot emitted forbidden event ${forbiddenEvents[0].type}`);
  if (loadedServers.length > 0) {
    throw new Error(`Copilot loaded MCP servers ${loadedServers.join(", ") || "none"}`);
  }
  if (toolEvents.length > 0) throw new Error("Copilot used a tool");
  return {
    answer,
    model: copilotModel,
    pathEvidence: [],
    toolCallCount: 0,
    turnCount: events.filter(({ type }) => type === "assistant.turn_start").length,
  };
}

export function parseClaudeEvents(stdout) {
  const events = parseJsonLines(stdout);
  const result = events.findLast(({ type }) => type === "result");
  const allToolUses = events.flatMap(({ message }) => (
    Array.isArray(message?.content)
      ? message.content.filter(({ type }) => type === "tool_use")
      : []
  ));
  if (result?.is_error || typeof result?.result !== "string") {
    throw new Error(
      `Claude failed: ${result?.subtype ?? "no result"}; is_error=${String(result?.is_error)}; result=${typeof result?.result}`,
    );
  }
  if (allToolUses.length > 0) throw new Error(`Claude used forbidden tool ${allToolUses[0].name}`);
  return {
    answer: result.result,
    model: result.modelUsage ? Object.keys(result.modelUsage)[0] ?? "claude-advisory" : "claude-advisory",
    pathEvidence: [],
    toolCallCount: 0,
    turnCount: events.filter(({ type }) => type === "assistant").length,
  };
}

async function runCopilot(prompt, neutralDirectory) {
  const tokenFile = process.env.EMSEEPEA_COPILOT_TOKEN_FILE;
  if (!tokenFile) throw new Error("EMSEEPEA_COPILOT_TOKEN_FILE is required for authoritative evaluation");
  const token = (await readFile(tokenFile, "utf8")).trim();
  if (!token) throw new Error("Copilot credential file is empty");
  const args = [
    "-C", neutralDirectory,
    "-p", prompt,
    "--model", copilotModel,
    "--effort", "low",
    "--max-ai-credits", String(copilotCreditCap),
    "--no-ask-user",
    "--no-custom-instructions",
    "--disable-builtin-mcps",
    "--disallow-temp-dir",
    "--no-auto-update",
    "--no-experimental",
    "--no-remote",
    "--no-remote-export",
    "--no-color",
    "--log-level", "none",
    "--output-format", "json",
    "--silent",
  ];
  args.push("--available-tools", "");
  const execution = await runProcess(resolve(repoRoot, "node_modules/.bin/copilot"), args, {
    cwd: neutralDirectory,
    env: childEnvironment({
      COPILOT_HOME: join(neutralDirectory, "copilot-home"),
      GITHUB_TOKEN: token,
    }),
  });
  if (execution.timedOut) throw new Error("Copilot provider timed out");
  if (execution.code !== 0 && !execution.stdout) throw new Error(`Copilot exited ${execution.code}`);
  return parseCopilotEvents(execution.stdout, execution.code);
}

async function runClaude(prompt, neutralDirectory) {
  const args = [
    "--print", prompt,
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-session-persistence",
    "--permission-mode", "dontAsk",
    "--model", "sonnet",
    "--effort", "low",
    "--max-budget-usd", "0.50",
    "--output-format", "stream-json",
    "--verbose",
    "--setting-sources", "",
    "--tools", "",
  ];
  args.push("--safe-mode");
  const execution = await runProcess("claude", args, {
    cwd: neutralDirectory,
    env: childEnvironment(),
  });
  if (execution.timedOut) throw new Error("Claude provider timed out");
  if (execution.code !== 0 && !execution.stdout) throw new Error(`Claude exited ${execution.code}`);
  return parseClaudeEvents(execution.stdout);
}

export function parseJudgeVerdict(output) {
  const verdict = JSON.parse(output);
  const keys = verdict && typeof verdict === "object" && !Array.isArray(verdict)
    ? Object.keys(verdict).sort()
    : [];
  if (
    keys.join(",") !== "pass,reason,score"
    || !(
      (verdict.pass === true && verdict.score === 1)
      || (verdict.pass === false && verdict.score === 0)
    )
    || typeof verdict.reason !== "string"
    || verdict.reason.trim() === ""
  ) {
    throw new Error("judge returned an invalid verdict");
  }
  return verdict;
}

async function recordEvidence(record) {
  const path = process.env.EMSEEPEA_EVAL_PROVIDER_EVIDENCE;
  if (!path) return;
  await appendFile(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
}

export default class SemanticProvider {
  constructor(options = {}) {
    this.role = options.config?.role ?? "agent";
    this.provider = process.env.EMSEEPEA_EVAL_PROVIDER ?? "claude";
  }

  id() {
    return `${this.provider}-${this.role}`;
  }

  async callApi(prompt, context = {}) {
    const promptExample = prompt.match(/Example under test:\s*([a-z0-9-]+)/i)?.[1];
    const example = this.role === "judge"
      ? String(context.vars?.example ?? promptExample ?? "judge")
      : context.vars?.example;
    const trial = nextTrial(example, this.role);
    const neutralDirectory = await mkdtemp(join(tmpdir(), `emseepea-${this.role}-`));
    let running;
    try {
      let effectivePrompt = prompt;
      let pathEvidence = [];
      let materialSha256;
      if (this.role === "agent") {
        running = await startExample(example);
        const definition = examples[example];
        const material = definition.material
          ? await definition.material(running.url)
          : await toolMaterial(running.url, definition);
        effectivePrompt = `${material.text}\n\nAnswer only from that MCP material.\n\nQuestion:\n${prompt}`;
        pathEvidence = material.pathEvidence;
        materialSha256 = createHash("sha256").update(material.text).digest("hex");
      }
      const result = this.provider === "copilot"
        ? await runCopilot(effectivePrompt, neutralDirectory)
        : await runClaude(effectivePrompt, neutralDirectory);
      const combinedEvidence = [...pathEvidence, ...result.pathEvidence];
      let output = result.answer;
      if (this.role === "judge") output = output.trim();
      const metadata = {
        example,
        model: result.model,
        materialSha256,
        pathEvidence: combinedEvidence,
        provider: this.provider,
        role: this.role,
        toolCallCount: result.toolCallCount,
        transportRetries: null,
        transportRetryPolicy: "Promptfoo retries disabled; provider-internal retries unobservable and bounded by timeout",
        trial,
        turnCount: result.turnCount,
      };
      const verdict = this.role === "judge" ? parseJudgeVerdict(output) : undefined;
      await recordEvidence({ ...metadata, status: "completed", verdict });
      return { output, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordEvidence({ example, provider: this.provider, role: this.role, status: "error", trial, error: message });
      return { error: message };
    } finally {
      if (running) await stopExample(running.child);
      await rm(neutralDirectory, { force: true, recursive: true });
    }
  }
}
