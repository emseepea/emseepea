import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

export interface TestCleanup {
  after(cleanup: () => Promise<void>): void;
}

export interface StartMcpServerOptions {
  clientName?: string;
  environment?: NodeJS.ProcessEnv;
  startupTimeoutMs?: number;
  token?: string;
}

export interface RunningMcpServer {
  connect(token?: string): Promise<Client>;
  url: URL;
}

export async function startMcpServer(
  test: TestCleanup,
  serverUrl: URL,
  options: StartMcpServerOptions = {},
): Promise<RunningMcpServer> {
  const child = spawn(process.execPath, [fileURLToPath(serverUrl)], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "0",
      ...options.environment,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const clients: Client[] = [];
  let output = "";
  let errors = "";
  child.stdout.on("data", (chunk: Buffer) => { output = `${output}${chunk}`.slice(-16_384); });
  child.stderr.on("data", (chunk: Buffer) => { errors = `${errors}${chunk}`.slice(-16_384); });

  const url = await new Promise<URL>((resolve, reject) => {
    const finish = (error?: Error, value?: URL) => {
      clearTimeout(timer);
      child.stdout.off("data", inspect);
      child.off("error", failed);
      child.off("exit", exited);
      if (error) reject(error);
      else if (value) resolve(value);
    };
    const inspect = () => {
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/mcp/);
      if (match?.[0]) finish(undefined, new URL(match[0]));
    };
    const failed = (error: Error) => finish(error);
    const exited = (code: number | null) => finish(new Error(`MCP server exited ${String(code)}: ${errors}`));
    const timer = setTimeout(
      () => finish(new Error(`MCP server startup timed out: ${errors}`)),
      options.startupTimeoutMs ?? 15_000,
    );
    child.stdout.on("data", inspect);
    child.once("error", failed);
    child.once("exit", exited);
    inspect();
  }).catch(async (error: unknown) => {
    await stopProcess(child);
    throw error;
  });

  test.after(async () => {
    await Promise.allSettled(clients.map((client) => client.close()));
    await stopProcess(child);
  });

  return {
    url,
    async connect(token = options.token) {
      const client = new Client(
        { name: options.clientName ?? "emseepea-test", version: "0.0.0" },
        { versionNegotiation: { mode: { pin: "2026-07-28" } } },
      );
      await client.connect(new StreamableHTTPClientTransport(
        url,
        token ? { authProvider: { token: async () => token } } : undefined,
      ));
      clients.push(client);
      return client;
    },
  };
}

async function stopProcess(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("close", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
