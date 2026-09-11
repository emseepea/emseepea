import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { McpServer, createMcpHandler, fromJsonSchema } from "@modelcontextprotocol/server";
import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from "@modelcontextprotocol/node";

const sha256 = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function startSemanticServer(testCase, signal) {
  signal?.throwIfAborted();
  const child = spawn(process.execPath, [testCase.server], {
    cwd: testCase.directory,
    env: serverEnvironment(testCase.environment),
    stdio: ["ignore", "pipe", "pipe"],
    signal,
    killSignal: "SIGKILL",
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output = `${output}${chunk}`.slice(-16_384); });
  child.stderr.resume();
  // Abort after startup still emits an error event from spawn's signal handler.
  child.on("error", () => {});
  try {
    const url = await new Promise((resolve, reject) => {
      const finish = (error, value) => {
        clearTimeout(timer);
        child.stdout.off("data", inspect);
        child.off("error", failed);
        child.off("exit", exited);
        if (error) reject(error);
        else resolve(value);
      };
      const inspect = () => {
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/mcp/);
        if (match?.[0]) finish(undefined, match[0]);
      };
      const failed = () => finish(new Error("MCP server did not start"));
      const exited = () => finish(new Error("MCP server stopped during startup"));
      const timer = setTimeout(() => finish(new Error("MCP server startup timed out")), 15_000);
      child.stdout.on("data", inspect);
      child.once("error", failed);
      child.once("exit", exited);
      inspect();
    });
    return { child, url };
  } catch (error) {
    await stopSemanticServer(child);
    throw error;
  }
}

export async function stopSemanticServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish(); }, 3_000);
    const finish = () => { clearTimeout(timer); child.off("close", finish); resolve(); };
    child.once("close", finish);
    child.kill("SIGTERM");
  });
}

export async function collectMcpMaterial(url, testCase, signal) {
  signal?.throwIfAborted();
  const client = await openClient(url, testCase);
  const evidence = [];
  const material = [];
  const pending = [];
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => { void client.close().catch(() => {}); reject(new Error("Semantic test cancelled")); };
    signal?.addEventListener("abort", abort, { once: true });
  });
  try {
    signal?.throwIfAborted();
    const invoke = (operation) => {
      const call = (async () => {
        const request = requestFor(operation);
        const response = await perform(client, operation);
        evidence.push({
          method: operation.method,
          target: operation.name ?? operation.uri,
          requestSha256: sha256(request),
          responseSha256: sha256(response),
        });
        material.push(`Operation: ${JSON.stringify(request)}\nResult: ${JSON.stringify(response)}`);
        return operation.method === "tools/call" ? response.result : response;
      })();
      // Observe early failures even if the callback awaits another operation first.
      void call.catch(() => {});
      pending.push(call);
      return call;
    };
    await Promise.race([testCase.exercise(Object.freeze({
      callTool: (params) => invoke({ ...params, method: "tools/call" }),
      readResource: (params) => invoke({ ...params, method: "resources/read" }),
      getPrompt: (params) => invoke({ ...params, method: "prompts/get" }),
    })), cancelled]);
    await Promise.all(pending);
  } finally {
    signal?.removeEventListener("abort", abort);
    await Promise.allSettled(pending);
    await client.close();
  }
  return {
    pathEvidence: evidence,
    text: ["The following material was retrieved through the official MCP client.", ...material].join("\n\n"),
  };
}

export async function listMcpTools(url, testCase, signal) {
  signal?.throwIfAborted();
  const client = await openClient(url, testCase);
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => { void client.close().catch(() => {}); reject(new Error("Semantic test cancelled")); };
    signal?.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([advertisedTools(client), cancelled]);
  } finally {
    signal?.removeEventListener("abort", abort);
    await client.close();
  }
}

export async function openMcpToolSession(url, testCase, signal) {
  signal?.throwIfAborted();
  const client = await openClient(url, testCase);
  let tools;
  try {
    tools = await advertisedTools(client);
  } catch (error) {
    await client.close();
    throw error;
  }
  let closed = false;
  const abort = () => { void client.close().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  return Object.freeze({
    tools,
    async callTool(name, args, callSignal = signal) {
      callSignal?.throwIfAborted();
      const request = { method: "tools/call", name, arguments: args };
      const result = await client.callTool({ name, arguments: args }, { signal: callSignal });
      return {
        content: result.content,
        isError: result.isError === true,
        pathEvidence: {
          method: "tools/call",
          target: name,
          requestSha256: sha256(request),
          responseSha256: sha256(result.content),
        },
      };
    },
    async close() {
      if (closed) return;
      closed = true;
      signal?.removeEventListener("abort", abort);
      await client.close();
    },
  });
}

export async function startGuardedMcpProxy(mcpSession, token, signal) {
  const tools = new Map(mcpSession.tools.map((tool) => [tool.name, tool]));
  let turn;
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: "emseepea-eval-proxy", version: "0.0.0" });
    for (const tool of tools.values()) {
      server.registerTool(tool.name, {
        description: tool.description,
        inputSchema: fromJsonSchema(tool.inputSchema),
      }, async (args) => {
        if (!turn) throw new Error("No semantic evaluation turn is active");
        const call = { name: tool.name, arguments: args };
        if (Buffer.byteLength(JSON.stringify(args)) > 1_048_576) throw new Error("MCP tool arguments exceeded their limit");
        const signature = JSON.stringify({ name: tool.name, arguments: canonical(args) });
        if (turn.seen.has(signature)) throw new Error("Repeated MCP tool call");
        if (turn.calls.length >= 3) throw new Error("MCP tool-call limit exceeded");
        turn.seen.add(signature);
        const result = await mcpSession.callTool(tool.name, args, signal);
        const serialized = JSON.stringify(result);
        if (Buffer.byteLength(serialized) > 1_048_576) throw new Error("MCP tool result exceeded its limit");
        turn.calls.push(call);
        turn.toolResults.push({ content: result.content, isError: result.isError });
        turn.pathEvidence.push(result.pathEvidence);
        return { content: result.content, isError: result.isError };
      });
    }
    return server;
  });
  const serve = toNodeHandler(handler);
  const validHost = localhostHostValidation();
  const validOrigin = localhostOriginValidation();
  const http = createServer((request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401).end();
      return;
    }
    if (!validHost(request, response) || !validOrigin(request, response)) return;
    void serve(request, response);
  });
  await new Promise((resolve, reject) => {
    http.once("error", reject);
    http.listen(0, "127.0.0.1", resolve);
  });
  const address = http.address();
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    try { await handler.close(); }
    finally { await new Promise((resolve) => http.close(resolve)); }
  };
  const abort = () => { void close(); };
  signal?.addEventListener("abort", abort, { once: true });
  return Object.freeze({
    url: `http://127.0.0.1:${address.port}/mcp`,
    beginTurn() {
      if (turn) throw new Error("An MCP proxy turn is already active");
      turn = { calls: [], pathEvidence: [], seen: new Set(), toolResults: [] };
    },
    finishTurn() {
      if (!turn) throw new Error("No MCP proxy turn is active");
      const result = turn;
      turn = undefined;
      return { calls: result.calls, pathEvidence: result.pathEvidence, toolResults: result.toolResults };
    },
    async close() {
      signal?.removeEventListener("abort", abort);
      await close();
    },
  });
}

function requestFor(operation) {
  if (operation.method === "tools/call") {
    return { method: operation.method, name: operation.name, arguments: operation.arguments ?? {} };
  }
  if (operation.method === "resources/read") return { method: operation.method, uri: operation.uri };
  return { method: operation.method, name: operation.name, arguments: operation.arguments ?? {} };
}

async function perform(client, operation) {
  if (operation.method === "tools/call") {
    const progress = [];
    const result = await client.callTool(
      { name: operation.name, arguments: operation.arguments ?? {} },
      { onprogress: (update) => progress.push(update) },
    );
    if (result.isError) throw new Error("MCP tool returned an error");
    return { progress, result };
  }
  if (operation.method === "resources/read") return client.readResource({ uri: operation.uri });
  return client.getPrompt({ name: operation.name, arguments: operation.arguments ?? {} });
}

async function openClient(url, testCase) {
  const token = semanticAuthToken(testCase);
  const client = new Client(
    { name: "emseepea-semantic-test", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(new StreamableHTTPClientTransport(
    new URL(url),
    token ? { authProvider: { token: async () => token } } : undefined,
  ));
  return client;
}

async function advertisedTools(client) {
  const response = await client.listTools();
  const tools = response.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  tools.sort((left, right) => left.name.localeCompare(right.name));
  if (new Set(tools.map(({ name }) => name)).size !== tools.length) {
    throw new Error("MCP server advertised duplicate tool names");
  }
  return tools;
}

export function semanticAuthToken(testCase) {
  const token = testCase.authToken ?? (testCase.authTokenEnvironment
    ? process.env[testCase.authTokenEnvironment]?.trim()
    : undefined);
  if (testCase.authTokenEnvironment && !token) {
    throw new Error(`Required authentication is unavailable: ${testCase.authTokenEnvironment}`);
  }
  return token;
}

function serverEnvironment(extra = {}) {
  if (Object.keys(extra).some((key) => /^(CLAUDE|ANTHROPIC|OPENAI|CODEX|GITHUB|NODE_OPTIONS|NODE_PATH)/i.test(key))) {
    throw new Error("Provider credentials and runtime injection are not server environment options");
  }
  return Object.fromEntries(Object.entries({
    CI: "true",
    HOME: process.env.HOME,
    LANG: process.env.LANG ?? "C.UTF-8",
    LOGNAME: process.env.LOGNAME,
    NODE_ENV: "test",
    NO_COLOR: "1",
    PATH: process.env.PATH,
    PORT: "0",
    SHELL: process.env.SHELL,
    TMPDIR: process.env.TMPDIR,
    USER: process.env.USER,
    ...extra,
  }).filter(([, value]) => value !== undefined));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}
