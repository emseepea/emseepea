import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { serveEmseepea, type AuthenticationOptions } from "@emseepea/server";

export {
  createMcpAppHostSimulator,
  type McpAppHostSimulator,
  type McpAppHostSimulatorOptions,
  type McpAppMessageRequest,
} from "./mcp-app-host.js";

export type SupportedProtocolVersion =
  | "2026-07-28"
  | "2025-11-25"
  | "2025-06-18"
  | "2025-03-26"
  | "2024-11-05"
  | "2024-10-07";

export interface TestCleanup {
  after(cleanup: () => Promise<void>): void;
}

export interface StartMcpServerOptions {
  clientName?: string;
  environment?: NodeJS.ProcessEnv;
  protocolVersion?: SupportedProtocolVersion;
  startupTimeoutMs?: number;
  token?: string;
}

export interface RunningMcpServer {
  connect(token?: string): Promise<Client>;
  output(): Readonly<{ stdout: string; stderr: string }>;
  url: URL;
}

/** Test-only verifier. Never use it in a deployed server. */
export function insecureTestAuthentication(
  permissions: readonly string[],
  discovery: "public" | "protected" = "protected",
): AuthenticationOptions {
  const resourceServerUrl = new URL("https://test.example/mcp");
  return {
    discovery,
    verifier: {
      async verifyAccessToken(token) {
        return {
          token,
          clientId: "emseepea-test-client",
          scopes: [...permissions],
          expiresAt: Math.floor(Date.now() / 1_000) + 60,
          resource: resourceServerUrl,
        };
      },
    },
    metadata: {
      resourceServerUrl,
      oauthMetadata: {
        issuer: "https://auth.test.example",
        authorization_endpoint: "https://auth.test.example/authorize",
        token_endpoint: "https://auth.test.example/token",
        response_types_supported: ["code"],
      },
    },
  };
}

export async function startEmseepea(
  test: TestCleanup,
  app: Parameters<typeof serveEmseepea>[0],
  options: Pick<StartMcpServerOptions, "clientName" | "protocolVersion" | "token"> = {},
): Promise<RunningMcpServer> {
  const running = await serveEmseepea(app, { port: 0 });
  const clients: Client[] = [];
  test.after(async () => {
    await Promise.allSettled(clients.map((client) => client.close()));
    await running.close();
  });
  return {
    ...running,
    output: () => Object.freeze({ stdout: "", stderr: "" }),
    connect: (token = options.token) => connect(
      running.url,
      clients,
      options.clientName,
      token,
      options.protocolVersion,
    ),
  };
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
    output: () => Object.freeze({ stdout: output, stderr: errors }),
    connect: (token = options.token) => connect(
      url,
      clients,
      options.clientName,
      token,
      options.protocolVersion,
    ),
  };
}

async function connect(
  url: URL,
  clients: Client[],
  clientName = "emseepea-test",
  token?: string,
  protocolVersion: SupportedProtocolVersion = "2026-07-28",
): Promise<Client> {
  const client = new Client(
    { name: clientName, version: "0.0.0" },
    protocolVersion === "2026-07-28"
      ? { versionNegotiation: { mode: { pin: protocolVersion } } }
      : { supportedProtocolVersions: [protocolVersion], versionNegotiation: { mode: "legacy" } },
  );
  await client.connect(new StreamableHTTPClientTransport(
    url,
    token ? { authProvider: { token: async () => token } } : undefined,
  ));
  clients.push(client);
  return client;
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
