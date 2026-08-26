import { createMcpFastifyApp } from "@modelcontextprotocol/fastify";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { McpServer, createMcpHandler, type CallToolResult } from "@modelcontextprotocol/server";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isIP } from "node:net";
import type { z } from "zod";

const PROTOCOL_VERSION = "2026-07-28";
const REGISTER = Symbol("register");
const TOOL_NAME = Symbol("toolName");
const runtimes = new WeakMap<FastifyInstance, AppRuntime>();

export interface ToolContext { readonly signal: AbortSignal }
export interface ToolResult<Output> { readonly text: string; readonly data: Output }
export interface ToolDefinition<Input extends z.ZodObject, Output extends z.ZodObject> {
  readonly name: string;
  readonly access: "public";
  readonly title?: string;
  readonly description: string;
  readonly inputSchema: Input;
  readonly outputSchema: Output;
  readonly handler: (input: z.output<Input>, context: ToolContext) =>
    ToolResult<z.input<Output>> | Promise<ToolResult<z.input<Output>>>;
}
export interface EmseepeaTool {
  readonly [TOOL_NAME]: string;
  readonly [REGISTER]: (server: McpServer, timeoutMs: number) => void;
}
export interface EmseepeaOptions {
  readonly name: string;
  readonly version: string;
  readonly instructions?: string;
  readonly tools?: readonly EmseepeaTool[];
  readonly maxRequestBytes?: number;
  readonly toolTimeoutMs?: number;
  readonly deployment?: DeploymentProfile;
}
export type DeploymentProfile =
  | { readonly mode: "loopback" }
  | {
      readonly mode: "production-behind-proxy";
      readonly allowedAuthorities: readonly string[];
      readonly allowedOrigins: readonly string[];
      readonly trustedProxyAddresses: readonly string[];
      readonly rateLimit: Readonly<RateLimitOptions>;
    };
export interface ServeOptions {
  readonly host?: "127.0.0.1" | "::1" | "localhost" | "0.0.0.0" | "::";
  readonly port?: number;
  readonly shutdownTimeoutMs?: number;
}
export interface RunningEmseepeaServer {
  readonly url: URL;
  readonly close: () => Promise<void>;
}

interface RateLimitOptions { maxRequests: number; windowMs: number; maxClients: number }
type NormalizedDeployment =
  | { readonly mode: "loopback" }
  | {
      readonly mode: "production-behind-proxy";
      readonly allowedAuthorities: ReadonlySet<string>;
      readonly allowedOrigins: ReadonlySet<string>;
      readonly trustedProxyAddresses: ReadonlySet<string>;
      readonly rateLimit: Readonly<RateLimitOptions>;
    };
interface AppRuntime { deployment: NormalizedDeployment; requestTimeoutMs: number }

export function defineTool<Input extends z.ZodObject, Output extends z.ZodObject>(
  definition: ToolDefinition<Input, Output>,
): EmseepeaTool {
  assertToolName(definition.name);
  if (definition.access !== "public") {
    throw new TypeError('Tool access must be explicitly declared as "public"');
  }
  return {
    [TOOL_NAME]: definition.name,
    [REGISTER](server, timeoutMs) {
      const inputSchema: z.ZodObject = definition.inputSchema;
      const outputSchema: z.ZodObject = definition.outputSchema;
      server.registerTool(
        definition.name,
        { title: definition.title, description: definition.description, inputSchema, outputSchema },
        async (input, context): Promise<CallToolResult> => {
          const parsedInput = await definition.inputSchema.safeParseAsync(input);
          if (!parsedInput.success) throw new Error("Tool received input that does not match its schema");
          const result = await runWithDeadline(
            context.mcpReq.signal,
            timeoutMs,
            (signal) => definition.handler(parsedInput.data, { signal }),
          );
          const parsedOutput = await definition.outputSchema.safeParseAsync(result.data);
          if (!parsedOutput.success) throw new Error("Tool returned output that does not match its schema");
          return {
            content: [{ type: "text", text: result.text }],
            structuredContent: parsedOutput.data as Record<string, unknown>,
            isError: false,
          };
        },
      );
    },
  };
}

export function createEmseepea(options: EmseepeaOptions): FastifyInstance {
  assertNonEmpty("name", options.name);
  assertNonEmpty("version", options.version);
  const tools = options.tools ?? [];
  assertUniqueToolNames(tools);
  const maxRequestBytes = positiveInteger("maxRequestBytes", options.maxRequestBytes ?? 1024 * 1024);
  const toolTimeoutMs = positiveInteger("toolTimeoutMs", options.toolTimeoutMs ?? 30_000);
  const deployment = normalizeDeployment(options.deployment ?? { mode: "loopback" });
  const enabledMethods = new Set(["server/discover"]);
  if (tools.length) enabledMethods.add("tools/list").add("tools/call");

  const sdkHandler = createMcpHandler(() => {
    const server = new McpServer(
      { name: options.name, version: options.version },
      {
        capabilities: tools.length ? { tools: { listChanged: false } } : {},
        instructions: options.instructions,
        supportedProtocolVersions: [PROTOCOL_VERSION],
      },
    );
    for (const tool of tools) tool[REGISTER](server, toolTimeoutMs);
    return server;
  }, { legacy: "reject", responseMode: "json" });
  const nodeHandler = toNodeHandler(sdkHandler);
  const app = createMcpFastifyApp({ host: deployment.mode === "loopback" ? "127.0.0.1" : "0.0.0.0" });
  const limiter = deployment.mode === "production-behind-proxy"
    ? new FixedWindowRateLimiter(deployment.rateLimit)
    : undefined;

  app.get("/healthz", health("ok\n"));
  app.get("/readyz", health("ready\n"));
  app.route({
    method: ["GET", "PUT", "PATCH", "DELETE", "OPTIONS"],
    url: "/mcp",
    handler: async (_request, reply) => { await reply.header("allow", "POST").code(405).send(); },
  });
  app.post("/mcp", { bodyLimit: maxRequestBytes }, async (request, reply) => {
    if (deployment.mode === "production-behind-proxy" &&
        !validateProductionRequest(request, reply, deployment, limiter!)) return;
    if (isRecord(request.body) && typeof request.body.method === "string" &&
        !enabledMethods.has(request.body.method)) {
      await sendRpcError(reply, 404, -32601, "Method not found", requestId(request.body.id));
      return;
    }
    reply.hijack();
    await nodeHandler(request.raw, reply.raw, request.body);
  });
  app.setErrorHandler(async (error, _request, reply) => {
    if (isFastifyError(error) && error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      await sendRpcError(reply, 413, -32600, "Request exceeds configured size limit");
    } else if (isJsonParseError(error)) {
      await sendRpcError(reply, 400, -32700, "Parse error");
    } else {
      await sendRpcError(reply, 500, -32603, "Internal error");
    }
  });
  app.addHook("onClose", async () => sdkHandler.close());
  runtimes.set(app, { deployment, requestTimeoutMs: toolTimeoutMs + 5_000 });
  return app;
}

export async function serveEmseepea(
  app: FastifyInstance,
  options: ServeOptions = {},
): Promise<RunningEmseepeaServer> {
  const runtime = runtimes.get(app);
  if (!runtime) throw new TypeError("serveEmseepea requires an app created by createEmseepea");
  const host = options.host ?? "127.0.0.1";
  if (runtime.deployment.mode === "loopback" && !isLoopbackHost(host)) {
    throw new TypeError("The loopback deployment profile cannot bind publicly");
  }
  const port = nonNegativePort(options.port ?? 3000);
  const shutdownTimeoutMs = positiveInteger("shutdownTimeoutMs", options.shutdownTimeoutMs ?? 5_000);
  await app.listen({ host, port });
  app.server.headersTimeout = 10_000;
  app.server.keepAliveTimeout = 5_000;
  app.server.requestTimeout = runtime.requestTimeoutMs;
  app.server.maxHeadersCount = 100;
  app.server.maxRequestsPerSocket = 1_000;
  const address = app.server.address();
  if (!address || typeof address === "string") {
    await app.close();
    throw new Error("Fastify did not expose a TCP listening address");
  }
  const urlHost = host === "::1" ? "[::1]" : host;
  let closing: Promise<void> | undefined;
  return {
    url: new URL(`http://${urlHost}:${address.port}/mcp`),
    close: () => closing ??= closeApp(app, shutdownTimeoutMs),
  };
}

function health(body: string) {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    await reply.header("cache-control", "no-store").type("text/plain; charset=utf-8").send(body);
  };
}
async function sendRpcError(
  reply: FastifyReply,
  status: number,
  code: number,
  message: string,
  id: string | number | null = null,
): Promise<void> {
  await reply.code(status).send({ jsonrpc: "2.0", id, error: { code, message } });
}
function isFastifyError(error: unknown): error is FastifyError {
  return error instanceof Error && "code" in error;
}
function isJsonParseError(error: unknown): error is SyntaxError & { statusCode: number } {
  return (error instanceof SyntaxError && "statusCode" in error && error.statusCode === 400) ||
    (isFastifyError(error) &&
      (error.code === "FST_ERR_CTP_INVALID_JSON_BODY" ||
       error.code === "FST_ERR_CTP_EMPTY_JSON_BODY"));
}

function validateProductionRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  deployment: Extract<NormalizedDeployment, { mode: "production-behind-proxy" }>,
  limiter: FixedWindowRateLimiter,
): boolean {
  const reject = (status: number, message: string) => {
    void sendRpcError(reply, status, -32004, message);
    return false;
  };
  const peer = normalizeIp(request.raw.socket.remoteAddress);
  if (!peer || !deployment.trustedProxyAddresses.has(peer)) {
    return reject(403, "Request did not come from a trusted proxy");
  }
  const proto = singleHeader(request.raw.rawHeaders, "x-forwarded-proto");
  const forwardedFor = singleHeader(request.raw.rawHeaders, "x-forwarded-for");
  const host = singleHeader(request.raw.rawHeaders, "host");
  const origin = singleHeader(request.raw.rawHeaders, "origin");
  const client = forwardedFor && !forwardedFor.includes(",") ? normalizeIp(forwardedFor) : undefined;
  if (proto !== "https" || !client) return reject(403, "Invalid forwarding metadata");
  if (!host || !deployment.allowedAuthorities.has(normalizeAuthority(host) ?? "")) {
    return reject(403, "Authority is not allowed");
  }
  if (origin !== undefined && (!origin || !deployment.allowedOrigins.has(normalizeOrigin(origin) ?? ""))) {
    return reject(403, "Origin is not allowed");
  }
  const result = limiter.take(client);
  if (result === "full") return reject(503, "Rate-limit capacity is exhausted");
  if (result === "limited") return reject(429, "Rate limit exceeded");
  return true;
}

class FixedWindowRateLimiter {
  readonly #clients = new Map<string, { count: number; startedAt: number }>();
  constructor(readonly options: Readonly<RateLimitOptions>) {}

  take(client: string, now = Date.now()): "allowed" | "limited" | "full" {
    const current = this.#clients.get(client);
    if (current && now - current.startedAt < this.options.windowMs) {
      current.count += 1;
      return current.count <= this.options.maxRequests ? "allowed" : "limited";
    }
    if (current) {
      this.#clients.set(client, { count: 1, startedAt: now });
      return "allowed";
    }
    for (const [key, entry] of this.#clients) {
      if (now - entry.startedAt >= this.options.windowMs) this.#clients.delete(key);
    }
    if (this.#clients.size >= this.options.maxClients) return "full";
    this.#clients.set(client, { count: 1, startedAt: now });
    return "allowed";
  }
}

function normalizeDeployment(profile: DeploymentProfile): NormalizedDeployment {
  if (profile.mode === "loopback") return profile;
  if (!profile.allowedAuthorities.length || !profile.allowedOrigins.length ||
      !profile.trustedProxyAddresses.length) {
    throw new TypeError("Production deployment allowlists must not be empty");
  }
  return {
    mode: profile.mode,
    allowedAuthorities: new Set(profile.allowedAuthorities.map((value) => requiredNormalized(
      "allowed authority", value, normalizeAuthority,
    ))),
    allowedOrigins: new Set(profile.allowedOrigins.map((value) => requiredNormalized(
      "allowed HTTPS origin", value, normalizeOrigin,
    ))),
    trustedProxyAddresses: new Set(profile.trustedProxyAddresses.map((value) => requiredNormalized(
      "trusted proxy IP address", value, normalizeIp,
    ))),
    rateLimit: {
      maxRequests: positiveInteger("rateLimit.maxRequests", profile.rateLimit.maxRequests),
      windowMs: positiveInteger("rateLimit.windowMs", profile.rateLimit.windowMs),
      maxClients: positiveInteger("rateLimit.maxClients", profile.rateLimit.maxClients),
    },
  };
}

function requiredNormalized(
  label: string,
  value: string,
  normalize: (value: string) => string | undefined,
): string {
  const normalized = normalize(value);
  if (!normalized) throw new TypeError(`Invalid ${label}: ${value}`);
  return normalized;
}

function normalizeIp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const candidate = value.startsWith("::ffff:") ? value.slice(7) : value;
  return isIP(candidate) ? candidate.toLowerCase() : undefined;
}

function normalizeAuthority(value: string): string | undefined {
  if (value.trim() !== value || /[/?#@]/.test(value)) return undefined;
  try {
    const url = new URL(`https://${value}`);
    const port = url.port === "443" ? "" : url.port;
    return `${url.hostname.toLowerCase()}${port ? `:${port}` : ""}`;
  } catch {
    return undefined;
  }
}

function normalizeOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" ||
        url.search || url.hash) return undefined;
    const authority = normalizeAuthority(url.host);
    return authority ? `https://${authority}` : undefined;
  } catch {
    return undefined;
  }
}

function singleHeader(rawHeaders: readonly string[], name: string): string | undefined | null {
  const values: string[] = [];
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index]?.toLowerCase() === name) values.push(rawHeaders[index + 1] ?? "");
  }
  return values.length === 0 ? undefined : values.length === 1 ? values[0] : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requestId(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

async function runWithDeadline<Result>(
  requestSignal: AbortSignal,
  timeoutMs: number,
  work: (signal: AbortSignal) => Result | Promise<Result>,
): Promise<Result> {
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(timeoutMs)]);
  return new Promise<Result>((resolve, reject) => {
    const onAbort = () => reject(new Error("Tool execution cancelled"));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve().then(() => work(signal)).then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function assertUniqueToolNames(tools: readonly EmseepeaTool[]): void {
  const names = new Set<string>();
  for (const tool of tools) {
    const name = tool[TOOL_NAME];
    if (names.has(name)) throw new TypeError(`Duplicate tool name: ${name}`);
    names.add(name);
  }
}
function assertToolName(name: string): void {
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(name)) {
    throw new TypeError("Tool name must contain 1 to 128 ASCII letters, digits, underscores, dots, or hyphens");
  }
}
function assertNonEmpty(field: string, value: string): void {
  if (!value.trim()) throw new TypeError(`${field} must not be empty`);
}
function positiveInteger(field: string, value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${field} must be a positive safe integer`);
  return value;
}
function nonNegativePort(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 65_535) {
    throw new TypeError("port must be an integer from 0 to 65535");
  }
  return value;
}
function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

async function closeApp(app: FastifyInstance, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => { app.server.closeAllConnections(); resolve(); }, timeoutMs);
    timer.unref();
  });
  await Promise.race([app.close(), timeout]);
  if (timer) clearTimeout(timer);
}
