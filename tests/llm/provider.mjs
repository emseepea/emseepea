import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const mcpServerName = "emseepea_eval";
const claudeModel = "claude-sonnet-4-6";
const providerTimeoutMs = 120_000;
const counters = new Map();
const sha256 = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const examples = {
  "basic-no-ui": {
    script: "examples/basic-no-ui/dist/server.js",
    tool: "get-bean-details",
    arguments: { name: "Highland Bloom" },
  },
  "backend-no-ui": {
    script: "tests/llm/fixtures/backend-no-ui.mjs",
    tool: "search-coffee-catalog",
    arguments: { query: "natural" },
  },
  "multi-instance": {
    script: "examples/multi-instance/dist/server.js",
    tool: "create-shared-bean-report",
    arguments: { requestId: "daily-roast-report" },
    environment: { EMSEEPEA_INSTANCE: "eval-instance" },
  },
  "native-ui": {
    script: "examples/native-ui/dist/server.js",
    tool: "preview-bean-report",
    arguments: { title: "Dark roast preview", roast: "dark", includeNotes: true },
  },
  "protected-no-ui": {
    script: "examples/protected-no-ui/dist/server.js",
    tool: "get-private-inventory-report",
    arguments: {},
    token: "example-access-token",
  },
  "react-tailwind-ui": {
    script: "examples/react-tailwind-ui/dist/server.js",
    tool: "preview-bean-report",
    arguments: { title: "Dark roast preview", roast: "dark", includeNotes: true },
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
  await client.connect(new StreamableHTTPClientTransport(
    new URL(url),
    definition.token
      ? { authProvider: { token: async () => definition.token } }
      : undefined,
  ));
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

export function exampleEnvironment(extra = {}) {
  return childEnvironment(extra);
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
    env: exampleEnvironment({ NODE_ENV: "test", PORT: "0", ...definition.environment }),
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

export function parseClaudeEvents(stdout, processExitCode = 0) {
  const events = parseJsonLines(stdout);
  const result = events.findLast(({ type }) => type === "result");
  const notLoggedIn = events.some(({ message }) => (
    Array.isArray(message?.content)
    && message.content.some(({ type, text }) => type === "text" && /not logged in/i.test(text ?? ""))
  ));
  const allToolUses = events.flatMap(({ message }) => (
    Array.isArray(message?.content)
      ? message.content.filter(({ type }) => type === "tool_use")
      : []
  ));
  if (notLoggedIn) throw new Error("Claude CLI is not signed in");
  if (processExitCode !== 0) throw new Error(`Claude exited ${processExitCode}`);
  if (result?.is_error || typeof result?.result !== "string") {
    throw new Error(
      `Claude failed: ${result?.subtype ?? "no result"}; is_error=${String(result?.is_error)}; result=${typeof result?.result}`,
    );
  }
  if (allToolUses.length > 0) throw new Error(`Claude used forbidden tool ${allToolUses[0].name}`);
  if (result.num_turns !== 1) throw new Error(`Claude used ${String(result.num_turns)} turns`);
  if ((result.permission_denials?.length ?? 0) > 0) throw new Error("Claude attempted a forbidden action");
  const mainModel = result.modelUsage?.[claudeModel];
  if (mainModel?.canonicalModel !== claudeModel || mainModel.provider !== "firstParty") {
    throw new Error("Claude did not use the required model");
  }
  return {
    answer: result.result,
    model: claudeModel,
    models: Object.keys(result.modelUsage),
    pathEvidence: [],
    toolCallCount: 0,
    turnCount: result.num_turns,
  };
}

export function claudeInvocation(provider, prompt, neutralDirectory) {
  const token = provider === "claude-ci" ? process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim() : undefined;
  if (provider === "claude-ci" && !token) throw new Error("Claude subscription authentication is unavailable");
  const localHome = provider === "claude-local" ? process.env.HOME : undefined;
  if (provider === "claude-local" && !localHome?.startsWith("/")) {
    throw new Error("local Claude evaluation requires an absolute HOME for the signed-in CLI account");
  }
  const args = [
    "--print", prompt,
    "--model", claudeModel,
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
  ];
  return {
    command: resolve(repoRoot, "node_modules/.bin/claude"),
    args,
    cwd: neutralDirectory,
    env: childEnvironment(provider === "claude-ci"
      ? {
          CLAUDE_CONFIG_DIR: join(neutralDirectory, "claude-config"),
          HOME: neutralDirectory,
          CLAUDE_CODE_OAUTH_TOKEN: token,
        }
      : { HOME: localHome }),
  };
}

async function runClaude(provider, prompt, neutralDirectory) {
  const invocation = claudeInvocation(provider, prompt, neutralDirectory);
  const execution = await runProcess(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    env: invocation.env,
  });
  if (execution.timedOut) throw new Error("Claude provider timed out");
  if (execution.code !== 0 && !execution.stdout) throw new Error(`Claude exited ${execution.code}`);
  return parseClaudeEvents(execution.stdout, execution.code);
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
    this.provider = process.env.EMSEEPEA_EVAL_PROVIDER ?? "claude-local";
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
      const result = await runClaude(this.provider, effectivePrompt, neutralDirectory);
      const combinedEvidence = [...pathEvidence, ...result.pathEvidence];
      let output = result.answer;
      if (this.role === "judge") output = output.trim();
      const metadata = {
        example,
        model: result.model,
        models: result.models,
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
