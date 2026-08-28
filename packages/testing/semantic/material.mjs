import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const sha256 = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function startSemanticServer(testCase) {
  const child = spawn(process.execPath, [testCase.server], {
    cwd: testCase.directory,
    env: serverEnvironment(testCase.environment),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output = `${output}${chunk}`.slice(-16_384); });
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
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("close", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

export async function collectMcpMaterial(url, testCase) {
  const token = testCase.authToken ?? (testCase.authTokenEnvironment
    ? process.env[testCase.authTokenEnvironment]?.trim()
    : undefined);
  if (testCase.authTokenEnvironment && !token) {
    throw new Error(`Required authentication is unavailable: ${testCase.authTokenEnvironment}`);
  }
  const client = new Client(
    { name: "emseepea-semantic-test", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(new StreamableHTTPClientTransport(
    new URL(url),
    token ? { authProvider: { token: async () => token } } : undefined,
  ));
  const evidence = [];
  const material = [];
  try {
    for (const operation of testCase.operations) {
      const request = requestFor(operation);
      const response = await perform(client, operation);
      evidence.push({
        method: operation.method,
        target: operation.name ?? operation.uri,
        requestSha256: sha256(request),
        responseSha256: sha256(response),
      });
      material.push(`Operation: ${JSON.stringify(request)}\nResult: ${JSON.stringify(response)}`);
    }
  } finally {
    await client.close();
  }
  return {
    pathEvidence: evidence,
    text: ["The following material was retrieved through the official MCP client.", ...material].join("\n\n"),
  };
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

function serverEnvironment(extra = {}) {
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
