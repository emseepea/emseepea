import { createMcpFastifyApp } from "@modelcontextprotocol/fastify";
import {
  GetPromptResultSchema,
  ReadResourceResultSchema,
} from "@modelcontextprotocol/core";
import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  McpServer,
  OAuthError,
  OAuthErrorCode,
  ResourceTemplate,
  bearerAuthChallengeResponse,
  buildOAuthProtectedResourceMetadata,
  checkResourceAllowed,
  completable,
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  oauthMetadataResponse,
  verifyBearerToken,
  type AuthInfo,
  type AuthMetadataOptions,
  type CallToolResult,
  type GetPromptResult,
  type OAuthTokenVerifier,
  type ReadResourceResult,
} from "@modelcontextprotocol/server";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AsyncLocalStorage } from "node:async_hooks";
import { isIP } from "node:net";
import { z } from "zod";

const PROTOCOL_VERSION = "2026-07-28";
const REGISTER = Symbol("register");
const TOOL_NAME = Symbol("toolName");
const TOOL_ACCESS = Symbol("toolAccess");
const RESOURCE_NAME = Symbol("resourceName");
const RESOURCE_URI = Symbol("resourceUri");
const RESOURCE_KIND = Symbol("resourceKind");
const RESOURCE_MATCHES = Symbol("resourceMatches");
const RESOURCE_ROUTE = Symbol("resourceRoute");
const PROMPT_NAME = Symbol("promptName");
const HAS_COMPLETION = Symbol("hasCompletion");
const runtimes = new WeakMap<FastifyInstance, AppRuntime>();
interface RequestOperation {
  readonly deadlineMs: number;
  readonly signal: AbortSignal;
}
const requestOperations = new AsyncLocalStorage<RequestOperation>();

export interface ToolPrincipal {
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly resource?: string;
}
export interface ToolContext<Access extends ToolAccess = ToolAccess> {
  readonly signal: AbortSignal;
  readonly deadlineMs: number;
  readonly principal: Access extends "public" ? undefined : ToolPrincipal;
}
export interface ToolResult<Output> { readonly text: string; readonly data: Output }
export interface BackendAdapterContext {
  readonly signal: AbortSignal;
  readonly deadlineMs: number;
}
export type OperationContext = BackendAdapterContext;
export interface CompletionContext extends OperationContext {
  readonly arguments: Readonly<Record<string, string>>;
}
export type CompletionHandler = (
  value: string,
  context: CompletionContext,
) => readonly string[] | Promise<readonly string[]>;
interface ProtectedToolAccess {
  readonly type: "protected";
  readonly requiredScopes: readonly string[];
}
export type ToolAccess = "public" | "protected";
interface ToolDefinitionBase<Input extends z.ZodObject, Output extends z.ZodObject> {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema: Input;
  readonly outputSchema: Output;
}
export type ToolDefinition<Input extends z.ZodObject, Output extends z.ZodObject> =
  ToolDefinitionBase<Input, Output> & (
    | {
        readonly access: "public";
        readonly requiredScopes?: never;
        readonly handler: (input: z.output<Input>, context: ToolContext<"public">) =>
          ToolResult<z.input<Output>> | Promise<ToolResult<z.input<Output>>>;
      }
    | {
        readonly access: "protected";
        readonly requiredScopes: readonly string[];
        readonly handler: (input: z.output<Input>, context: ToolContext<"protected">) =>
          ToolResult<z.input<Output>> | Promise<ToolResult<z.input<Output>>>;
      }
  );
interface MappedToolDefinitionBase<
  Input extends z.ZodObject,
  Output extends z.ZodObject,
  BackendInput extends z.ZodObject,
  BackendOutput extends z.ZodObject,
> extends ToolDefinitionBase<Input, Output> {
  readonly backendInputSchema: BackendInput;
  readonly backendOutputSchema: BackendOutput;
  readonly mapInput: (input: z.output<Input>) => z.input<BackendInput>;
  readonly adapter: (
    input: z.output<BackendInput>,
    context: BackendAdapterContext,
  ) => z.input<BackendOutput> | Promise<z.input<BackendOutput>>;
  readonly mapOutput: (output: z.output<BackendOutput>) => ToolResult<z.input<Output>>;
}
export type MappedToolDefinition<
  Input extends z.ZodObject,
  Output extends z.ZodObject,
  BackendInput extends z.ZodObject,
  BackendOutput extends z.ZodObject,
> =
  | MappedToolDefinitionBase<Input, Output, BackendInput, BackendOutput> & {
      readonly access: "public";
      readonly requiredScopes?: never;
    }
  | MappedToolDefinitionBase<Input, Output, BackendInput, BackendOutput> & {
      readonly access: "protected";
      readonly requiredScopes: readonly string[];
    };
export interface EmseepeaTool {
  readonly [TOOL_NAME]: string;
  readonly [TOOL_ACCESS]: "public" | ProtectedToolAccess;
  readonly [REGISTER]: (server: McpServer, timeoutMs: number, maxApplicationResultBytes: number) => void;
}
export interface ResourceDefinition {
  readonly name: string;
  readonly uri: string;
  readonly title?: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly handler: (context: OperationContext) =>
    ReadResourceResult | Promise<ReadResourceResult>;
}
export interface ResourceTemplateDefinition {
  readonly name: string;
  readonly uriTemplate: string;
  readonly title?: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly complete?: Readonly<Record<string, CompletionHandler>>;
  readonly handler: (
    input: {
      readonly uri: string;
      readonly variables: Readonly<Record<string, string | readonly string[]>>;
    },
    context: OperationContext,
  ) => ReadResourceResult | Promise<ReadResourceResult>;
}
interface ResourceTemplateRoute {
  readonly protocol: string;
  readonly host: string;
  readonly segments: readonly (string | undefined)[];
}
export interface EmseepeaResource {
  readonly [RESOURCE_NAME]: string;
  readonly [RESOURCE_URI]: string;
  readonly [RESOURCE_KIND]: "static" | "template";
  readonly [RESOURCE_MATCHES]?: (uri: string) => boolean;
  readonly [RESOURCE_ROUTE]?: ResourceTemplateRoute;
  readonly [HAS_COMPLETION]: boolean;
  readonly [REGISTER]: (server: McpServer, timeoutMs: number, maxApplicationResultBytes: number) => void;
}
type NonStringPromptArgumentKeys<Args extends z.ZodObject> = {
  [Key in keyof z.input<Args>]-?: Exclude<z.input<Args>[Key], undefined> extends string
    ? never
    : Key;
}[keyof z.input<Args>];
type PromptInputConstraint<Args extends z.ZodObject> =
  [NonStringPromptArgumentKeys<Args>] extends [never]
    ? object
    : { readonly promptArgumentsMustAcceptStrings: never };
export type PromptDefinition<Args extends z.ZodObject> = {
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  readonly argsSchema: Args;
  readonly complete?: Readonly<Partial<Record<Extract<keyof z.input<Args>, string>, CompletionHandler>>>;
  readonly handler: (
    args: z.output<Args>,
    context: OperationContext,
  ) => GetPromptResult | Promise<GetPromptResult>;
} & PromptInputConstraint<Args>;
export interface EmseepeaPrompt {
  readonly [PROMPT_NAME]: string;
  readonly [HAS_COMPLETION]: boolean;
  readonly [REGISTER]: (server: McpServer, timeoutMs: number, maxApplicationResultBytes: number) => void;
}
export interface OAuthResourceServerOptions {
  readonly verifier: OAuthTokenVerifier;
  readonly metadata: Omit<AuthMetadataOptions, "dangerouslyAllowInsecureIssuerUrl"> & {
    readonly dangerouslyAllowInsecureIssuerUrl?: false;
  };
  readonly verificationTimeoutMs?: number;
}
export interface EmseepeaOptions {
  readonly name: string;
  readonly version: string;
  readonly instructions?: string;
  readonly tools?: readonly EmseepeaTool[];
  readonly resources?: readonly EmseepeaResource[];
  readonly prompts?: readonly EmseepeaPrompt[];
  readonly maxRequestBytes?: number;
  readonly maxApplicationResultBytes?: number;
  readonly operationTimeoutMs?: number;
  readonly deployment?: DeploymentProfile;
  readonly oauth?: OAuthResourceServerOptions;
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
interface NormalizedOAuth {
  readonly verifier: OAuthTokenVerifier;
  readonly metadata: AuthMetadataOptions;
  readonly resourceMetadataUrl: string;
  readonly verificationTimeoutMs: number;
}

export function defineTool<Input extends z.ZodObject, Output extends z.ZodObject>(
  definition: ToolDefinition<Input, Output>,
): EmseepeaTool {
  const handler = definition.handler as unknown as (
    input: z.output<Input>,
    context: ToolContext,
  ) => ToolResult<z.input<Output>> | Promise<ToolResult<z.input<Output>>>;
  return createCheckedTool(definition, handler as CheckedToolExecutor);
}

export function defineMappedTool<
  Input extends z.ZodObject,
  Output extends z.ZodObject,
  BackendInput extends z.ZodObject,
  BackendOutput extends z.ZodObject,
>(definition: MappedToolDefinition<Input, Output, BackendInput, BackendOutput>): EmseepeaTool {
  const { backendInputSchema, backendOutputSchema, adapter } = definition;
  const mapInput = definition.mapInput as unknown as (
    input: z.output<Input>,
  ) => z.input<BackendInput>;
  const mapOutput = definition.mapOutput as unknown as (
    output: z.output<BackendOutput>,
  ) => ToolResult<z.input<Output>>;
  const execute = async (input: z.output<Input>, context: ToolContext) => {
    const command = await backendInputSchema.safeParseAsync(mapInput(input));
    if (!command.success) throw new Error("Mapped backend command does not match its schema");
    context.signal.throwIfAborted();
    const backendResult = await adapter(command.data, {
      signal: context.signal,
      deadlineMs: context.deadlineMs,
    });
    context.signal.throwIfAborted();
    const parsedBackendResult = await backendOutputSchema.safeParseAsync(backendResult);
    if (!parsedBackendResult.success) throw new Error("Backend result does not match its schema");
    context.signal.throwIfAborted();
    return mapOutput(parsedBackendResult.data);
  };
  return createCheckedTool(definition, execute as CheckedToolExecutor);
}

export function defineResource(definition: ResourceDefinition): EmseepeaResource {
  const { name, title, description, mimeType, handler } = definition;
  assertRegistrationName("Resource", name);
  const uri = canonicalResourceUri(definition.uri);
  const registration: EmseepeaResource = {
    [RESOURCE_NAME]: name,
    [RESOURCE_URI]: uri,
    [RESOURCE_KIND]: "static",
    [HAS_COMPLETION]: false,
    [REGISTER](server, timeoutMs, maxApplicationResultBytes) {
      server.registerResource(
        name,
        uri,
        {
          title,
          description,
          mimeType,
        },
        async (_requestedUri, context): Promise<ReadResourceResult> => {
          try {
            const deadlineMs = requestOperations.getStore()?.deadlineMs ?? Date.now() + timeoutMs;
            return await runWithDeadline(context.mcpReq.signal, deadlineMs, async (signal) => {
              signal.throwIfAborted();
              const result = await handler({ signal, deadlineMs });
              signal.throwIfAborted();
              const parsed = await ReadResourceResultSchema.safeParseAsync(result);
              if (!parsed.success || parsed.data.contents.some((content) => content.uri !== uri)) {
                throw new Error("Resource returned an invalid result");
              }
              signal.throwIfAborted();
              assertResultSize(parsed.data, maxApplicationResultBytes, deadlineMs, signal);
              return parsed.data;
            });
          } catch {
            throw new Error("Resource read failed");
          }
        },
      );
    },
  };
  return Object.freeze(registration);
}

export function defineResourceTemplate(definition: ResourceTemplateDefinition): EmseepeaResource {
  const { name, title, description, mimeType, handler } = definition;
  assertRegistrationName("Resource template", name);
  const { template, route } = checkedResourceTemplate(definition.uriTemplate);
  const uriTemplate = template.uriTemplate.toString();
  const variableNames = [...template.uriTemplate.variableNames];
  const completions = checkedCompletionHandlers(
    "Resource template",
    definition.complete,
    variableNames,
  );
  const registration: EmseepeaResource = {
    [RESOURCE_NAME]: name,
    [RESOURCE_URI]: uriTemplate,
    [RESOURCE_KIND]: "template",
    [RESOURCE_MATCHES]: (uri) => template.uriTemplate.match(uri) !== null,
    [RESOURCE_ROUTE]: route,
    [HAS_COMPLETION]: completions.size > 0,
    [REGISTER](server, timeoutMs, maxApplicationResultBytes) {
      const registeredTemplate = completions.size === 0
        ? template
        : new ResourceTemplate(uriTemplate, {
            list: undefined,
            complete: Object.fromEntries([...completions].map(([variable, complete]) => [
              variable,
              completionCallback(
                complete,
                variable,
                variableNames,
                timeoutMs,
                maxApplicationResultBytes,
              ),
            ])),
          });
      server.registerResource(
        name,
        registeredTemplate,
        { title, description, mimeType },
        async (requestedUri, variables, context): Promise<ReadResourceResult> => {
          try {
            const deadlineMs = requestOperations.getStore()?.deadlineMs ?? Date.now() + timeoutMs;
            return await runWithDeadline(context.mcpReq.signal, deadlineMs, async (signal) => {
              signal.throwIfAborted();
              const result = await handler({ uri: requestedUri.href, variables }, { signal, deadlineMs });
              signal.throwIfAborted();
              const parsed = await ReadResourceResultSchema.safeParseAsync(result);
              if (!parsed.success ||
                  parsed.data.contents.some((content) => content.uri !== requestedUri.href)) {
                throw new Error("Resource template returned an invalid result");
              }
              signal.throwIfAborted();
              assertResultSize(parsed.data, maxApplicationResultBytes, deadlineMs, signal);
              return parsed.data;
            });
          } catch {
            throw new Error("Resource read failed");
          }
        },
      );
    },
  };
  return Object.freeze(registration);
}

export function definePrompt<Args extends z.ZodObject>(
  definition: PromptDefinition<Args>,
): EmseepeaPrompt {
  const { name, title, description, argsSchema, handler } = definition;
  assertRegistrationName("Prompt", name);
  const argumentNames = Object.keys(argsSchema.shape);
  const completions = checkedCompletionHandlers("Prompt", definition.complete, argumentNames);
  const registration: EmseepeaPrompt = {
    [PROMPT_NAME]: name,
    [HAS_COMPLETION]: completions.size > 0,
    [REGISTER](server, timeoutMs, maxApplicationResultBytes) {
      server.registerPrompt(
        name,
        {
          title,
          description,
          argsSchema: sdkPromptMetadataSchema(
            argsSchema,
            completions,
            argumentNames,
            timeoutMs,
            maxApplicationResultBytes,
          ),
        },
        async (args, context): Promise<GetPromptResult> => {
          try {
            const deadlineMs = requestOperations.getStore()?.deadlineMs ?? Date.now() + timeoutMs;
            return await runWithDeadline(context.mcpReq.signal, deadlineMs, async (signal) => {
              const parsedArgs = await argsSchema.safeParseAsync(args);
              if (!parsedArgs.success) throw new Error("Prompt received invalid arguments");
              signal.throwIfAborted();
              const result = await handler(parsedArgs.data, { signal, deadlineMs });
              signal.throwIfAborted();
              const parsedResult = await GetPromptResultSchema.safeParseAsync(result);
              if (!parsedResult.success) throw new Error("Prompt returned an invalid result");
              signal.throwIfAborted();
              assertResultSize(parsedResult.data, maxApplicationResultBytes, deadlineMs, signal);
              return parsedResult.data;
            });
          } catch {
            throw new Error("Prompt rendering failed");
          }
        },
      );
    },
  };
  return Object.freeze(registration);
}

interface CheckedToolDefinition {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema: z.ZodObject;
  readonly outputSchema: z.ZodObject;
  readonly access: ToolAccess;
  readonly requiredScopes?: readonly string[];
}
type CheckedToolExecutor = (
  input: unknown,
  context: ToolContext,
) => unknown | Promise<unknown>;

function createCheckedTool(
  definition: CheckedToolDefinition,
  execute: CheckedToolExecutor,
): EmseepeaTool {
  const { name, title, description, inputSchema, outputSchema } = definition;
  assertRegistrationName("Tool", name);
  const access = normalizeToolAccess(definition.access, definition.requiredScopes);
  const registration: EmseepeaTool = {
    [TOOL_NAME]: name,
    [TOOL_ACCESS]: access,
    [REGISTER](server, timeoutMs, maxApplicationResultBytes) {
      server.registerTool(
        name,
        {
          title,
          description,
          inputSchema: sdkMetadataSchema(inputSchema),
          outputSchema: sdkMetadataSchema(outputSchema),
          _meta: {
            "io.emseepea/access": access === "public"
              ? { type: "public" }
              : { type: "protected", requiredScopes: [...access.requiredScopes] },
          },
        },
        async (input, context): Promise<CallToolResult> => {
          try {
            const deadlineMs = requestOperations.getStore()?.deadlineMs ?? Date.now() + timeoutMs;
            return await runWithDeadline(
              context.mcpReq.signal,
              deadlineMs,
              async (signal) => {
                const parsedInput = await inputSchema.safeParseAsync(input);
                if (!parsedInput.success) {
                  throw new Error("Tool received input that does not match its schema");
                }
                signal.throwIfAborted();
                const result = await execute(parsedInput.data, {
                  signal,
                  deadlineMs,
                  principal: access === "public" ? undefined : principalFrom(context.http?.authInfo),
                });
                if (!isRecord(result) || typeof result.text !== "string" || !("data" in result)) {
                  throw new Error("Tool returned an invalid result");
                }
                signal.throwIfAborted();
                const parsedOutput = await outputSchema.safeParseAsync(result.data);
                if (!parsedOutput.success) {
                  throw new Error("Tool returned output that does not match its schema");
                }
                const publicResult = {
                  content: [{ type: "text" as const, text: result.text }],
                  structuredContent: parsedOutput.data as Record<string, unknown>,
                  isError: false,
                };
                assertResultSize(publicResult, maxApplicationResultBytes, deadlineMs, signal);
                return publicResult;
              },
            );
          } catch {
            return { content: [{ type: "text", text: "Tool execution failed" }], isError: true };
          }
        },
      );
    },
  };
  return Object.freeze(registration);
}

export function createEmseepea(options: EmseepeaOptions): FastifyInstance {
  assertNonEmpty("name", options.name);
  assertNonEmpty("version", options.version);
  const tools = Object.freeze([...(options.tools ?? [])]);
  const resources = Object.freeze([...(options.resources ?? [])]);
  const prompts = Object.freeze([...(options.prompts ?? [])]);
  assertUniqueToolNames(tools);
  assertUniqueResources(resources);
  assertUniquePromptNames(prompts);
  const maxRequestBytes = positiveInteger("maxRequestBytes", options.maxRequestBytes ?? 1024 * 1024);
  const maxApplicationResultBytes = positiveInteger(
    "maxApplicationResultBytes",
    options.maxApplicationResultBytes ?? 1024 * 1024,
  );
  const operationTimeoutMs = positiveInteger(
    "operationTimeoutMs",
    options.operationTimeoutMs ?? 30_000,
  );
  const deployment = normalizeDeployment(options.deployment ?? { mode: "loopback" });
  const oauth = options.oauth ? normalizeOAuth(options.oauth) : undefined;
  if (tools.some((tool) => tool[TOOL_ACCESS] !== "public") && !oauth) {
    throw new TypeError("Protected tools require OAuth resource-server configuration");
  }
  const toolsByName = new Map(tools.map((tool) => [tool[TOOL_NAME], tool]));
  const enabledMethods = new Set(["server/discover"]);
  if (tools.length) enabledMethods.add("tools/list").add("tools/call");
  if (resources.length) enabledMethods.add("resources/list").add("resources/read");
  if (resources.some((resource) => resource[RESOURCE_KIND] === "template")) {
    enabledMethods.add("resources/templates/list");
  }
  if (prompts.length) enabledMethods.add("prompts/list").add("prompts/get");
  const hasCompletion = resources.some((resource) => resource[HAS_COMPLETION]) ||
    prompts.some((prompt) => prompt[HAS_COMPLETION]);
  if (hasCompletion) enabledMethods.add("completion/complete");

  const sdkHandler = createMcpHandler(() => {
    const server = new McpServer(
      { name: options.name, version: options.version },
      {
        capabilities: {
          ...(tools.length ? { tools: { listChanged: false } } : {}),
          ...(resources.length ? { resources: { subscribe: false, listChanged: false } } : {}),
          ...(prompts.length ? { prompts: { listChanged: false } } : {}),
          ...(hasCompletion ? { completions: {} } : {}),
        },
        instructions: options.instructions,
        supportedProtocolVersions: [PROTOCOL_VERSION],
      },
    );
    for (const tool of tools) tool[REGISTER](server, operationTimeoutMs, maxApplicationResultBytes);
    for (const resource of resources) resource[REGISTER](server, operationTimeoutMs, maxApplicationResultBytes);
    for (const prompt of prompts) prompt[REGISTER](server, operationTimeoutMs, maxApplicationResultBytes);
    return server;
  }, { legacy: "reject", responseMode: "json" });
  const nodeHandler = toNodeHandler(sdkHandler);
  const app = createMcpFastifyApp({ host: deployment.mode === "loopback" ? "127.0.0.1" : "0.0.0.0" });
  const limiter = deployment.mode === "production-behind-proxy"
    ? new FixedWindowRateLimiter(deployment.rateLimit)
    : undefined;

  app.get("/healthz", health("ok\n"));
  app.get("/readyz", health("ready\n"));
  if (oauth) {
    app.all("/.well-known/*", async (request, reply) => {
      const response = oauthMetadataResponse(
        new Request(new URL(request.url, oauth.metadata.resourceServerUrl.origin), {
          method: request.method,
        }),
        oauth.metadata,
      );
      if (!response) {
        await reply.code(404).send();
        return;
      }
      await sendWebResponse(reply, response);
    });
  }
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
    const access = protectedAccessForCall(request.body, toolsByName);
    if (access && oauth) {
      try {
        const authInfo = await verifyProtectedCall(request, reply, access, oauth);
        (request.raw as typeof request.raw & { auth?: AuthInfo }).auth = authInfo;
      } catch (error) {
        await sendWebResponse(reply, bearerAuthChallengeResponse(safeOAuthError(error), {
          requiredScopes: [...access.requiredScopes],
          resourceMetadataUrl: oauth.resourceMetadataUrl,
        }));
        return;
      }
    }
    const disconnected = new AbortController();
    const abort = () => disconnected.abort();
    request.raw.once("aborted", abort);
    reply.raw.once("close", abort);
    if (request.raw.aborted || request.raw.destroyed || reply.raw.destroyed) abort();
    reply.hijack();
    try {
      await requestOperations.run(
        { deadlineMs: Date.now() + operationTimeoutMs, signal: disconnected.signal },
        () => nodeHandler(request.raw, reply.raw, request.body),
      );
    } finally {
      request.raw.off("aborted", abort);
      reply.raw.off("close", abort);
    }
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
  runtimes.set(app, { deployment, requestTimeoutMs: operationTimeoutMs + 5_000 });
  return app;
}

function safeOAuthError(error: unknown): unknown {
  if (!(error instanceof OAuthError)) return error;
  const message = error.code === OAuthErrorCode.InvalidToken
    ? "Invalid access token"
    : error.code === OAuthErrorCode.InsufficientScope
      ? "Insufficient scope"
      : error.code === OAuthErrorCode.ServerError
        ? "Authorization service error"
        : "Authorization request failed";
  return new OAuthError(error.code, message);
}

async function verifyProtectedCall(
  request: FastifyRequest,
  reply: FastifyReply,
  access: ProtectedToolAccess,
  oauth: NormalizedOAuth,
): Promise<AuthInfo> {
  const disconnected = new AbortController();
  const abort = () => disconnected.abort();
  request.raw.once("aborted", abort);
  reply.raw.once("close", abort);
  try {
    const authInfo = await runWithDeadline(
      disconnected.signal,
      Date.now() + oauth.verificationTimeoutMs,
      () => verifyBearerToken(singleHeader(request.raw.rawHeaders, "authorization"), {
        verifier: oauth.verifier,
        requiredScopes: [...access.requiredScopes],
        resourceMetadataUrl: oauth.resourceMetadataUrl,
      }),
    );
    if (!authInfo.resource || authInfo.resource.hash || !checkResourceAllowed({
      requestedResource: authInfo.resource,
      configuredResource: oauth.metadata.resourceServerUrl,
    })) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, "Token is not valid for this resource");
    }
    return authInfo;
  } finally {
    request.raw.off("aborted", abort);
    reply.raw.off("close", abort);
  }
}

async function sendWebResponse(reply: FastifyReply, response: Response): Promise<void> {
  for (const [name, value] of response.headers) reply.header(name, value);
  const body = Buffer.from(await response.arrayBuffer());
  await reply.code(response.status).send(body.length ? body : undefined);
}

function protectedAccessForCall(
  body: unknown,
  toolsByName: ReadonlyMap<string, EmseepeaTool>,
): ProtectedToolAccess | undefined {
  if (!isRecord(body) || body.method !== "tools/call" || !isRecord(body.params) ||
      typeof body.params.name !== "string") return undefined;
  const access = toolsByName.get(body.params.name)?.[TOOL_ACCESS];
  return access === "public" ? undefined : access;
}

function principalFrom(authInfo: AuthInfo | undefined): ToolPrincipal {
  if (!authInfo) throw new Error("Protected tool reached execution without verified authorization");
  return {
    clientId: authInfo.clientId,
    scopes: [...authInfo.scopes],
    resource: authInfo.resource?.href,
  };
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

function normalizeToolAccess(
  access: unknown,
  requiredScopes: unknown,
): "public" | ProtectedToolAccess {
  if (access === "public") return access;
  if (access !== "protected" || !Array.isArray(requiredScopes) || requiredScopes.length === 0) {
    throw new TypeError('Tool access must be explicitly declared as "public" or protected with scopes');
  }
  const scopes = requiredScopes.map((scope) => {
    if (typeof scope !== "string" || !/^[\x21\x23-\x5B\x5D-\x7E]+$/.test(scope)) {
      throw new TypeError("Protected tool scopes must be valid OAuth scope tokens");
    }
    return scope;
  });
  if (new Set(scopes).size !== scopes.length) {
    throw new TypeError("Protected tool scopes must be unique");
  }
  return { type: "protected", requiredScopes: scopes };
}

function normalizeOAuth(options: OAuthResourceServerOptions): NormalizedOAuth {
  if (!options.verifier || typeof options.verifier.verifyAccessToken !== "function") {
    throw new TypeError("oauth.verifier must implement verifyAccessToken");
  }
  if ((options.metadata as AuthMetadataOptions).dangerouslyAllowInsecureIssuerUrl === true) {
    throw new TypeError("Insecure OAuth issuer URLs are not supported");
  }
  const resourceServerUrl = options.metadata.resourceServerUrl;
  if (resourceServerUrl.hash || resourceServerUrl.username || resourceServerUrl.password ||
      (resourceServerUrl.protocol !== "https:" &&
       !(resourceServerUrl.protocol === "http:" && isLoopbackUrl(resourceServerUrl)))) {
    throw new TypeError("OAuth resource-server URL must be HTTPS, or HTTP on loopback, without credentials or a fragment");
  }
  buildOAuthProtectedResourceMetadata(options.metadata);
  return {
    verifier: options.verifier,
    metadata: options.metadata,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(options.metadata.resourceServerUrl),
    verificationTimeoutMs: positiveInteger(
      "oauth.verificationTimeoutMs",
      options.verificationTimeoutMs ?? 10_000,
    ),
  };
}

function isLoopbackUrl(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
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

function sdkMetadataSchema(schema: z.ZodObject): z.ZodObject {
  return {
    "~standard": {
      version: 1,
      vendor: "emseepea",
      validate: (value: unknown) => ({ value }),
      jsonSchema: {
        input: () => z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }),
        output: () => z.toJSONSchema(schema, { target: "draft-2020-12", io: "output" }),
      },
    },
  } as unknown as z.ZodObject;
}

function checkedCompletionHandlers(
  kind: string,
  complete: Readonly<Record<string, unknown>> | undefined,
  allowedNames: readonly string[],
): ReadonlyMap<string, CompletionHandler> {
  if (complete === undefined) return new Map();
  if (!isRecord(complete)) throw new TypeError(`${kind} completion map must be an object`);
  const allowed = new Set(allowedNames);
  const handlers = new Map<string, CompletionHandler>();
  for (const [name, handler] of Object.entries(complete)) {
    if (!allowed.has(name)) throw new TypeError(`${kind} completion key is not registered: ${name}`);
    if (typeof handler !== "function") {
      throw new TypeError(`${kind} completion handler must be a function: ${name}`);
    }
    handlers.set(name, handler as CompletionHandler);
  }
  return handlers;
}

function sdkPromptMetadataSchema(
  schema: z.ZodObject,
  completions: ReadonlyMap<string, CompletionHandler>,
  argumentNames: readonly string[],
  timeoutMs: number,
  maxApplicationResultBytes: number,
): z.ZodObject {
  const metadataSchema = sdkMetadataSchema(schema);
  if (completions.size === 0) return metadataSchema;
  const shape = Object.fromEntries([...completions].map(([argument, complete]) => [
    argument,
    completable(
      z.string(),
      completionCallback(
        complete,
        argument,
        argumentNames,
        timeoutMs,
        maxApplicationResultBytes,
      ),
    ),
  ]));
  Object.defineProperty(metadataSchema, "shape", {
    value: Object.freeze(shape),
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return metadataSchema;
}

function completionCallback(
  complete: CompletionHandler,
  currentName: string,
  allowedNames: readonly string[],
  timeoutMs: number,
  maxApplicationResultBytes: number,
): (value: string, context?: { arguments?: Record<string, string> }) => Promise<string[]> {
  const allowedArguments = new Set(allowedNames.filter((name) => name !== currentName));
  return async (value, context) => {
    try {
      const request = requestOperations.getStore();
      const deadlineMs = request?.deadlineMs ?? Date.now() + timeoutMs;
      const requestSignal = request?.signal ?? new AbortController().signal;
      return await runWithDeadline(requestSignal, deadlineMs, async (signal) => {
        signal.throwIfAborted();
        const values = await complete(value, {
          signal,
          deadlineMs,
          arguments: completionArguments(context?.arguments, allowedArguments),
        });
        signal.throwIfAborted();
        if (!Array.isArray(values)) {
          throw new Error("Completion returned an invalid result");
        }
        if (values.length > Math.floor((maxApplicationResultBytes - 1) / 3)) {
          throw new Error("Completion returned an invalid result");
        }
        const candidates: string[] = [];
        for (let index = 0; index < values.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
          if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string") {
            throw new Error("Completion returned an invalid result");
          }
          candidates.push(descriptor.value);
        }
        assertResultSize(candidates, maxApplicationResultBytes, deadlineMs, signal);
        const publicResult = {
          completion: {
            values: candidates.slice(0, 100),
            total: candidates.length,
            hasMore: candidates.length > 100,
          },
        };
        assertResultSize(publicResult, maxApplicationResultBytes, deadlineMs, signal);
        return candidates;
      });
    } catch {
      throw new Error("Completion failed");
    }
  };
}

function completionArguments(
  candidate: unknown,
  allowed: ReadonlySet<string>,
): Readonly<Record<string, string>> {
  const result: Record<string, string> = Object.create(null) as Record<string, string>;
  if (isRecord(candidate)) {
    for (const [name, value] of Object.entries(candidate)) {
      if (allowed.has(name) && typeof value === "string") result[name] = value;
    }
  }
  return Object.freeze(result);
}

function requestId(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

async function runWithDeadline<Result>(
  requestSignal: AbortSignal,
  deadlineMs: number,
  work: (signal: AbortSignal) => Result | Promise<Result>,
): Promise<Result> {
  const remainingMs = deadlineMs - Date.now();
  const deadlineSignal = remainingMs > 0 ? AbortSignal.timeout(remainingMs) : AbortSignal.abort();
  const signal = AbortSignal.any([requestSignal, deadlineSignal]);
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
function assertRegistrationName(kind: string, name: string): void {
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(name)) {
    throw new TypeError(`${kind} name must contain 1 to 128 ASCII letters, digits, underscores, dots, or hyphens`);
  }
}

function assertUniqueResources(resources: readonly EmseepeaResource[]): void {
  const names = new Set<string>();
  const uris = new Set<string>();
  const templateRoutes: ResourceTemplateRoute[] = [];
  for (const resource of resources) {
    const name = resource[RESOURCE_NAME];
    const uri = resource[RESOURCE_URI];
    if (names.has(name)) throw new TypeError(`Duplicate resource name: ${name}`);
    if (uris.has(uri)) {
      const label = resource[RESOURCE_KIND] === "template" ? "template" : "URI";
      throw new TypeError(`Duplicate resource ${label}: ${uri}`);
    }
    const route = resource[RESOURCE_ROUTE];
    if (route && templateRoutes.some((candidate) => resourceTemplateRoutesOverlap(route, candidate))) {
      throw new TypeError(`Ambiguous resource template: ${uri}`);
    }
    names.add(name);
    uris.add(uri);
    if (route) templateRoutes.push(route);
  }
  for (const resource of resources) {
    if (resource[RESOURCE_KIND] !== "static") continue;
    for (const candidate of resources) {
      if (candidate[RESOURCE_MATCHES]?.(resource[RESOURCE_URI])) {
        throw new TypeError(`Ambiguous resource registration: ${resource[RESOURCE_URI]}`);
      }
    }
  }
}

function assertUniquePromptNames(prompts: readonly EmseepeaPrompt[]): void {
  const names = new Set<string>();
  for (const prompt of prompts) {
    const name = prompt[PROMPT_NAME];
    if (names.has(name)) throw new TypeError(`Duplicate prompt name: ${name}`);
    names.add(name);
  }
}

function canonicalResourceUri(uri: string): string {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new TypeError("Resource URI must be an absolute canonical URI");
  }
  if (parsed.href !== uri) throw new TypeError("Resource URI must be an absolute canonical URI");
  return uri;
}
function checkedResourceTemplate(uriTemplate: string): {
  template: ResourceTemplate;
  route: ResourceTemplateRoute;
} {
  let template: ResourceTemplate;
  try {
    if (/[{}]/.test(uriTemplate.replace(/\{[A-Za-z][A-Za-z0-9_]*\}/g, ""))) {
      throw new Error("unsupported expression");
    }
    const expressionNames = [...uriTemplate.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
      .map((match) => match[1]!);
    if (new Set(expressionNames).size !== expressionNames.length) {
      throw new Error("repeated variable");
    }
    template = new ResourceTemplate(uriTemplate, { list: undefined });
    const variableNames = template.uriTemplate.variableNames;
    if (variableNames.length === 0) throw new Error("missing variable");
    const sentinels = variableNames.map((_, index) => {
      let sentinel = `emseepea-variable-${index}`;
      while (uriTemplate.includes(sentinel)) sentinel = `_${sentinel}`;
      return sentinel;
    });
    const expanded = template.uriTemplate.expand(
      Object.fromEntries(variableNames.map((name, index) => [name, sentinels[index]!])),
    );
    canonicalResourceUri(expanded);
    const parsed = new URL(expanded);
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("unsupported URI component");
    }
    const segments = parsed.pathname.split("/").map((segment) => {
      const variableIndex = sentinels.indexOf(segment);
      if (variableIndex >= 0) return undefined;
      if (sentinels.some((sentinel) => segment.includes(sentinel))) {
        throw new Error("variable must occupy a path segment");
      }
      return segment;
    });
    if (segments.filter((segment) => segment === undefined).length !== variableNames.length) {
      throw new Error("variable must occupy a path segment");
    }
    return {
      template,
      route: { protocol: parsed.protocol, host: parsed.host, segments },
    };
  } catch {
    throw new TypeError(
      "Resource template must use a fixed scheme and authority with unique whole path-segment variables",
    );
  }
}
function resourceTemplateRoutesOverlap(
  left: ResourceTemplateRoute,
  right: ResourceTemplateRoute,
): boolean {
  return left.protocol === right.protocol && left.host === right.host &&
    left.segments.length === right.segments.length &&
    left.segments.every((segment, index) =>
      segment === undefined || right.segments[index] === undefined || segment === right.segments[index]);
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

function assertResultSize(
  result: unknown,
  maxApplicationResultBytes: number,
  deadlineMs: number,
  signal: AbortSignal,
): void {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(result);
  } catch {
    throw new Error("Result cannot be serialized");
  }
  if (serialized === undefined || Buffer.byteLength(serialized) > maxApplicationResultBytes) {
    throw new Error("Result exceeds configured size limit");
  }
  signal.throwIfAborted();
  if (Date.now() >= deadlineMs) throw new Error("Result preparation exceeded its deadline");
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
