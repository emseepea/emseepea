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
  ProtocolError,
  ProtocolErrorCode,
  ResourceTemplate,
  bearerAuthChallengeResponse,
  buildOAuthProtectedResourceMetadata,
  checkResourceAllowed,
  completable,
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  inputRequired as sdkInputRequired,
  acceptedContent as sdkAcceptedContent,
  inputResponse as sdkInputResponse,
  isInputRequiredResult,
  oauthMetadataResponse,
  specTypeSchemas,
  verifyBearerToken,
  type AuthInfo,
  type AuthMetadataOptions,
  type CallToolResult,
  type CacheHint,
  type GetPromptResult,
  type Icon,
  type InputRequiredResult as SdkInputRequiredResult,
  type InputRequest,
  type InputResponses,
  type InputResponseView as SdkInputResponseView,
  type Implementation,
  type ListPromptsResult,
  type ListResourcesResult,
  type ListResourceTemplatesResult,
  type ListToolsResult,
  type MetaObject,
  type OAuthTokenVerifier,
  type Annotations,
  type Prompt,
  type ReadResourceResult,
  type Resource as McpResource,
  type ResourceTemplateType,
  type StandardSchemaV1,
  type ServerOptions,
  type ToolAnnotations,
  type Tool,
} from "@modelcontextprotocol/server";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";

export * from "./ui.js";
export type ClientInputRequest = Extract<InputRequest, { method: "elicitation/create" }>;
export interface InputRequests {
  readonly [key: string]: ClientInputRequest;
}

export type InputRequiredResult = SdkInputRequiredResult & {
  readonly inputRequests: InputRequests;
  readonly requestState?: never;
};

interface InputRequiredBuilder {
  (spec: { readonly inputRequests: InputRequests }): InputRequiredResult;
  elicit(
    ...args: Parameters<typeof sdkInputRequired.elicit>
  ): Extract<InputRequest, { method: "elicitation/create" }>;
  elicitUrl(
    ...args: Parameters<typeof sdkInputRequired.elicitUrl>
  ): Extract<InputRequest, { method: "elicitation/create" }>;
}

export const inputRequired = Object.assign(
  (spec: { readonly inputRequests: InputRequests }): InputRequiredResult =>
    sdkInputRequired({ inputRequests: spec.inputRequests }) as InputRequiredResult,
  {
    elicit: sdkInputRequired.elicit,
    elicitUrl: sdkInputRequired.elicitUrl,
  },
) as InputRequiredBuilder;

export function acceptedContent<S extends StandardSchemaV1>(
  responses: Readonly<Record<string, unknown>> | undefined,
  key: string,
  schema: S,
): StandardSchemaV1.InferOutput<S> | undefined {
  return sdkAcceptedContent(checkedInputResponses(responses), key, schema);
}

export type InputResponseView = Extract<SdkInputResponseView, { kind: "missing" | "elicit" }>;

export function inputResponse(
  responses: Readonly<Record<string, unknown>> | undefined,
  key: string,
): InputResponseView {
  const response = sdkInputResponse(checkedInputResponses(responses), key);
  return response.kind === "elicit" ? response : { kind: "missing" };
}

const PROTOCOL_VERSION = "2026-07-28";
const REGISTER = Symbol("register");
const TOOL_NAME = Symbol("toolName");
const TOOL_ACCESS = Symbol("toolAccess");
const TOOL_STREAMING = Symbol("toolStreaming");
const TOOL_LISTING = Symbol("toolListing");
const RESOURCE_NAME = Symbol("resourceName");
const RESOURCE_URI = Symbol("resourceUri");
const RESOURCE_KIND = Symbol("resourceKind");
const RESOURCE_MATCHES = Symbol("resourceMatches");
const RESOURCE_ROUTE = Symbol("resourceRoute");
const RESOURCE_LISTING = Symbol("resourceListing");
const PROMPT_NAME = Symbol("promptName");
const HAS_COMPLETION = Symbol("hasCompletion");
const PROMPT_LISTING = Symbol("promptListing");
const CACHEABLE_METHODS = [
  "tools/list",
  "prompts/list",
  "resources/list",
  "resources/templates/list",
  "resources/read",
  "server/discover",
] as const;
type CacheHints = NonNullable<ServerOptions["cacheHints"]>;
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
  /** Client-supplied responses from the current multi-round-trip retry. */
  readonly inputResponses?: Readonly<Record<string, unknown>>;
}
export interface ProgressUpdate {
  readonly progress: number;
  readonly total?: number;
  readonly message?: string;
}
export interface StreamingToolContext<Access extends ToolAccess = ToolAccess>
{
  readonly signal: AbortSignal;
  readonly deadlineMs: number;
  readonly principal: Access extends "public" ? undefined : ToolPrincipal;
  readonly reportProgress: (update: ProgressUpdate) => Promise<void>;
}
export interface ToolResult<Output> { readonly text: string; readonly data: Output }
export interface BackendAdapterContext {
  readonly signal: AbortSignal;
  readonly deadlineMs: number;
}
export type OperationContext = BackendAdapterContext;
export interface ClientInputContext extends OperationContext {
  /** Client-supplied responses from the current multi-round-trip retry. */
  readonly inputResponses?: Readonly<Record<string, unknown>>;
}
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
  readonly icons?: readonly Icon[];
  readonly annotations?: Readonly<ToolAnnotations>;
  readonly _meta?: Readonly<MetaObject>;
  readonly inputSchema: Input;
  readonly outputSchema: Output;
}
export type ToolDefinition<Input extends z.ZodObject, Output extends z.ZodObject> =
  ToolDefinitionBase<Input, Output> & (
    | {
        readonly access: "public";
        readonly requiredScopes?: never;
        readonly handler: (input: z.output<Input>, context: ToolContext<"public">) =>
          ToolResult<z.input<Output>> | InputRequiredResult |
          Promise<ToolResult<z.input<Output>> | InputRequiredResult>;
      }
    | {
        readonly access: "protected";
        readonly requiredScopes: readonly string[];
        readonly handler: (input: z.output<Input>, context: ToolContext<"protected">) =>
          ToolResult<z.input<Output>> | InputRequiredResult |
          Promise<ToolResult<z.input<Output>> | InputRequiredResult>;
      }
  );
export type StreamingToolDefinition<Input extends z.ZodObject, Output extends z.ZodObject> =
  ToolDefinitionBase<Input, Output> & (
    | {
        readonly access: "public";
        readonly requiredScopes?: never;
        readonly handler: (input: z.output<Input>, context: StreamingToolContext<"public">) =>
          ToolResult<z.input<Output>> | Promise<ToolResult<z.input<Output>>>;
      }
    | {
        readonly access: "protected";
        readonly requiredScopes: readonly string[];
        readonly handler: (input: z.output<Input>, context: StreamingToolContext<"protected">) =>
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
  /** Side-effect-free provider check. The tool stays listed while unavailable. */
  readonly isAvailable?: (
    context: BackendAdapterContext,
  ) => boolean | Promise<boolean>;
  readonly mapInput: (input: z.output<Input>) => z.input<BackendInput>;
  readonly adapter: (
    input: z.output<BackendInput>,
    context: BackendAdapterContext,
  ) => unknown | Promise<unknown>;
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
  readonly [TOOL_STREAMING]: boolean;
  readonly [TOOL_LISTING]: Readonly<Record<string, unknown>>;
  readonly [REGISTER]: (
    server: McpServer,
    timeoutMs: number,
    maxApplicationResultBytes: number,
    maxProgressEvents: number,
    maxProgressEventBytes: number,
  ) => void;
}
export interface ResourceDefinition {
  readonly name: string;
  readonly uri: string;
  readonly title?: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly icons?: readonly Icon[];
  readonly annotations?: Readonly<Annotations>;
  readonly size?: number;
  readonly _meta?: Readonly<MetaObject>;
  readonly cacheHint?: CacheHint;
  readonly handler: (context: ClientInputContext) =>
    ReadResourceResult | InputRequiredResult | Promise<ReadResourceResult | InputRequiredResult>;
}
export interface ResourceTemplateDefinition {
  readonly name: string;
  readonly uriTemplate: string;
  readonly title?: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly icons?: readonly Icon[];
  readonly annotations?: Readonly<Annotations>;
  readonly _meta?: Readonly<MetaObject>;
  readonly cacheHint?: CacheHint;
  readonly complete?: Readonly<Record<string, CompletionHandler>>;
  readonly handler: (
    input: {
      readonly uri: string;
      readonly variables: Readonly<Record<string, string | readonly string[]>>;
    },
    context: ClientInputContext,
  ) => ReadResourceResult | InputRequiredResult |
  Promise<ReadResourceResult | InputRequiredResult>;
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
  readonly [RESOURCE_LISTING]: {
    readonly method: "resources/list" | "resources/templates/list";
    readonly value: Readonly<Record<string, unknown>>;
  };
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
  readonly icons?: readonly Icon[];
  readonly _meta?: Readonly<MetaObject>;
  readonly argsSchema: Args;
  readonly complete?: Readonly<Partial<Record<Extract<keyof z.input<Args>, string>, CompletionHandler>>>;
  readonly handler: (
    args: z.output<Args>,
    context: ClientInputContext,
  ) => GetPromptResult | InputRequiredResult | Promise<GetPromptResult | InputRequiredResult>;
} & PromptInputConstraint<Args>;
export interface EmseepeaPrompt {
  readonly [PROMPT_NAME]: string;
  readonly [HAS_COMPLETION]: boolean;
  readonly [PROMPT_LISTING]: Readonly<Record<string, unknown>>;
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
  readonly title?: string;
  readonly description?: string;
  readonly icons?: readonly Icon[];
  readonly websiteUrl?: string;
  readonly instructions?: string;
  readonly tools?: readonly EmseepeaTool[];
  readonly resources?: readonly EmseepeaResource[];
  readonly prompts?: readonly EmseepeaPrompt[];
  readonly listPagination?: ListPaginationOptions;
  readonly cacheHints?: CacheHints;
  readonly maxRequestBytes?: number;
  readonly maxApplicationResultBytes?: number;
  readonly maxProgressEvents?: number;
  readonly maxProgressEventBytes?: number;
  readonly operationTimeoutMs?: number;
  readonly deployment?: DeploymentProfile;
  readonly oauth?: OAuthResourceServerOptions;
}
export interface ListPaginationOptions {
  readonly pageSize: number;
  readonly maxPageBytes?: number;
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
  ) => ToolResult<z.input<Output>> | InputRequiredResult |
  Promise<ToolResult<z.input<Output>> | InputRequiredResult>;
  return createCheckedTool(definition, handler as CheckedToolExecutor, false, true);
}

export function defineStreamingTool<Input extends z.ZodObject, Output extends z.ZodObject>(
  definition: StreamingToolDefinition<Input, Output>,
): EmseepeaTool {
  const handler = definition.handler as unknown as CheckedToolExecutor;
  return createCheckedTool(definition, handler, true, false);
}

export function defineMappedTool<
  Input extends z.ZodObject,
  Output extends z.ZodObject,
  BackendInput extends z.ZodObject,
  BackendOutput extends z.ZodObject,
>(definition: MappedToolDefinition<Input, Output, BackendInput, BackendOutput>): EmseepeaTool {
  const { backendInputSchema, backendOutputSchema, isAvailable, adapter } = definition;
  const mapInput = definition.mapInput as unknown as (
    input: z.output<Input>,
  ) => z.input<BackendInput>;
  const mapOutput = definition.mapOutput as unknown as (
    output: z.output<BackendOutput>,
  ) => ToolResult<z.input<Output>>;
  const execute = async (input: z.output<Input>, context: ToolContext) => {
    const adapterContext = Object.freeze({
      signal: context.signal,
      deadlineMs: context.deadlineMs,
    });
    context.signal.throwIfAborted();
    if (isAvailable && await isAvailable(adapterContext) !== true) {
      throw new Error("Mapped tool provider is unavailable");
    }
    context.signal.throwIfAborted();
    const command = await backendInputSchema.safeParseAsync(mapInput(input));
    if (!command.success) throw new Error("Mapped backend command does not match its schema");
    context.signal.throwIfAborted();
    const backendResult = await adapter(command.data, adapterContext);
    context.signal.throwIfAborted();
    const parsedBackendResult = await backendOutputSchema.safeParseAsync(backendResult);
    if (!parsedBackendResult.success) throw new Error("Backend result does not match its schema");
    context.signal.throwIfAborted();
    return mapOutput(parsedBackendResult.data);
  };
  return createCheckedTool(definition, execute as CheckedToolExecutor, false, false);
}

export function defineResource(definition: ResourceDefinition): EmseepeaResource {
  const { name, handler } = definition;
  assertRegistrationName("Resource", name);
  const uri = canonicalResourceUri(definition.uri);
  const listing = checkedProtocolValue<McpResource>("Resource", {
    name,
    uri,
    title: definition.title,
    description: definition.description,
    mimeType: definition.mimeType,
    icons: definition.icons,
    annotations: definition.annotations,
    size: definition.size,
    _meta: definition._meta,
  });
  const metadata = Object.freeze({
    title: listing.title,
    description: listing.description,
    mimeType: listing.mimeType,
    icons: listing.icons,
    annotations: listing.annotations,
    size: listing.size,
    _meta: listing._meta,
  });
  const cacheHint = definition.cacheHint === undefined
    ? undefined
    : normalizeCacheHint(definition.cacheHint, `resource ${name}`);
  const registration: EmseepeaResource = {
    [RESOURCE_NAME]: name,
    [RESOURCE_URI]: uri,
    [RESOURCE_KIND]: "static",
    [RESOURCE_LISTING]: Object.freeze({
      method: "resources/list",
      value: listing,
    }),
    [HAS_COMPLETION]: false,
    [REGISTER](server, timeoutMs, maxApplicationResultBytes) {
      server.registerResource(
        name,
        uri,
        cacheHint ? { ...metadata, cacheHint } : metadata,
        async (_requestedUri, context): Promise<ReadResourceResult | InputRequiredResult> => {
          try {
            const deadlineMs = requestOperations.getStore()?.deadlineMs ?? Date.now() + timeoutMs;
            return await runWithDeadline(context.mcpReq.signal, deadlineMs, async (signal) => {
              signal.throwIfAborted();
              const result = await handler({
                signal,
                deadlineMs,
                inputResponses: checkedInputResponses(context.mcpReq.inputResponses),
              });
              signal.throwIfAborted();
              if (isInputRequiredResult(result)) {
                assertStatelessInputRequired(result);
                assertResultSize(result, maxApplicationResultBytes, deadlineMs, signal);
                return result as InputRequiredResult;
              }
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
  const { name, handler } = definition;
  assertRegistrationName("Resource template", name);
  const { template, route } = checkedResourceTemplate(definition.uriTemplate);
  const uriTemplate = template.uriTemplate.toString();
  const listing = checkedProtocolValue<ResourceTemplateType>("ResourceTemplate", {
    name,
    uriTemplate,
    title: definition.title,
    description: definition.description,
    mimeType: definition.mimeType,
    icons: definition.icons,
    annotations: definition.annotations,
    _meta: definition._meta,
  });
  const metadata = Object.freeze({
    title: listing.title,
    description: listing.description,
    mimeType: listing.mimeType,
    icons: listing.icons,
    annotations: listing.annotations,
    _meta: listing._meta,
  });
  const cacheHint = definition.cacheHint === undefined
    ? undefined
    : normalizeCacheHint(definition.cacheHint, `resource template ${name}`);
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
    [RESOURCE_LISTING]: Object.freeze({
      method: "resources/templates/list",
      value: listing,
    }),
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
        cacheHint ? { ...metadata, cacheHint } : metadata,
        async (requestedUri, variables, context): Promise<ReadResourceResult | InputRequiredResult> => {
          try {
            const deadlineMs = requestOperations.getStore()?.deadlineMs ?? Date.now() + timeoutMs;
            return await runWithDeadline(context.mcpReq.signal, deadlineMs, async (signal) => {
              signal.throwIfAborted();
              const result = await handler(
                { uri: requestedUri.href, variables },
                {
                  signal,
                  deadlineMs,
                  inputResponses: checkedInputResponses(context.mcpReq.inputResponses),
                },
              );
              signal.throwIfAborted();
              if (isInputRequiredResult(result)) {
                assertStatelessInputRequired(result);
                assertResultSize(result, maxApplicationResultBytes, deadlineMs, signal);
                return result as InputRequiredResult;
              }
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
  const { name, argsSchema, handler } = definition;
  assertRegistrationName("Prompt", name);
  const argumentNames = Object.keys(argsSchema.shape);
  const completions = checkedCompletionHandlers("Prompt", definition.complete, argumentNames);
  const listing = checkedProtocolValue<Prompt>("Prompt", {
    name,
    title: definition.title,
    description: definition.description,
    icons: definition.icons,
    _meta: definition._meta,
    arguments: promptArguments(argsSchema),
  });
  const metadata = Object.freeze({
    title: listing.title,
    description: listing.description,
    icons: listing.icons,
    _meta: listing._meta,
  });
  const registration: EmseepeaPrompt = {
    [PROMPT_NAME]: name,
    [HAS_COMPLETION]: completions.size > 0,
    [PROMPT_LISTING]: listing,
    [REGISTER](server, timeoutMs, maxApplicationResultBytes) {
      server.registerPrompt(
        name,
        {
          ...metadata,
          argsSchema: sdkPromptMetadataSchema(
            argsSchema,
            completions,
            argumentNames,
            timeoutMs,
            maxApplicationResultBytes,
          ),
        },
        async (args, context): Promise<GetPromptResult | InputRequiredResult> => {
          try {
            const deadlineMs = requestOperations.getStore()?.deadlineMs ?? Date.now() + timeoutMs;
            return await runWithDeadline(context.mcpReq.signal, deadlineMs, async (signal) => {
              const parsedArgs = await argsSchema.safeParseAsync(args);
              if (!parsedArgs.success) throw new Error("Prompt received invalid arguments");
              signal.throwIfAborted();
              const result = await handler(parsedArgs.data, {
                signal,
                deadlineMs,
                inputResponses: checkedInputResponses(context.mcpReq.inputResponses),
              });
              signal.throwIfAborted();
              if (isInputRequiredResult(result)) {
                assertStatelessInputRequired(result);
                assertResultSize(result, maxApplicationResultBytes, deadlineMs, signal);
                return result as InputRequiredResult;
              }
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
  readonly icons?: readonly Icon[];
  readonly annotations?: Readonly<ToolAnnotations>;
  readonly _meta?: Readonly<MetaObject>;
  readonly inputSchema: z.ZodObject;
  readonly outputSchema: z.ZodObject;
  readonly access: ToolAccess;
  readonly requiredScopes?: readonly string[];
}
type CheckedToolExecutor = (
  input: unknown,
  context: ToolContext,
) => unknown | Promise<unknown>;

const progressUpdateSchema = z.strictObject({
  progress: z.number().nonnegative(),
  total: z.number().positive().optional(),
  message: z.string().optional(),
});

function createCheckedTool(
  definition: CheckedToolDefinition,
  execute: CheckedToolExecutor,
  streaming: boolean,
  allowsInputRequired: boolean,
): EmseepeaTool {
  const { name, inputSchema, outputSchema } = definition;
  assertRegistrationName("Tool", name);
  assertValidMcpHeaderAnnotations(inputSchema);
  const access = normalizeToolAccess(definition.access, definition.requiredScopes);
  const publicAccess = access === "public"
    ? Object.freeze({ type: "public" as const })
    : Object.freeze({ type: "protected" as const, requiredScopes: [...access.requiredScopes] });
  const sdkInputSchema = sdkMetadataSchema(inputSchema);
  const sdkOutputSchema = sdkMetadataSchema(outputSchema);
  const listing = checkedProtocolValue<Tool>("Tool", {
    name,
    title: definition.title,
    description: definition.description,
    icons: definition.icons,
    annotations: definition.annotations,
    inputSchema: jsonMetadataSchema(inputSchema, "input"),
    outputSchema: jsonMetadataSchema(outputSchema, "output"),
    _meta: {
      ...definition._meta,
      "io.emseepea/access": publicAccess,
    },
  });
  const metadata = Object.freeze({
    title: listing.title,
    description: listing.description,
    icons: listing.icons,
    annotations: listing.annotations,
    inputSchema: sdkInputSchema,
    outputSchema: sdkOutputSchema,
    _meta: listing._meta,
  });
  const registration: EmseepeaTool = {
    [TOOL_NAME]: name,
    [TOOL_ACCESS]: access,
    [TOOL_STREAMING]: streaming,
    [TOOL_LISTING]: listing,
    [REGISTER](server, timeoutMs, maxApplicationResultBytes, maxProgressEvents, maxProgressEventBytes) {
      server.registerTool(
        name,
        metadata,
        async (input, context): Promise<CallToolResult | InputRequiredResult> => {
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
                const reporter = streaming
                  ? progressReporter(
                      context,
                      signal,
                      maxProgressEvents,
                      maxProgressEventBytes,
                    )
                  : undefined;
                let result: unknown;
                try {
                  result = await execute(parsedInput.data, {
                    signal,
                    deadlineMs,
                    principal: access === "public" ? undefined : principalFrom(context.http?.authInfo),
                    ...(allowsInputRequired
                      ? {
                          inputResponses: checkedInputResponses(context.mcpReq.inputResponses),
                        }
                      : {}),
                    ...(reporter ? { reportProgress: reporter.report } : {}),
                  });
                } finally {
                  await reporter?.finish();
                }
                reporter?.throwIfFailed();
                if (allowsInputRequired && isInputRequiredResult(result)) {
                  signal.throwIfAborted();
                  assertStatelessInputRequired(result);
                  assertResultSize(result, maxApplicationResultBytes, deadlineMs, signal);
                  return result as InputRequiredResult;
                }
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

function progressReporter(
  context: {
    readonly mcpReq: {
      readonly _meta?: { readonly progressToken?: unknown };
      readonly notify: (notification: {
        readonly method: "notifications/progress";
        readonly params: {
          readonly progressToken: string | number;
          readonly progress: number;
          readonly total?: number;
          readonly message?: string;
        };
      }) => Promise<void>;
    };
  },
  signal: AbortSignal,
  maxEvents: number,
  maxEventBytes: number,
): {
  readonly report: (update: ProgressUpdate) => Promise<void>;
  readonly finish: () => Promise<void>;
  readonly throwIfFailed: () => void;
} {
  const token = context.mcpReq._meta?.progressToken;
  let closed = false;
  let failure: Error | undefined;
  let attempts = 0;
  let previousProgress = -Infinity;
  const pending = new Set<Promise<void>>();
  return {
    report(update) {
      if (closed) return Promise.reject(new Error("Progress is no longer available"));
      if (failure) return Promise.reject(failure);
      const operation = (async () => {
        try {
          signal.throwIfAborted();
          attempts += 1;
          if (attempts > maxEvents) throw new Error("Progress event limit exceeded");
          const parsed = progressUpdateSchema.safeParse(update);
          if (!parsed.success || parsed.data.progress <= previousProgress ||
              (parsed.data.total !== undefined && parsed.data.progress > parsed.data.total)) {
            throw new Error("Progress update is invalid");
          }
          previousProgress = parsed.data.progress;
          if (token !== undefined && typeof token !== "string" && typeof token !== "number") {
            throw new Error("Progress token is invalid");
          }
          const notification = {
            method: "notifications/progress" as const,
            params: { progressToken: token ?? 0, ...parsed.data },
          };
          if (Buffer.byteLength(JSON.stringify(notification), "utf8") > maxEventBytes) {
            throw new Error("Progress event exceeds configured size limit");
          }
          if (token !== undefined) await context.mcpReq.notify(notification);
        } catch (error) {
          failure = error instanceof Error ? error : new Error("Progress emission failed");
          throw error;
        }
      })();
      pending.add(operation);
      void operation.then(() => pending.delete(operation), () => pending.delete(operation));
      return operation;
    },
    async finish() {
      closed = true;
      await Promise.allSettled([...pending]);
    },
    throwIfFailed() { if (failure) throw failure; },
  };
}

type ListMethod =
  | "tools/list"
  | "resources/list"
  | "resources/templates/list"
  | "prompts/list";
interface NormalizedListPagination { readonly pageSize: number; readonly maxPageBytes: number }
interface CompiledCataloguePages {
  readonly first: Readonly<Record<string, unknown>>;
  readonly byCursor: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
}
type CompiledListPagination = ReadonlyMap<ListMethod, CompiledCataloguePages>;

function normalizeListPagination(options: ListPaginationOptions): NormalizedListPagination {
  const pageSize = positiveInteger("listPagination.pageSize", options.pageSize);
  if (pageSize > 100) throw new TypeError("listPagination.pageSize must not exceed 100");
  return Object.freeze({
    pageSize,
    maxPageBytes: positiveInteger(
      "listPagination.maxPageBytes",
      options.maxPageBytes ?? 1024 * 1024,
    ),
  });
}

function compileListPagination(
  options: NormalizedListPagination,
  catalogues: ReadonlyMap<ListMethod, readonly Readonly<Record<string, unknown>>[]>,
): CompiledListPagination {
  const compiled = new Map<ListMethod, CompiledCataloguePages>();
  for (const [method, entries] of catalogues) {
    if (entries.length === 0) continue;
    const resultKey = method === "tools/list"
      ? "tools"
      : method === "prompts/list"
        ? "prompts"
        : method === "resources/templates/list"
          ? "resourceTemplates"
          : "resources";
    compiled.set(method, compileCataloguePages(method, resultKey, entries, options));
  }
  return compiled;
}

function compileCataloguePages(
  method: ListMethod,
  resultKey: string,
  entries: readonly Readonly<Record<string, unknown>>[],
  options: NormalizedListPagination,
): CompiledCataloguePages {
  const groups: Readonly<Record<string, unknown>>[][] = [];
  for (let index = 0; index < entries.length;) {
    const group: Readonly<Record<string, unknown>>[] = [];
    while (group.length < options.pageSize && index < entries.length) {
      const candidate = [...group, entries[index]!];
      const hasNext = index + 1 < entries.length;
      if (cataloguePageBytes(resultKey, candidate, hasNext) > options.maxPageBytes) {
        if (group.length === 0) {
          throw new TypeError(`${method} has an entry larger than listPagination.maxPageBytes`);
        }
        break;
      }
      group.push(entries[index]!);
      index += 1;
    }
    groups.push(group);
  }

  const catalogueDigest = createHash("sha256").update(JSON.stringify(entries)).digest("base64url");
  const cursorFor = (page: number) => createHash("sha256").update([
    "emseepea-list-cursor-v1",
    method,
    String(page),
    String(options.pageSize),
    String(options.maxPageBytes),
    catalogueDigest,
  ].join("\n")).digest("base64url");
  const pages = groups.map((group, index) => Object.freeze({
    [resultKey]: Object.freeze([...group]),
    ...(index + 1 < groups.length ? { nextCursor: cursorFor(index + 1) } : {}),
  }));
  const byCursor = new Map<string, Readonly<Record<string, unknown>>>();
  for (let index = 1; index < pages.length; index += 1) {
    byCursor.set(cursorFor(index), pages[index]!);
  }
  return Object.freeze({ first: pages[0]!, byCursor });
}

function cataloguePageBytes(
  resultKey: string,
  entries: readonly Readonly<Record<string, unknown>>[],
  hasNext: boolean,
): number {
  return Buffer.byteLength(JSON.stringify({
    [resultKey]: entries,
    ...(hasNext ? { nextCursor: "x".repeat(43) } : {}),
  }), "utf8");
}

function paginationPage(
  pages: CompiledCataloguePages,
  cursor: string | undefined,
): Readonly<Record<string, unknown>> {
  if (cursor === undefined) return pages.first;
  const page = /^[A-Za-z0-9_-]{43}$/.test(cursor) ? pages.byCursor.get(cursor) : undefined;
  if (!page) throw new ProtocolError(ProtocolErrorCode.InvalidParams, "Invalid pagination cursor");
  return page;
}

function installListPagination(server: McpServer, pagination: CompiledListPagination): void {
  const tools = pagination.get("tools/list");
  if (tools) server.server.setRequestHandler(
    "tools/list",
    (request) => paginationPage(tools, request.params?.cursor) as unknown as ListToolsResult,
  );
  const resources = pagination.get("resources/list");
  if (resources) server.server.setRequestHandler(
    "resources/list",
    (request) => paginationPage(resources, request.params?.cursor) as unknown as ListResourcesResult,
  );
  const templates = pagination.get("resources/templates/list");
  if (templates) server.server.setRequestHandler(
    "resources/templates/list",
    (request) => paginationPage(templates, request.params?.cursor) as unknown as ListResourceTemplatesResult,
  );
  const prompts = pagination.get("prompts/list");
  if (prompts) server.server.setRequestHandler(
    "prompts/list",
    (request) => paginationPage(prompts, request.params?.cursor) as unknown as ListPromptsResult,
  );
}

export function createEmseepea(options: EmseepeaOptions): FastifyInstance {
  assertNonEmpty("name", options.name);
  assertNonEmpty("version", options.version);
  const serverInfo = checkedProtocolValue<Implementation>("Implementation", {
    name: options.name,
    version: options.version,
    title: options.title,
    description: options.description,
    icons: options.icons,
    websiteUrl: options.websiteUrl,
  });
  const tools = Object.freeze([...(options.tools ?? [])]);
  const resources = Object.freeze([...(options.resources ?? [])]);
  const prompts = Object.freeze([...(options.prompts ?? [])]);
  assertUniqueToolNames(tools);
  assertUniqueResources(resources);
  assertUniquePromptNames(prompts);
  const paginationOptions = options.listPagination
    ? normalizeListPagination(options.listPagination)
    : undefined;
  const maxRequestBytes = positiveInteger("maxRequestBytes", options.maxRequestBytes ?? 1024 * 1024);
  const maxApplicationResultBytes = positiveInteger(
    "maxApplicationResultBytes",
    options.maxApplicationResultBytes ?? 1024 * 1024,
  );
  const maxProgressEvents = positiveInteger(
    "maxProgressEvents",
    options.maxProgressEvents ?? 32,
  );
  const maxProgressEventBytes = positiveInteger(
    "maxProgressEventBytes",
    options.maxProgressEventBytes ?? 8 * 1024,
  );
  const operationTimeoutMs = positiveInteger(
    "operationTimeoutMs",
    options.operationTimeoutMs ?? 30_000,
  );
  const deployment = normalizeDeployment(options.deployment ?? { mode: "loopback" });
  const oauth = options.oauth ? normalizeOAuth(options.oauth) : undefined;
  const hasStreaming = tools.some((tool) => tool[TOOL_STREAMING]);
  if (deployment.mode !== "loopback" &&
      tools.some((tool) => tool[TOOL_STREAMING] && tool[TOOL_ACCESS] !== "public")) {
    throw new TypeError("Protected streaming tools currently require the loopback deployment profile");
  }
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
  const cacheHints = options.cacheHints === undefined
    ? undefined
    : normalizeCacheHints(options.cacheHints, enabledMethods);
  const pagination = paginationOptions
    ? compileListPagination(paginationOptions, new Map([
        ["tools/list", tools.map((tool) => tool[TOOL_LISTING])],
        ["resources/list", resources
          .filter((resource) => resource[RESOURCE_LISTING].method === "resources/list")
          .map((resource) => resource[RESOURCE_LISTING].value)],
        ["resources/templates/list", resources
          .filter((resource) => resource[RESOURCE_LISTING].method === "resources/templates/list")
          .map((resource) => resource[RESOURCE_LISTING].value)],
        ["prompts/list", prompts.map((prompt) => prompt[PROMPT_LISTING])],
      ] as const))
    : undefined;

  const sdkHandler = createMcpHandler(() => {
    const server = new McpServer(
      serverInfo,
      {
        capabilities: {
          ...(tools.length ? { tools: { listChanged: false } } : {}),
          ...(resources.length ? { resources: { subscribe: false, listChanged: false } } : {}),
          ...(prompts.length ? { prompts: { listChanged: false } } : {}),
          ...(hasCompletion ? { completions: {} } : {}),
        },
        instructions: options.instructions,
        cacheHints,
        supportedProtocolVersions: [PROTOCOL_VERSION],
      },
    );
    for (const tool of tools) {
      tool[REGISTER](
        server,
        operationTimeoutMs,
        maxApplicationResultBytes,
        maxProgressEvents,
        maxProgressEventBytes,
      );
    }
    for (const resource of resources) resource[REGISTER](server, operationTimeoutMs, maxApplicationResultBytes);
    for (const prompt of prompts) prompt[REGISTER](server, operationTimeoutMs, maxApplicationResultBytes);
    if (pagination) installListPagination(server, pagination);
    return server;
  }, {
    legacy: "reject",
    responseMode: hasStreaming ? "auto" : "json",
    keepAliveMs: 0,
  });
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
    if (!await validateMcpRequestHeaders(request, reply)) return;
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
    if (requestAlreadyClosed(request, reply)) abort();
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
  if (requestAlreadyClosed(request, reply)) abort();
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

function requestAlreadyClosed(request: FastifyRequest, reply: FastifyReply): boolean {
  return request.raw.aborted || (request.raw.destroyed && !request.raw.complete) || reply.raw.destroyed;
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
  data?: Readonly<Record<string, unknown>>,
): Promise<void> {
  await reply.code(status).send({
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data ? { data } : {}) },
  });
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

async function validateMcpRequestHeaders(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const body = request.body;
  const id = isRecord(body) ? requestId(body.id) : null;
  if (!acceptsMcpResponses(request.headers.accept)) {
    await sendRpcError(
      reply,
      406,
      -32000,
      "Not Acceptable: Client must accept both application/json and text/event-stream",
      id,
    );
    return false;
  }
  if (!isRecord(body) || typeof body.method !== "string") return true;
  const header = (name: string) => singleHeader(request.raw.rawHeaders, name);
  const rejectMismatch = async (name: string) => {
    await sendRpcError(reply, 400, -32020, `Missing or mismatched ${name} header`, id);
    return false;
  };
  const protocolVersion = header("mcp-protocol-version");
  if (!protocolVersion) return rejectMismatch("MCP-Protocol-Version");
  const params = isRecord(body.params) ? body.params : undefined;
  const meta = params && isRecord(params._meta) ? params._meta : undefined;
  const bodyVersion = meta?.["io.modelcontextprotocol/protocolVersion"];
  if (typeof bodyVersion !== "string" || protocolVersion !== bodyVersion) {
    return rejectMismatch("MCP-Protocol-Version");
  }
  if (protocolVersion !== PROTOCOL_VERSION) {
    await sendRpcError(
      reply,
      400,
      ProtocolErrorCode.UnsupportedProtocolVersion,
      `Unsupported protocol version: ${protocolVersion}`,
      id,
      { requested: protocolVersion, supported: [PROTOCOL_VERSION] },
    );
    return false;
  }
  if (header("mcp-method") !== body.method) return rejectMismatch("Mcp-Method");

  const nameField = body.method === "tools/call" || body.method === "prompts/get"
    ? "name"
    : body.method === "resources/read"
      ? "uri"
      : undefined;
  if (!nameField) return true;
  if (!params || typeof params[nameField] !== "string") return rejectMismatch("Mcp-Name");
  const name = header("mcp-name");
  if (!name || decodeMcpHeaderValue(name) !== params[nameField]) return rejectMismatch("Mcp-Name");
  return true;
}

function acceptsMcpResponses(value: string | string[] | undefined): boolean {
  const types = (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((header) => header.split(","))
    .filter((part) => !part.split(";").slice(1).some((parameter) =>
      /^\s*q\s*=\s*0(?:\.0*)?\s*$/i.test(parameter)))
    .map((part) => part.split(";", 1)[0]?.trim().toLowerCase());
  return types.includes("application/json") && types.includes("text/event-stream");
}

function decodeMcpHeaderValue(value: string): string | undefined {
  const normalized = value.replace(/^[\t ]+|[\t ]+$/g, "");
  const prefix = "=?base64?";
  if (!normalized.startsWith(prefix) || !normalized.endsWith("?=")) {
    return /^[\x20-\x7E\t]*$/.test(normalized) ? normalized : undefined;
  }
  const encoded = normalized.slice(prefix.length, -2);
  if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    return undefined;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(encoded, "base64"));
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCacheHint(value: unknown, field: string): Readonly<CacheHint> {
  if (!isRecord(value)) throw new TypeError(`${field} cacheHint must be an object`);
  const unknownField = Object.keys(value).find((key) => key !== "ttlMs" && key !== "cacheScope");
  if (unknownField) throw new TypeError(`${field} cacheHint has an unknown field: ${unknownField}`);
  const { ttlMs, cacheScope } = value;
  if (ttlMs !== undefined && (!Number.isSafeInteger(ttlMs) || (ttlMs as number) < 0)) {
    throw new TypeError(`${field} cacheHint.ttlMs must be a non-negative safe integer`);
  }
  if (cacheScope !== undefined && cacheScope !== "public" && cacheScope !== "private") {
    throw new TypeError(`${field} cacheHint.cacheScope must be public or private`);
  }
  return Object.freeze({
    ...(ttlMs === undefined ? {} : { ttlMs: ttlMs as number }),
    ...(cacheScope === undefined ? {} : { cacheScope }),
  });
}

function normalizeCacheHints(value: unknown, enabledMethods: ReadonlySet<string>): CacheHints {
  if (!isRecord(value)) throw new TypeError("cacheHints must be an object");
  const allowed = new Set<string>(CACHEABLE_METHODS);
  const normalized: Partial<Record<(typeof CACHEABLE_METHODS)[number], Readonly<CacheHint>>> = {};
  for (const [method, hint] of Object.entries(value)) {
    if (!allowed.has(method)) throw new TypeError(`cacheHints has an unknown method: ${method}`);
    if (hint === undefined) continue;
    if (!enabledMethods.has(method)) throw new TypeError(`cacheHints cannot configure disabled method: ${method}`);
    normalized[method as (typeof CACHEABLE_METHODS)[number]] = normalizeCacheHint(
      hint,
      `cacheHints.${method}`,
    );
  }
  return Object.freeze(normalized) as CacheHints;
}

function checkedInputResponses(
  responses: Readonly<Record<string, unknown>> | undefined,
): InputResponses | undefined {
  if (!responses) return undefined;
  const checked: InputResponses = {};
  for (const [key, value] of Object.entries(responses)) {
    const elicitation = specTypeSchemas.ElicitResult["~standard"].validate(value);
    if ("value" in elicitation) {
      checked[key] = elicitation.value;
      continue;
    }
  }
  return checked;
}

function checkedProtocolValue<T>(
  type: "Implementation" | "Prompt" | "Resource" | "ResourceTemplate" | "Tool",
  value: unknown,
): Readonly<T> {
  let copy: unknown;
  try {
    assertJsonValue(value, new WeakSet<object>(), true);
    const encoded = JSON.stringify(structuredClone(value));
    if (encoded === undefined) throw new TypeError("value is not JSON data");
    copy = JSON.parse(encoded) as unknown;
  } catch {
    throw new TypeError(`${type} metadata must be JSON data`);
  }
  const schema = specTypeSchemas[type] as StandardSchemaV1;
  const result = schema["~standard"].validate(copy);
  if (result instanceof Promise || "issues" in result) {
    throw new TypeError(`${type} metadata does not match the MCP schema`);
  }
  return deepFreeze(result.value) as Readonly<T>;
}

function assertJsonValue(
  value: unknown,
  seen: WeakSet<object>,
  allowUndefinedProperties = false,
): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("number must be finite");
    return;
  }
  if (typeof value !== "object") throw new TypeError("value is not JSON data");
  if (seen.has(value)) throw new TypeError("value is cyclic");
  seen.add(value);
  if (Array.isArray(value)) {
    if (Reflect.ownKeys(value).length !== value.length + 1) {
      throw new TypeError("JSON arrays must contain only indexed values");
    }
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) throw new TypeError("array must not be sparse");
      assertJsonValue(value[index], seen);
    }
    seen.delete(value);
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("object must be a plain JSON object");
  }
  if (Reflect.ownKeys(value).length !== Object.keys(value).length) {
    throw new TypeError("JSON object keys must be enumerable strings");
  }
  for (const child of Object.values(value)) {
    if (child === undefined && allowUndefinedProperties) continue;
    assertJsonValue(child, seen);
  }
  seen.delete(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function jsonMetadataSchema(
  schema: z.ZodObject,
  io: "input" | "output",
): Record<string, unknown> {
  return { ...z.toJSONSchema(schema, { target: "draft-2020-12", io }) };
}

function promptArguments(schema: z.ZodObject): readonly Readonly<Record<string, unknown>>[] {
  const jsonSchema = jsonMetadataSchema(schema, "input");
  const properties = isRecord(jsonSchema.properties) ? jsonSchema.properties : {};
  const required = new Set(Array.isArray(jsonSchema.required) ? jsonSchema.required : []);
  return Object.freeze(Object.entries(properties).map(([name, property]) => Object.freeze({
    name,
    ...(isRecord(property) && typeof property.description === "string"
      ? { description: property.description }
      : {}),
    required: required.has(name),
  })));
}

function sdkMetadataSchema(schema: z.ZodObject): z.ZodObject {
  return {
    "~standard": {
      version: 1,
      vendor: "emseepea",
      validate: (value: unknown) => ({ value }),
      jsonSchema: {
        input: () => jsonMetadataSchema(schema, "input"),
        output: () => jsonMetadataSchema(schema, "output"),
      },
    },
  } as unknown as z.ZodObject;
}

const MCP_HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function assertValidMcpHeaderAnnotations(schema: z.ZodObject): void {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" });
  const names = new Set<string>();

  function visit(value: unknown, path: string[], reachable: boolean): void {
    if (!isRecord(value)) return;
    if ("x-mcp-header" in value) {
      const name = value["x-mcp-header"];
      const location = path.join(".") || "the schema root";
      if (!reachable || path.length === 0) {
        throw new TypeError(`Tool x-mcp-header at ${location} is not reachable through properties`);
      }
      if (typeof name !== "string" || !MCP_HEADER_NAME.test(name)) {
        throw new TypeError(`Tool x-mcp-header at ${location} must be a non-empty HTTP header token`);
      }
      if (value.type !== "string" && value.type !== "integer" && value.type !== "boolean") {
        throw new TypeError(`Tool x-mcp-header at ${location} must describe a string, integer, or boolean`);
      }
      const normalized = name.toLowerCase();
      if (names.has(normalized)) {
        throw new TypeError(`Tool x-mcp-header name is duplicated: ${name}`);
      }
      names.add(normalized);
    }

    if (isRecord(value.properties)) {
      for (const [property, propertySchema] of Object.entries(value.properties)) {
        visit(propertySchema, [...path, property], reachable);
      }
    }
    for (const key of ["prefixItems", "oneOf", "anyOf", "allOf"] as const) {
      const schemas = value[key];
      if (Array.isArray(schemas)) for (const child of schemas) visit(child, path, false);
    }
    for (const key of [
      "items", "contains", "additionalProperties", "unevaluatedProperties",
      "unevaluatedItems", "propertyNames", "not", "if", "then", "else",
    ] as const) {
      visit(value[key], path, false);
    }
    for (const key of ["patternProperties", "dependentSchemas", "$defs", "definitions"] as const) {
      const schemas = value[key];
      if (isRecord(schemas)) for (const child of Object.values(schemas)) visit(child, path, false);
    }
  }

  visit(jsonSchema, [], true);
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

function assertStatelessInputRequired(
  result: SdkInputRequiredResult,
): asserts result is InputRequiredResult {
  if (!result.inputRequests || result.requestState !== undefined) {
    throw new Error("Client-input requests must be stateless");
  }
  if (Object.values(result.inputRequests).some((request) => request.method !== "elicitation/create")) {
    throw new Error("Client-input request kind is not supported");
  }
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
