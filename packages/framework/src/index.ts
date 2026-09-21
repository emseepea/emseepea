import { createMcpFastifyApp } from "@modelcontextprotocol/fastify";
import {
  GetPromptResultSchema,
  ReadResourceResultSchema,
} from "@modelcontextprotocol/core";
import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  McpServer,
  InMemoryServerEventBus,
  OAuthError,
  OAuthErrorCode,
  ProtocolError,
  ProtocolErrorCode,
  ResourceTemplate,
  bearerAuthChallengeResponse,
  buildOAuthProtectedResourceMetadata,
  checkResourceAllowed,
  classifyInboundRequest,
  completable,
  createMcpHandler,
  createRequestStateCodec,
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
  type LoggingLevel,
  type JSONValue,
  type MetaObject,
  type OAuthTokenVerifier,
  type Annotations,
  type Prompt,
  type ReadResourceResult,
  type Resource as McpResource,
  type ResourceTemplateType,
  type StandardSchemaWithJSON,
  type StandardSchemaV1,
  type ServerOptions,
  type ServerEvent,
  type ServerEventBus,
  type ServerContext,
  type ToolAnnotations,
  type Tool,
} from "@modelcontextprotocol/server";
import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteHandlerMethod,
} from "fastify";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { readdir, realpath } from "node:fs/promises";
import { isIP } from "node:net";
import { isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import {
  installObservability,
  observabilityState,
  type CallerClassification,
  type ObservabilityAdapter,
  type ObservabilityState,
} from "./telemetry.js";

export {
  openTelemetry,
  structuredLogging,
  type CallerClassification,
  type ObservabilityAdapter,
  type ObservabilityEvent,
  type ObservedForwardingRefusal,
  type ObservedHttpMethod,
  type ObservedMcpMethod,
  type ObservedProtocolOutcome,
} from "./telemetry.js";

export * from "./ui.js";
export type ClientInputRequest = Extract<InputRequest, { method: "elicitation/create" | "roots/list" }>;
export interface InputRequests {
  readonly [key: string]: ClientInputRequest;
}

declare const REQUEST_STATE: unique symbol;
export type RequestState = string & { readonly [REQUEST_STATE]: true };

type InputRequiredSpec =
  | { readonly inputRequests: InputRequests; readonly requestState?: RequestState }
  | { readonly inputRequests?: never; readonly requestState: RequestState };

export type InputRequiredResult = SdkInputRequiredResult & InputRequiredSpec;

interface InputRequiredBuilder {
  (spec: InputRequiredSpec): InputRequiredResult;
  roots(): Extract<InputRequest, { method: "roots/list" }>;
  elicit(
    ...args: Parameters<typeof sdkInputRequired.elicit>
  ): Extract<InputRequest, { method: "elicitation/create" }>;
  elicitUrl(
    ...args: Parameters<typeof sdkInputRequired.elicitUrl>
  ): Extract<InputRequest, { method: "elicitation/create" }>;
}

export const inputRequired = Object.assign(
  (spec: InputRequiredSpec): InputRequiredResult =>
    sdkInputRequired(spec) as InputRequiredResult,
  {
    roots: sdkInputRequired.listRoots,
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

declare const CHECKED_INPUT_RESPONSES: unique symbol;
export type CheckedInputResponses = Readonly<Record<string, unknown>> & {
  readonly [CHECKED_INPUT_RESPONSES]: true;
};
export interface ClientRoot {
  readonly uri: string;
  readonly name?: string;
  readonly _meta?: Readonly<MetaObject>;
}
const checkedRootsResponses = new WeakSet<object>();

/** Reads roots validated by the framework; missing keys return undefined. */
export function rootsResponse(
  responses: CheckedInputResponses | undefined,
  key: string,
): readonly ClientRoot[] | undefined {
  if (responses === undefined) return undefined;
  if (!checkedRootsResponses.has(responses)) throw new TypeError("Roots responses have not been checked");
  if (!Object.hasOwn(responses, key)) return undefined;
  const value = responses[key];
  if (!isRecord(value) || !Array.isArray(value.roots)) throw new TypeError("Response is not roots");
  return value.roots as readonly ClientRoot[];
}

const PROTOCOL_VERSION = "2026-07-28";
const LEGACY_PROTOCOL_VERSIONS = Object.freeze([
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07",
]);
const SUPPORTED_PROTOCOLS = Object.freeze([PROTOCOL_VERSION, ...LEGACY_PROTOCOL_VERSIONS]);
const REGISTER = Symbol("register");
const DISCOVERABLE = Symbol("discoverable");
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
const RESOURCE_ACCESS = Symbol("resourceAccess");
const PROMPT_NAME = Symbol("promptName");
const PROMPT_ACCESS = Symbol("promptAccess");
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
  readonly principal?: Principal;
  readonly filterCatalogues: boolean;
  readonly capability?: string;
  readonly legacy: boolean;
  readonly maxClientRoots?: number;
  readonly observability?: ObservabilityState;
}
const requestOperations = new AsyncLocalStorage<RequestOperation>();
interface RequestStateRuntime {
  readonly mint: (payload: unknown, context: ServerContext) => Promise<RequestState>;
  readonly verify: (state: string, context: ServerContext) => Promise<unknown>;
}

function createRequestStateRuntime(options: RequestStateOptions): RequestStateRuntime {
  if (typeof options.key !== "string" && !(options.key instanceof Uint8Array)) {
    throw new TypeError("requestState.key must be a string or Uint8Array");
  }
  const ttlSeconds = positiveInteger("requestState.ttlSeconds", options.ttlSeconds);
  const maxBytes = positiveInteger("requestState.maxBytes", options.maxBytes ?? 4 * 1024);
  const codec = createRequestStateCodec({
    key: typeof options.key === "string" ? options.key : Uint8Array.from(options.key),
    ttlSeconds,
    bind(context) {
      const operation = requestOperations.getStore();
      if (!operation?.capability) throw new Error("request state has no capability binding");
      const principal = operation.principal;
      return JSON.stringify([
        context.mcpReq.method,
        operation.capability,
        principal
          ? [principal.clientId, [...principal.permissions].sort(), principal.resource ?? null]
          : null,
      ]);
    },
  });
  const assertWireSize = (state: string) => {
    if (Buffer.byteLength(state, "utf8") > maxBytes) throw new Error("request state is oversized");
  };
  return Object.freeze({
    async mint(payload: unknown, context: ServerContext) {
      const state = await codec.mint(payload, context);
      assertWireSize(state);
      return state as RequestState;
    },
    async verify(state: string, context: ServerContext) {
      assertWireSize(state);
      return codec.verify(state, context);
    },
  });
}

export interface Principal {
  readonly clientId: string;
  /** Normalized permissions granted to this MCP resource. */
  readonly permissions: readonly string[];
  readonly resource?: string;
}
export type ToolPrincipal = Principal;
export type CapabilityAccess = "public" | "protected";
export type AccessPolicy =
  | { readonly access: "public" }
  | { readonly access: "protected"; readonly requiredScopes: readonly string[] };
export interface ToolContext<Access extends ToolAccess = ToolAccess> {
  readonly signal: AbortSignal;
  readonly deadlineMs: number;
  readonly principal: Access extends "public" ? undefined : Principal;
  /** Client-supplied responses from the current multi-round-trip retry. */
  readonly inputResponses?: CheckedInputResponses;
  /** Verified decoded state from the current request round. */
  readonly requestState?: unknown;
  /** Signs state for a later request round when request-state support is configured. */
  readonly mintRequestState?: (payload: unknown) => Promise<RequestState>;
  /** Sends a client-visible MCP log message when client logging is configured. */
  readonly reportLog?: (message: ClientLogMessage) => Promise<void>;
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
  readonly principal: Access extends "public" ? undefined : Principal;
  readonly reportProgress: (update: ProgressUpdate) => Promise<void>;
  /** Sends a client-visible MCP log message when client logging is configured. */
  readonly reportLog?: (message: ClientLogMessage) => Promise<void>;
}
export interface ClientLogMessage {
  readonly level: LoggingLevel;
  readonly logger?: string;
  readonly data: JSONValue;
}
export interface ToolResult<Output> {
  /** Optional custom text for clients that do not consume structured content. Omit it to serialize the validated data as JSON. */
  readonly text?: string;
  readonly data: Output;
}
/** A complete MCP tool result checked by the framework before emission. */
export type ProtocolToolResult = CallToolResult & {
  readonly data?: never;
  readonly text?: never;
};
export interface BackendAdapterContext {
  readonly signal: AbortSignal;
  readonly deadlineMs: number;
}
export type OperationContext = BackendAdapterContext;
export interface ClientInputContext<Access extends CapabilityAccess = CapabilityAccess>
  extends OperationContext {
  readonly principal: Access extends "public" ? undefined : Principal;
  /** Client-supplied responses from the current multi-round-trip retry. */
  readonly inputResponses?: CheckedInputResponses;
  /** Verified decoded state from the current request round. */
  readonly requestState?: unknown;
  /** Signs state for a later request round when request-state support is configured. */
  readonly mintRequestState?: (payload: unknown) => Promise<RequestState>;
  /** Sends a client-visible MCP log message when client logging is configured. */
  readonly reportLog?: (message: ClientLogMessage) => Promise<void>;
}
export interface ResourcePromptContext<Access extends CapabilityAccess = CapabilityAccess>
  extends ClientInputContext<Access> {
  /** Reports bounded progress when the current request supplies a progress token. */
  readonly reportProgress?: (update: ProgressUpdate) => Promise<void>;
}
export interface CompletionContext<Access extends CapabilityAccess = CapabilityAccess>
  extends OperationContext {
  readonly principal: Access extends "public" ? undefined : Principal;
  readonly arguments: Readonly<Record<string, string>>;
}
export type CompletionHandler = (
  value: string,
  context: CompletionContext,
) => readonly string[] | Promise<readonly string[]>;
interface ProtectedCapabilityAccess {
  readonly type: "protected";
  readonly requiredScopes: readonly string[];
}
export type ToolAccess = "public" | "protected";
interface ToolDefinitionCommon<Input> {
  readonly name: string;
  readonly discoverable?: boolean;
  readonly title?: string;
  readonly description: string;
  readonly icons?: readonly Icon[];
  readonly annotations?: Readonly<ToolAnnotations>;
  readonly _meta?: Readonly<MetaObject>;
  readonly inputSchema: Input;
}
type ZodObjectLike = StandardSchemaWithJSON & {
  readonly type: "object";
  readonly shape: Readonly<Record<string, StandardSchemaV1>>;
  readonly safeParseAsync: (value: unknown) => Promise<{ readonly success: boolean }>;
  readonly toJSONSchema: () => unknown;
};
type ToolDefinitionBase<Input, Output extends StandardSchemaWithJSON | undefined> =
  ToolDefinitionCommon<Input> & (Output extends StandardSchemaWithJSON
    ? { readonly outputSchema: Output }
    : { readonly outputSchema?: never });
type OutputInput<Output> = Output extends StandardSchemaV1
  ? Readonly<StandardSchemaV1.InferInput<Output>>
  : never;
type CheckedToolResult<Output> = ProtocolToolResult |
  (Output extends StandardSchemaV1 ? ToolResult<OutputInput<Output>> : never);
type InferredToolDefinition<
  Input extends ZodObjectLike,
  Output extends StandardSchemaWithJSON | undefined,
  Access extends ToolAccess,
  Result,
> =
  ToolDefinitionBase<Input, Output> & {
    readonly handler: (
      input: StandardSchemaV1.InferOutput<Input>,
      context: ToolContext<NoInfer<Access>>
    ) => Result;
  } & (Access extends "public"
    ? { readonly access: Access; readonly requiredScopes?: never }
    : { readonly access: Access; readonly requiredScopes: readonly string[] });
type InferredStreamingToolDefinition<
  Input extends ZodObjectLike,
  Output extends StandardSchemaWithJSON | undefined,
  Access extends ToolAccess,
  Result,
> = ToolDefinitionBase<Input, Output> & {
  readonly handler: (
    input: StandardSchemaV1.InferOutput<Input>,
    context: StreamingToolContext<NoInfer<Access>>
  ) => Result;
} & (Access extends "public"
  ? { readonly access: Access; readonly requiredScopes?: never }
  : { readonly access: Access; readonly requiredScopes: readonly string[] });
type InferredMappedToolDefinition<
  Input extends ZodObjectLike,
  Output extends StandardSchemaWithJSON | undefined,
  BackendInput extends ZodObjectLike,
  BackendOutput extends ZodObjectLike,
  Access extends ToolAccess,
  Result,
> = ToolDefinitionBase<Input, Output> & {
  readonly backendInputSchema: BackendInput;
  readonly backendOutputSchema: BackendOutput;
  readonly isAvailable?: (context: BackendAdapterContext) => boolean | Promise<boolean>;
  readonly mapInput: (
    input: StandardSchemaV1.InferOutput<Input>
  ) => StandardSchemaV1.InferInput<BackendInput>;
  readonly adapter: (
    input: StandardSchemaV1.InferOutput<BackendInput>,
    context: BackendAdapterContext
  ) => unknown | Promise<unknown>;
  readonly mapOutput: (output: StandardSchemaV1.InferOutput<BackendOutput>) => Result;
} & (Access extends "public"
  ? { readonly access: Access; readonly requiredScopes?: never }
  : { readonly access: Access; readonly requiredScopes: readonly string[] });
type InferredToolHandlerResult = ToolResult<unknown> | ProtocolToolResult | InputRequiredResult;
type ResultDataKeys<Result> = Result extends ToolResult<infer Data>
  ? Data extends object ? keyof Data : never
  : never;
type ExactToolResult<
  Result,
  Output extends StandardSchemaWithJSON | undefined,
  ErrorMessage extends string,
> = Output extends ZodObjectLike
  ? [Exclude<ResultDataKeys<Awaited<Result>>, keyof Output["shape"]>] extends [never]
    ? object
    : { readonly [Key in ErrorMessage]: never }
  : object;
type MixedToolResult<Result> = Result extends PromiseLike<infer Value>
  ? MixedToolResult<Value>
  : Result extends { readonly data: unknown }
    ? Extract<keyof Result, "content" | "structuredContent" | "isError" | "_meta"> extends never
      ? never
      : Result
    : never;
type ExactToolResultForm<Result, ErrorMessage extends string> = [MixedToolResult<Result>] extends [never]
  ? object
  : { readonly [Key in ErrorMessage]: never };
export type ToolDefinition<
  Input extends z.ZodObject,
  Output extends StandardSchemaWithJSON | undefined = undefined,
  Result extends CheckedToolResult<Output> | InputRequiredResult |
    Promise<CheckedToolResult<Output> | InputRequiredResult> =
    CheckedToolResult<Output> | InputRequiredResult |
    Promise<CheckedToolResult<Output> | InputRequiredResult>,
> =
  ToolDefinitionBase<Input, Output> & (
    | {
        readonly access: "public";
        readonly requiredScopes?: never;
        readonly handler: (input: z.output<Input>, context: ToolContext<"public">) => Result;
      }
    | {
        readonly access: "protected";
        readonly requiredScopes: readonly string[];
        readonly handler: (input: z.output<Input>, context: ToolContext<"protected">) => Result;
      }
  );
export type StreamingToolDefinition<
  Input extends z.ZodObject,
  Output extends StandardSchemaWithJSON | undefined = undefined,
  Result extends CheckedToolResult<Output> |
    Promise<CheckedToolResult<Output>> =
    CheckedToolResult<Output> | Promise<CheckedToolResult<Output>>,
> =
  ToolDefinitionBase<Input, Output> & (
    | {
        readonly access: "public";
        readonly requiredScopes?: never;
        readonly handler: (input: z.output<Input>, context: StreamingToolContext<"public">) => Result;
      }
    | {
        readonly access: "protected";
        readonly requiredScopes: readonly string[];
        readonly handler: (input: z.output<Input>, context: StreamingToolContext<"protected">) => Result;
      }
  );
type MappedToolDefinitionBase<
  Input extends z.ZodObject,
  Output extends StandardSchemaWithJSON | undefined,
  BackendInput extends z.ZodObject,
  BackendOutput extends z.ZodObject,
  Result extends CheckedToolResult<Output> = CheckedToolResult<Output>,
> = ToolDefinitionBase<Input, Output> & {
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
  readonly mapOutput: (output: z.output<BackendOutput>) => Result;
}
export type MappedToolDefinition<
  Input extends z.ZodObject,
  Output extends StandardSchemaWithJSON | undefined,
  BackendInput extends z.ZodObject,
  BackendOutput extends z.ZodObject,
  Result extends CheckedToolResult<Output> = CheckedToolResult<Output>,
> =
  | MappedToolDefinitionBase<Input, Output, BackendInput, BackendOutput, Result> & {
      readonly access: "public";
      readonly requiredScopes?: never;
    }
  | MappedToolDefinitionBase<Input, Output, BackendInput, BackendOutput, Result> & {
      readonly access: "protected";
      readonly requiredScopes: readonly string[];
    };
export interface EmseepeaTool {
  readonly [DISCOVERABLE]: boolean;
  readonly [TOOL_NAME]: string;
  readonly [TOOL_ACCESS]: "public" | ProtectedCapabilityAccess;
  readonly [TOOL_STREAMING]: boolean;
  readonly [TOOL_LISTING]: Readonly<Record<string, unknown>>;
  readonly [REGISTER]: (
    server: McpServer,
    timeoutMs: number,
    maxApplicationResultBytes: number,
    maxProgressEvents: number,
    maxProgressEventBytes: number,
    requestState?: RequestStateRuntime,
    clientLogging?: NormalizedClientLogging,
  ) => void;
}
interface ResourceDefinitionBase {
  readonly name: string;
  readonly discoverable?: boolean;
  readonly uri: string;
  readonly title?: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly icons?: readonly Icon[];
  readonly annotations?: Readonly<Annotations>;
  readonly size?: number;
  readonly _meta?: Readonly<MetaObject>;
  readonly cacheHint?: CacheHint;
}
export type ResourceDefinition = ResourceDefinitionBase & (
  | { readonly access: "public"; readonly requiredScopes?: never;
      readonly handler: (context: ResourcePromptContext<"public">) =>
        ReadResourceResult | InputRequiredResult | Promise<ReadResourceResult | InputRequiredResult> }
  | { readonly access: "protected"; readonly requiredScopes: readonly string[];
      readonly handler: (context: ResourcePromptContext<"protected">) =>
        ReadResourceResult | InputRequiredResult | Promise<ReadResourceResult | InputRequiredResult> }
);
export interface McpAppCsp {
  readonly connectDomains?: readonly string[];
  readonly resourceDomains?: readonly string[];
  readonly frameDomains?: readonly string[];
  readonly baseUriDomains?: readonly string[];
}
interface McpAppResourceDefinitionBase {
  readonly name: string;
  readonly discoverable?: boolean;
  readonly uri: string;
  readonly title: string;
  readonly description?: string;
  readonly mimeType?: "text/html;profile=mcp-app" | "text/html+skybridge";
  readonly language: string;
  /** Trusted application-owned HTML inside the document body. */
  readonly bodyMarkup: string;
  /** Trusted application-owned CSS. */
  readonly styles?: string;
  readonly csp?: McpAppCsp;
  readonly prefersBorder?: boolean;
}
export type McpAppResourceDefinition = McpAppResourceDefinitionBase & (
  | { readonly access: "public"; readonly requiredScopes?: never }
  | { readonly access: "protected"; readonly requiredScopes: readonly string[] }
) & (
  | { readonly script: string; readonly bundleUrl?: never }
  | { readonly script?: never; readonly bundleUrl: URL }
);
export interface McpAppResource {
  readonly resource: EmseepeaResource;
  readonly toolMetadata: Readonly<MetaObject>;
}
interface ResourceTemplateDefinitionBase {
  readonly name: string;
  readonly discoverable?: boolean;
  readonly uriTemplate: string;
  readonly title?: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly icons?: readonly Icon[];
  readonly annotations?: Readonly<Annotations>;
  readonly _meta?: Readonly<MetaObject>;
  readonly cacheHint?: CacheHint;
  readonly complete?: Readonly<Record<string, CompletionHandler>>;
}
type ResourceTemplateHandler<Access extends CapabilityAccess> = (
  input: {
    readonly uri: string;
    readonly variables: Readonly<Record<string, string | readonly string[]>>;
  },
  context: ResourcePromptContext<Access>,
) => ReadResourceResult | InputRequiredResult | Promise<ReadResourceResult | InputRequiredResult>;
export type ResourceTemplateDefinition = ResourceTemplateDefinitionBase & (
  | { readonly access: "public"; readonly requiredScopes?: never;
      readonly handler: ResourceTemplateHandler<"public"> }
  | { readonly access: "protected"; readonly requiredScopes: readonly string[];
      readonly handler: ResourceTemplateHandler<"protected"> }
);
interface ResourceTemplateRoute {
  readonly protocol: string;
  readonly host: string;
  readonly segments: readonly (string | undefined)[];
}
export interface EmseepeaResource {
  readonly [DISCOVERABLE]: boolean;
  readonly [RESOURCE_NAME]: string;
  readonly [RESOURCE_URI]: string;
  readonly [RESOURCE_KIND]: "static" | "template";
  readonly [RESOURCE_MATCHES]?: (uri: string) => boolean;
  readonly [RESOURCE_ROUTE]?: ResourceTemplateRoute;
  readonly [RESOURCE_LISTING]: {
    readonly method: "resources/list" | "resources/templates/list";
    readonly value: Readonly<Record<string, unknown>>;
  };
  readonly [RESOURCE_ACCESS]: "public" | ProtectedCapabilityAccess;
  readonly [HAS_COMPLETION]: boolean;
  readonly [REGISTER]: (
    server: McpServer,
    timeoutMs: number,
    maxApplicationResultBytes: number,
    maxProgressEvents: number,
    maxProgressEventBytes: number,
    requestState?: RequestStateRuntime,
    clientLogging?: NormalizedClientLogging,
  ) => void;
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
type PromptDefinitionBase<Args extends z.ZodObject> = {
  readonly name: string;
  readonly discoverable?: boolean;
  readonly title?: string;
  readonly description?: string;
  readonly icons?: readonly Icon[];
  readonly _meta?: Readonly<MetaObject>;
  readonly argsSchema: Args;
  readonly complete?: Readonly<Partial<Record<Extract<keyof z.input<Args>, string>, CompletionHandler>>>;
};
export type PromptDefinition<Args extends z.ZodObject> = PromptDefinitionBase<Args> & (
  | { readonly access: "public"; readonly requiredScopes?: never;
      readonly handler: (args: z.output<Args>, context: ResourcePromptContext<"public">) =>
        GetPromptResult | InputRequiredResult | Promise<GetPromptResult | InputRequiredResult> }
  | { readonly access: "protected"; readonly requiredScopes: readonly string[];
      readonly handler: (args: z.output<Args>, context: ResourcePromptContext<"protected">) =>
        GetPromptResult | InputRequiredResult | Promise<GetPromptResult | InputRequiredResult> }
) & PromptInputConstraint<Args>;
export interface EmseepeaPrompt {
  readonly [DISCOVERABLE]: boolean;
  readonly [PROMPT_NAME]: string;
  readonly [PROMPT_ACCESS]: "public" | ProtectedCapabilityAccess;
  readonly [HAS_COMPLETION]: boolean;
  readonly [PROMPT_LISTING]: Readonly<Record<string, unknown>>;
  readonly [REGISTER]: (
    server: McpServer,
    timeoutMs: number,
    maxApplicationResultBytes: number,
    maxProgressEvents: number,
    maxProgressEventBytes: number,
    requestState?: RequestStateRuntime,
    clientLogging?: NormalizedClientLogging,
  ) => void;
}
export type EmseepeaCapability = EmseepeaTool | EmseepeaResource | EmseepeaPrompt;
export type CapabilityModuleFactory<Context = undefined> = (
  context: Context,
) => EmseepeaCapability | Promise<EmseepeaCapability>;
export interface DiscoveredCapabilities {
  readonly tools: readonly EmseepeaTool[];
  readonly resources: readonly EmseepeaResource[];
  readonly prompts: readonly EmseepeaPrompt[];
}
export type HttpRouteHandler = RouteHandlerMethod;
export interface AuthenticationOptions {
  readonly verifier: OAuthTokenVerifier;
  readonly metadata: Omit<AuthMetadataOptions, "dangerouslyAllowInsecureIssuerUrl"> & {
    readonly dangerouslyAllowInsecureIssuerUrl?: false;
  };
  readonly verificationTimeoutMs?: number;
  /** Public lists every contract. Protected authenticates and permission-filters the catalogue. */
  readonly discovery?: "public" | "protected";
}
export type OAuthResourceServerOptions = AuthenticationOptions;
export interface EmseepeaOptions {
  readonly observability?: readonly ObservabilityAdapter[];
  readonly callerClassifications?: readonly CallerClassification[];
  readonly readiness?: (context: { readonly signal: AbortSignal }) => boolean | Promise<boolean>;
  readonly readinessTimeoutMs?: number;
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
  /** Optional capabilities composed onto an application or initializer's own catalogue. */
  readonly additionalTools?: readonly EmseepeaTool[];
  readonly listPagination?: ListPaginationOptions;
  readonly cacheHints?: CacheHints;
  readonly maxRequestBytes?: number;
  readonly maxApplicationResultBytes?: number;
  readonly maxProgressEvents?: number;
  readonly maxProgressEventBytes?: number;
  readonly resourceSubscriptions?: ResourceSubscriptionOptions;
  readonly requestState?: RequestStateOptions;
  readonly clientLogging?: ClientLoggingOptions;
  readonly clientRoots?: { readonly maxRoots?: number };
  readonly operationTimeoutMs?: number;
  readonly deployment?: DeploymentProfile;
  readonly authentication?: AuthenticationOptions;
}
export interface RequestStateOptions {
  readonly key: Uint8Array | string;
  readonly ttlSeconds: number;
  readonly maxBytes?: number;
}
export interface ClientLoggingOptions {
  readonly maxEvents?: number;
  readonly maxEventBytes?: number;
}
interface NormalizedClientLogging {
  readonly maxEvents: number;
  readonly maxEventBytes: number;
}
export interface ResourceSubscriptionOptions {
  readonly maxActive?: number;
  readonly maxEvents?: number;
  readonly maxEventBytes?: number;
  readonly maxUriBytes?: number;
  readonly lifetimeMs?: number;
}
export type EmseepeaExtensions = Pick<
  EmseepeaOptions,
  | "authentication"
  | "observability"
  | "callerClassifications"
  | "additionalTools"
  | "deployment"
>;
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
      /**
       * The literal addresses the proxy in front may connect from. A CIDR
       * range is refused: the comparison is exact membership.
       *
       * Supply this OR `proxyBoundary`, never both and never neither.
       */
      readonly trustedProxyAddresses?: readonly string[];
      /**
       * Proves a request arrived through the proxy, for deployments where no
       * stable peer address exists to enumerate. The proxy injects `header`
       * with the value `secret`; the server compares and refuses anything
       * else.
       *
       * This replaces the peer address comparison and changes nothing else:
       * the protocol, authority, origin and rate-limit checks all still run.
       *
       * A proxy that is not injecting the header refuses every request, so a
       * mistake here closes the server rather than opening it. Configure the
       * header on the proxy first, then deploy with this set.
       *
       * `secret` is a credential. Keep it out of source control and out of
       * the deployment config file: supply it from your platform's secret
       * store at runtime. It is never logged and never sent to an
       * observability adapter.
       *
       * Supply this OR `trustedProxyAddresses`, never both and never neither.
       */
      readonly proxyBoundary?: { readonly header: string; readonly secret: string };
      /**
       * How many entries the infrastructure in front appends to
       * `x-forwarded-for` AFTER the client address. Defaults to 0.
       *
       * 0 means the header carries the client and nothing else, so anything
       * longer is refused: with nothing trustworthy appending, a second entry
       * can only have been supplied by the caller.
       *
       * A load balancer that appends its own address after the client is 1:
       * the client is then the second-to-last entry, and anything before it
       * is caller-supplied and ignored. Reading the FIRST entry instead would
       * let a caller choose their own rate-limit key.
       *
       * Set it from what the deployment actually sends, not from what a
       * platform is assumed to do. Counting from the end keeps a caller out
       * of the rate-limit key when the count is right; it cannot tell you the
       * count is wrong. A count higher than the truth reads an entry the
       * caller supplied, on any request that carries a prefix, and nothing
       * here detects it.
       */
      readonly forwardedHops?: number;
      readonly rateLimit: Readonly<RateLimitOptions>;
    };

export function loadDeploymentProfile(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): DeploymentProfile {
  const mode = environment.EMSEEPEA_DEPLOYMENT_MODE;
  const configPath = environment.EMSEEPEA_DEPLOYMENT_CONFIG_FILE;
  if (mode === undefined) {
    if (configPath !== undefined) throw new TypeError("Deployment config requires an explicit deployment mode");
    return { mode: "loopback" };
  }
  if (mode !== "production-behind-proxy") throw new TypeError(`Unsupported deployment mode: ${mode}`);
  if (!configPath || !isAbsolute(configPath)) {
    throw new TypeError("Production deployment config must be an absolute file path");
  }
  const bytes = readFileSync(configPath);
  if (bytes.byteLength > 16 * 1024) throw new TypeError("Production deployment config exceeds 16 KiB");
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const parsed = z.strictObject({
    allowedAuthorities: z.array(z.string()).min(1),
    allowedOrigins: z.array(z.string()).min(1),
    trustedProxyAddresses: z.array(z.string()).min(1).optional(),
    // The config file carries non-secret policy only, so it names the
    // environment variable holding the secret rather than the secret itself.
    proxyBoundary: z.strictObject({
      header: z.string(),
      secretEnv: z.string().min(1),
    }).optional(),
    forwardedHops: z.number().int().nonnegative().optional(),
    rateLimit: z.strictObject({
      maxRequests: z.number().int().positive(),
      windowMs: z.number().int().positive(),
      maxClients: z.number().int().positive(),
    }),
  }).parse(JSON.parse(source));
  // The file names the variable holding the proxy secret; the value itself
  // comes from the environment, so the config stays non-secret policy.
  const { proxyBoundary: fileBoundary, ...policy } = parsed;
  let proxyBoundary: { header: string; secret: string } | undefined;
  if (fileBoundary) {
    const secret = environment[fileBoundary.secretEnv];
    if (!secret) {
      throw new TypeError(`Production deployment config names ${fileBoundary.secretEnv} for the proxy secret, and it is not set`);
    }
    proxyBoundary = { header: fileBoundary.header, secret };
  }
  const profile = {
    mode,
    ...policy,
    ...(proxyBoundary ? { proxyBoundary } : {}),
  } satisfies DeploymentProfile;
  const normalized = normalizeDeployment(profile);
  if (normalized.mode !== "production-behind-proxy") throw new TypeError("Production deployment config is invalid");
  for (const [label, values, normalizedValues] of [
    ["allowed authority", parsed.allowedAuthorities, normalized.allowedAuthorities],
    ["allowed origin", parsed.allowedOrigins, normalized.allowedOrigins],
    ["trusted proxy address", parsed.trustedProxyAddresses ?? [], normalized.trustedProxyAddresses ?? new Set()],
  ] as const) {
    if (normalizedValues.size !== values.length) throw new TypeError(`Duplicate ${label}`);
  }
  for (const address of parsed.trustedProxyAddresses ?? []) {
    if (normalizeIp(address) !== address) throw new TypeError(`Trusted proxy address is not normalized: ${address}`);
  }
  return profile;
}
export interface ServeOptions {
  readonly host?: "127.0.0.1" | "::1" | "localhost" | "0.0.0.0" | "::";
  readonly port?: number;
  readonly shutdownTimeoutMs?: number;
  readonly observabilityFlushTimeoutMs?: number;
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
      /** Absent when the boundary is declared platform-enforced. */
      /** Absent when the boundary is proved by a header instead. */
      readonly trustedProxyAddresses: ReadonlySet<string> | undefined;
      /** Absent when the boundary is an address allowlist. */
      readonly proxyBoundary: { readonly header: string; readonly digest: Buffer } | undefined;
      readonly forwardedHops: number;
      readonly rateLimit: Readonly<RateLimitOptions>;
    };
interface AppRuntime {
  deployment: NormalizedDeployment;
  requestTimeoutMs: number;
  stopping: AbortController;
  observabilityLimits: { deliveryTimeoutMs: number } | undefined;
  finishObservability: ((timeoutMs: number) => Promise<void>) | undefined;
  notifyResourceUpdated?: (uri: string) => void;
}
interface NormalizedOAuth {
  readonly verifier: OAuthTokenVerifier;
  readonly metadata: AuthMetadataOptions;
  readonly resourceMetadataUrl: string;
  readonly verificationTimeoutMs: number;
  readonly discovery: "public" | "protected";
}

export function defineTool<
  Input extends ZodObjectLike,
  const Access extends ToolAccess,
  const Result extends
    | ProtocolToolResult
    | InputRequiredResult
    | Promise<ProtocolToolResult | InputRequiredResult>,
>(definition: InferredToolDefinition<Input, undefined, Access, Result>): EmseepeaTool;
export function defineTool<
  Input extends ZodObjectLike,
  Output extends StandardSchemaWithJSON,
  const Access extends ToolAccess,
  const Result extends CheckedToolResult<Output> | InputRequiredResult |
    Promise<CheckedToolResult<Output> | InputRequiredResult>,
>(definition: InferredToolDefinition<Input, Output, Access, Result> & ExactToolResult<
  Result,
  Output,
  "ERROR: handler data contains keys absent from outputSchema"
> & ExactToolResultForm<Result, "ERROR: handler mixes convenience and protocol result fields">): EmseepeaTool;
export function defineTool(definition: unknown): EmseepeaTool {
  const checkedDefinition = definition as CheckedToolDefinition & { handler: CheckedToolExecutor };
  const handler = checkedDefinition.handler as unknown as (
    input: unknown,
    context: ToolContext,
  ) => InferredToolHandlerResult | Promise<InferredToolHandlerResult>;
  return createCheckedTool(checkedDefinition, handler as CheckedToolExecutor, false, true);
}

export function defineStreamingTool<
  Input extends ZodObjectLike,
  const Access extends ToolAccess,
  const Result extends ProtocolToolResult | Promise<ProtocolToolResult>,
>(definition: InferredStreamingToolDefinition<Input, undefined, Access, Result>): EmseepeaTool;
export function defineStreamingTool<
  Input extends ZodObjectLike,
  Output extends StandardSchemaWithJSON,
  const Access extends ToolAccess,
  const Result extends CheckedToolResult<Output> | Promise<CheckedToolResult<Output>>,
>(definition: InferredStreamingToolDefinition<Input, Output, Access, Result> & ExactToolResult<
  Result,
  Output,
  "ERROR: handler data contains keys absent from outputSchema"
> & ExactToolResultForm<Result, "ERROR: handler mixes convenience and protocol result fields">): EmseepeaTool;
export function defineStreamingTool(definition: unknown): EmseepeaTool {
  const checkedDefinition = definition as CheckedToolDefinition & { handler: CheckedToolExecutor };
  return createCheckedTool(checkedDefinition, checkedDefinition.handler, true, false);
}

export function defineMappedTool<
  Input extends ZodObjectLike,
  BackendInput extends ZodObjectLike,
  BackendOutput extends ZodObjectLike,
  const Access extends ToolAccess,
  const Result extends ProtocolToolResult,
>(definition: InferredMappedToolDefinition<
  Input,
  undefined,
  BackendInput,
  BackendOutput,
  Access,
  Result
>): EmseepeaTool;
export function defineMappedTool<
  Input extends ZodObjectLike,
  Output extends StandardSchemaWithJSON,
  BackendInput extends ZodObjectLike,
  BackendOutput extends ZodObjectLike,
  const Access extends ToolAccess,
  const Result extends CheckedToolResult<Output>,
>(
  definition: InferredMappedToolDefinition<
    Input,
    Output,
    BackendInput,
    BackendOutput,
    Access,
    Result
  > & ExactToolResult<
    Result,
    Output,
    "ERROR: mapOutput data contains keys absent from outputSchema"
  > & ExactToolResultForm<Result, "ERROR: mapOutput mixes convenience and protocol result fields">
): EmseepeaTool;
export function defineMappedTool(definition: unknown): EmseepeaTool {
  const checkedDefinition = definition as unknown as MappedToolDefinition<
    z.ZodObject,
    StandardSchemaWithJSON | undefined,
    z.ZodObject,
    z.ZodObject
  >;
  const { backendInputSchema, backendOutputSchema, isAvailable, adapter } = checkedDefinition;
  const mapInput = checkedDefinition.mapInput;
  const mapOutput = checkedDefinition.mapOutput;
  const execute = async (input: unknown, context: ToolContext) => {
    const adapterContext = Object.freeze({
      signal: context.signal,
      deadlineMs: context.deadlineMs,
    });
    context.signal.throwIfAborted();
    if (isAvailable && await isAvailable(adapterContext) !== true) {
      throw new Error("Mapped tool provider is unavailable");
    }
    context.signal.throwIfAborted();
    const command = await backendInputSchema.safeParseAsync(mapInput(input as Record<string, unknown>));
    if (!command.success) throw new Error("Mapped backend command does not match its schema");
    context.signal.throwIfAborted();
    const backendResult = await adapter(command.data, adapterContext);
    context.signal.throwIfAborted();
    const parsedBackendResult = await backendOutputSchema.safeParseAsync(backendResult);
    if (!parsedBackendResult.success) throw new Error("Backend result does not match its schema");
    context.signal.throwIfAborted();
    return mapOutput(parsedBackendResult.data);
  };
  return createCheckedTool(definition as unknown as CheckedToolDefinition, execute as CheckedToolExecutor, false, false);
}

export function defineResource(definition: ResourceDefinition): EmseepeaResource {
  const { name, handler } = definition;
  assertRegistrationName("Resource", name);
  const access = normalizeCapabilityAccess("Resource", definition.access, definition.requiredScopes);
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
    _meta: accessMetadata(definition._meta, access),
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
    [DISCOVERABLE]: normalizeDiscoverable("Resource", definition.discoverable),
    [RESOURCE_NAME]: name,
    [RESOURCE_URI]: uri,
    [RESOURCE_KIND]: "static",
    [RESOURCE_ACCESS]: access,
    [RESOURCE_LISTING]: Object.freeze({
      method: "resources/list",
      value: listing,
    }),
    [HAS_COMPLETION]: false,
    [REGISTER](
      server,
      timeoutMs,
      maxApplicationResultBytes,
      maxProgressEvents,
      maxProgressEventBytes,
      requestState,
      clientLogging,
    ) {
      server.registerResource(
        name,
        uri,
        cacheHint ? { ...metadata, cacheHint } : metadata,
        async (_requestedUri, context): Promise<ReadResourceResult | InputRequiredResult> => {
          try {
            const deadlineMs = requestOperations.getStore()?.deadlineMs ?? Date.now() + timeoutMs;
            return await runWithDeadline(context.mcpReq.signal, deadlineMs, async (signal) => {
              signal.throwIfAborted();
              const result = await withClientReporters(
                context,
                signal,
                clientLogging,
                maxProgressEvents,
                maxProgressEventBytes,
                (reportLog, reportProgress) => handler(directHandlerContext(
                  access,
                  context,
                  signal,
                  deadlineMs,
                  requestState,
                  reportLog,
                  reportProgress,
                )),
              );
              signal.throwIfAborted();
              if (isInputRequiredResult(result)) {
                await assertInputRequired(result, requestState, context);
                assertResultSize(result, maxApplicationResultBytes, deadlineMs, signal);
                return result as InputRequiredResult;
              }
              const parsed = await ReadResourceResultSchema.safeParseAsync(result);
              if (!parsed.success) {
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

/** Packages one startup-built MCP App without owning its markup, styling, or behavior. */
export function defineMcpAppResource(definition: McpAppResourceDefinition): McpAppResource {
  const uri = canonicalResourceUri(definition.uri);
  if (!uri.startsWith("ui://")) throw new TypeError("MCP App resource URI must start with ui://");
  const mimeType = definition.mimeType ?? "text/html;profile=mcp-app";
  if (mimeType !== "text/html;profile=mcp-app" && mimeType !== "text/html+skybridge") {
    throw new TypeError("MCP App mimeType must be text/html;profile=mcp-app or text/html+skybridge");
  }
  const hasScript = Object.hasOwn(definition, "script");
  const hasBundleUrl = Object.hasOwn(definition, "bundleUrl");
  if (hasScript === hasBundleUrl) throw new TypeError("MCP App resource needs exactly one script or bundleUrl");
  if (hasScript && typeof definition.script !== "string") throw new TypeError("MCP App script must be a string");
  if (hasBundleUrl && (!(definition.bundleUrl instanceof URL) || definition.bundleUrl.protocol !== "file:"
    || definition.bundleUrl.search || definition.bundleUrl.hash)) {
    throw new TypeError("MCP App bundleUrl must be a local file URL without a query or fragment");
  }
  if (typeof definition.language !== "string" || !definition.language.trim()) {
    throw new TypeError("MCP App language must be a non-empty language tag");
  }
  let languages: string[];
  try {
    languages = Intl.getCanonicalLocales(definition.language.trim());
  } catch {
    throw new TypeError("MCP App language must be a valid language tag");
  }
  const [language] = languages;
  if (!language) throw new TypeError("MCP App language must be a valid language tag");
  if (typeof definition.title !== "string" || !definition.title.trim()) {
    throw new TypeError("MCP App title must be a non-empty string");
  }
  if (typeof definition.bodyMarkup !== "string" || (definition.styles !== undefined && typeof definition.styles !== "string")) {
    throw new TypeError("MCP App bodyMarkup and styles must be strings");
  }
  if (definition.prefersBorder !== undefined && typeof definition.prefersBorder !== "boolean") {
    throw new TypeError("MCP App prefersBorder must be a boolean");
  }
  const validatedCsp = normalizeMcpAppCsp(definition.csp);
  const csp = Object.freeze({
    connectDomains: validatedCsp.connectDomains,
    resourceDomains: validatedCsp.resourceDomains,
    ...(validatedCsp.frameDomains.length ? { frameDomains: validatedCsp.frameDomains } : {}),
    ...(validatedCsp.baseUriDomains.length ? { baseUriDomains: validatedCsp.baseUriDomains } : {}),
  });
  const legacyCsp = Object.freeze({
    connect_domains: csp.connectDomains,
    resource_domains: csp.resourceDomains,
  });
  const resourceMetadata = Object.freeze({
    ui: Object.freeze({ csp, ...(definition.prefersBorder === undefined ? {} : { prefersBorder: definition.prefersBorder }) }),
    "openai/widgetCSP": legacyCsp,
    ...(definition.prefersBorder === undefined ? {} : { "openai/widgetPrefersBorder": definition.prefersBorder }),
  });
  const script = hasScript ? definition.script! : readFileSync(definition.bundleUrl!, "utf8");
  const html = `<!doctype html><html lang="${escapeMcpAppText(language)}"><head>` +
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeMcpAppText(definition.title)}</title>` +
    (definition.styles === undefined ? "" : `<style>${definition.styles}</style>`) +
    `</head><body>${definition.bodyMarkup}<script type="module">${script.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
  const resource = defineResource({
    name: definition.name,
    discoverable: definition.discoverable,
    access: definition.access,
    ...(definition.access === "protected" ? { requiredScopes: definition.requiredScopes } : {}),
    uri,
    title: definition.title,
    description: definition.description,
    mimeType,
    _meta: resourceMetadata,
    handler: () => ({ contents: [{ uri, mimeType, text: html, _meta: resourceMetadata }] }),
  } as ResourceDefinition);
  return Object.freeze({
    resource,
    toolMetadata: Object.freeze({
      ui: Object.freeze({ resourceUri: uri }),
      "openai/outputTemplate": uri,
    }),
  });
}

function normalizeMcpAppCsp(input: McpAppCsp | undefined): Readonly<Required<McpAppCsp>> {
  if (input !== undefined && (typeof input !== "object" || input === null || Array.isArray(input))) {
    throw new TypeError("MCP App csp must be an object of origin lists");
  }
  const allowed = ["connectDomains", "resourceDomains", "frameDomains", "baseUriDomains"] as const;
  if (input && Object.keys(input).some((key) => !allowed.includes(key as typeof allowed[number]))) {
    throw new TypeError("MCP App csp has an unsupported field");
  }
  let total = 0;
  const result = Object.fromEntries(allowed.map((key) => {
    const domains = input?.[key] ?? [];
    if (!Array.isArray(domains) || domains.length > 32) throw new TypeError(`MCP App ${key} must contain at most 32 origins`);
    total += domains.length;
    const checked = domains.map((origin) => {
      if (typeof origin !== "string") throw new TypeError(`MCP App ${key} must contain exact origins`);
      let parsed: URL;
      try { parsed = new URL(origin); } catch { throw new TypeError(`MCP App ${key} must contain exact origins`); }
      const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
      if (parsed.origin !== origin || (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback))) {
        throw new TypeError(`MCP App ${key} must contain HTTPS origins or HTTP loopback origins`);
      }
      return origin;
    });
    if (new Set(checked).size !== checked.length) throw new TypeError(`MCP App ${key} has repeated origins`);
    return [key, Object.freeze(checked)];
  })) as unknown as Required<McpAppCsp>;
  if (total > 64) throw new TypeError("MCP App csp must contain at most 64 origins in total");
  return Object.freeze(result);
}

function escapeMcpAppText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function defineResourceTemplate(definition: ResourceTemplateDefinition): EmseepeaResource {
  const { name, handler } = definition;
  assertRegistrationName("Resource template", name);
  const access = normalizeCapabilityAccess(
    "Resource template",
    definition.access,
    definition.requiredScopes,
  );
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
    _meta: accessMetadata(definition._meta, access),
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
    [DISCOVERABLE]: normalizeDiscoverable("Resource template", definition.discoverable),
    [RESOURCE_NAME]: name,
    [RESOURCE_URI]: uriTemplate,
    [RESOURCE_KIND]: "template",
    [RESOURCE_ACCESS]: access,
    [RESOURCE_MATCHES]: (uri) => template.uriTemplate.match(uri) !== null,
    [RESOURCE_ROUTE]: route,
    [RESOURCE_LISTING]: Object.freeze({
      method: "resources/templates/list",
      value: listing,
    }),
    [HAS_COMPLETION]: completions.size > 0,
    [REGISTER](
      server,
      timeoutMs,
      maxApplicationResultBytes,
      maxProgressEvents,
      maxProgressEventBytes,
      requestState,
      clientLogging,
    ) {
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
              const result = await withClientReporters(
                context,
                signal,
                clientLogging,
                maxProgressEvents,
                maxProgressEventBytes,
                (reportLog, reportProgress) => handler(
                  { uri: requestedUri.href, variables },
                  directHandlerContext(
                    access,
                    context,
                    signal,
                    deadlineMs,
                    requestState,
                    reportLog,
                    reportProgress,
                  ),
                ),
              );
              signal.throwIfAborted();
              if (isInputRequiredResult(result)) {
                await assertInputRequired(result, requestState, context);
                assertResultSize(result, maxApplicationResultBytes, deadlineMs, signal);
                return result as InputRequiredResult;
              }
              const parsed = await ReadResourceResultSchema.safeParseAsync(result);
              if (!parsed.success) {
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
  const access = normalizeCapabilityAccess("Prompt", definition.access, definition.requiredScopes);
  const argumentNames = Object.keys(argsSchema.shape);
  const completions = checkedCompletionHandlers("Prompt", definition.complete, argumentNames);
  const listing = checkedProtocolValue<Prompt>("Prompt", {
    name,
    title: definition.title,
    description: definition.description,
    icons: definition.icons,
    _meta: accessMetadata(definition._meta, access),
    arguments: promptArguments(argsSchema),
  });
  const metadata = Object.freeze({
    title: listing.title,
    description: listing.description,
    icons: listing.icons,
    _meta: listing._meta,
  });
  const registration: EmseepeaPrompt = {
    [DISCOVERABLE]: normalizeDiscoverable("Prompt", definition.discoverable),
    [PROMPT_NAME]: name,
    [PROMPT_ACCESS]: access,
    [HAS_COMPLETION]: completions.size > 0,
    [PROMPT_LISTING]: listing,
    [REGISTER](
      server,
      timeoutMs,
      maxApplicationResultBytes,
      maxProgressEvents,
      maxProgressEventBytes,
      requestState,
      clientLogging,
    ) {
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
              const result = await withClientReporters(
                context,
                signal,
                clientLogging,
                maxProgressEvents,
                maxProgressEventBytes,
                (reportLog, reportProgress) => handler(
                  parsedArgs.data,
                  directHandlerContext(
                    access,
                    context,
                    signal,
                    deadlineMs,
                    requestState,
                    reportLog,
                    reportProgress,
                  ),
                ),
              );
              signal.throwIfAborted();
              if (isInputRequiredResult(result)) {
                await assertInputRequired(result, requestState, context);
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

const capabilityFilename = /^(tool|resource|prompt)\.([A-Za-z0-9_.-]{1,128})\.(?:js|mjs|ts|mts)$/;
const ignoredDiscoveryArtifact = /(?:\.d\.[cm]?ts|\.(?:test|spec|bench|benchmark|fixture)\.[cm]?[jt]s|\.map)$/;
const routeFilename = /^(get|post|put|patch|delete|options)\.([A-Za-z0-9_.-]{1,128})\.(?:js|mjs|ts|mts)$/;
const routeMethods = {
  get: "GET",
  post: "POST",
  put: "PUT",
  patch: "PATCH",
  delete: "DELETE",
  options: "OPTIONS",
} as const;

export async function registerRoutes(app: FastifyInstance, root: URL): Promise<void> {
  if (!app || typeof app !== "object" || typeof app.route !== "function") {
    throw new TypeError("A Fastify application is required");
  }
  if (!(root instanceof URL) || root.protocol !== "file:" || root.search || root.hash) {
    throw new TypeError("Route root must be a local file URL without a query or fragment");
  }
  const directory = await realpath(fileURLToPath(root));
  const entries = (await readdir(directory, { withFileTypes: true }))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const routes: { method: (typeof routeMethods)[keyof typeof routeMethods]; url: string; handler: RouteHandlerMethod }[] = [];
  const identities = new Set<string>();

  for (const entry of entries) {
    if (ignoredDiscoveryArtifact.test(entry.name)) continue;
    const match = entry.name.match(routeFilename);
    if (!match) {
      if (/^(?:get|post|put|patch|delete|options)\./.test(entry.name)) {
        throw new TypeError(`Malformed route filename: ${entry.name}`);
      }
      continue;
    }
    if (!entry.isFile()) throw new TypeError(`Route module must be a regular file: ${entry.name}`);
    const method = routeMethods[match[1] as keyof typeof routeMethods];
    const segment = match[2]!;
    if (segment === "." || segment === "..") throw new TypeError(`Malformed route filename: ${entry.name}`);
    const url = segment === "index" ? "/" : `/${segment}`;
    const identity = `${method} ${url}`;
    if (identities.has(identity)) throw new TypeError(`Duplicate route: ${identity}`);
    identities.add(identity);
    const module = await import(pathToFileURL(join(directory, entry.name)).href) as Record<string, unknown>;
    if (Object.keys(module).length !== 1 || typeof module.default !== "function") {
      throw new TypeError(`Route module must export only a default handler: ${entry.name}`);
    }
    routes.push({ method, url, handler: module.default as RouteHandlerMethod });
  }

  for (const route of routes) app.route(route);
}

export async function discoverCapabilities<Context = undefined>(
  root: URL,
  context?: Context,
): Promise<DiscoveredCapabilities> {
  if (!(root instanceof URL) || root.protocol !== "file:" || root.search || root.hash) {
    throw new TypeError("Capability root must be a local file URL without a query or fragment");
  }
  const directory = await realpath(fileURLToPath(root));
  const entries = (await readdir(directory, { withFileTypes: true }))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const tools: EmseepeaTool[] = [];
  const resources: EmseepeaResource[] = [];
  const prompts: EmseepeaPrompt[] = [];

  for (const entry of entries) {
    if (ignoredDiscoveryArtifact.test(entry.name)) continue;
    const match = entry.name.match(capabilityFilename);
    if (!match) {
      if (/^(?:tool|resource|prompt)\./.test(entry.name)) {
        throw new TypeError(`Malformed capability filename: ${entry.name}`);
      }
      continue;
    }
    if (!entry.isFile()) throw new TypeError(`Capability module must be a regular file: ${entry.name}`);
    const module = await import(pathToFileURL(join(directory, entry.name)).href) as Record<string, unknown>;
    if (Object.keys(module).length !== 1 || typeof module.default !== "function") {
      throw new TypeError(`Capability module must export only a default factory: ${entry.name}`);
    }
    const capability = await (module.default as CapabilityModuleFactory<Context>)(context as Context);
    const expectedKind = match[1]!;
    const expectedName = match[2]!;
    const actual = discoveredCapabilityIdentity(capability);
    if (!actual || actual.kind !== expectedKind || actual.name !== expectedName) {
      throw new TypeError(`Capability module does not match its filename: ${entry.name}`);
    }
    if (actual.kind === "tool") tools.push(capability as EmseepeaTool);
    else if (actual.kind === "resource") resources.push(capability as EmseepeaResource);
    else prompts.push(capability as EmseepeaPrompt);
  }

  assertUniqueToolNames(tools);
  assertUniqueResources(resources);
  assertUniquePromptNames(prompts);
  return Object.freeze({
    tools: Object.freeze(tools),
    resources: Object.freeze(resources),
    prompts: Object.freeze(prompts),
  });
}

function discoveredCapabilityIdentity(
  capability: EmseepeaCapability,
): { readonly kind: "tool" | "resource" | "prompt"; readonly name: string } | undefined {
  if (!capability || typeof capability !== "object" || !(REGISTER in capability)) return undefined;
  if (TOOL_NAME in capability) return { kind: "tool", name: capability[TOOL_NAME] };
  if (RESOURCE_NAME in capability) return { kind: "resource", name: capability[RESOURCE_NAME] };
  if (PROMPT_NAME in capability) return { kind: "prompt", name: capability[PROMPT_NAME] };
  return undefined;
}

interface CheckedToolDefinition {
  readonly name: string;
  readonly discoverable?: boolean;
  readonly title?: string;
  readonly description: string;
  readonly icons?: readonly Icon[];
  readonly annotations?: Readonly<ToolAnnotations>;
  readonly _meta?: Readonly<MetaObject>;
  readonly inputSchema: z.ZodObject;
  readonly outputSchema?: StandardSchemaWithJSON;
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
  const access = normalizeCapabilityAccess("Tool", definition.access, definition.requiredScopes);
  const sdkInputSchema = sdkMetadataSchema(inputSchema);
  const sdkOutputSchema = outputSchema ? sdkOutputMetadataSchema(outputSchema) : undefined;
  const listing = checkedProtocolValue<Tool>("Tool", {
    name,
    title: definition.title,
    description: definition.description,
    icons: definition.icons,
    annotations: definition.annotations,
    inputSchema: jsonMetadataSchema(inputSchema, "input"),
    ...(outputSchema ? { outputSchema: standardJsonSchema(outputSchema, "output") } : {}),
    _meta: accessMetadata(definition._meta, access),
  });
  const metadata = Object.freeze({
    title: listing.title,
    description: listing.description,
    icons: listing.icons,
    annotations: listing.annotations,
    inputSchema: sdkInputSchema,
    ...(sdkOutputSchema ? { outputSchema: sdkOutputSchema } : {}),
    _meta: listing._meta,
  });
  const registration: EmseepeaTool = {
    [DISCOVERABLE]: normalizeDiscoverable("Tool", definition.discoverable),
    [TOOL_NAME]: name,
    [TOOL_ACCESS]: access,
    [TOOL_STREAMING]: streaming,
    [TOOL_LISTING]: listing,
    [REGISTER](
      server,
      timeoutMs,
      maxApplicationResultBytes,
      maxProgressEvents,
      maxProgressEventBytes,
      requestState,
      clientLogging,
    ) {
      const runLoggedTool = clientLogging
        ? createLoggedToolRunner(clientLogging, execute, allowsInputRequired, access, requestState)
        : undefined;
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
                if (runLoggedTool) {
                  result = await runLoggedTool(parsedInput.data, context, signal, deadlineMs, reporter);
                } else {
                  try {
                    const handlerContext = allowsInputRequired
                      ? directHandlerContext(access, context, signal, deadlineMs, requestState)
                      : {
                          signal,
                          deadlineMs,
                          principal: access === "public"
                            ? undefined
                            : principalFrom(context.http?.authInfo),
                        };
                    if (reporter) Object.assign(handlerContext, { reportProgress: reporter.report });
                    result = await execute(parsedInput.data, handlerContext);
                  } finally {
                    await reporter?.finish();
                  }
                  reporter?.throwIfFailed();
                }
                if (allowsInputRequired && isInputRequiredResult(result)) {
                  signal.throwIfAborted();
                  await assertInputRequired(result, requestState, context);
                  assertResultSize(result, maxApplicationResultBytes, deadlineMs, signal);
                  return result as InputRequiredResult;
                }
                if (!isRecord(result)) {
                  throw new Error("Tool returned an invalid result");
                }
                const publicResult = await checkedToolResult(result, outputSchema, signal);
                if (publicResult.isError === true) markCurrentProtocolOutcome("tool_error");
                assertResultSize(publicResult, maxApplicationResultBytes, deadlineMs, signal);
                return publicResult;
              },
            );
          } catch {
            markCurrentProtocolOutcome("tool_error");
            return { content: [{ type: "text", text: "Tool execution failed" }], isError: true };
          }
        },
      );
    },
  };
  return Object.freeze(registration);
}

async function checkedToolResult(
  result: Record<string, unknown>,
  outputSchema: StandardSchemaWithJSON | undefined,
  signal: AbortSignal,
): Promise<Readonly<CallToolResult>> {
  const convenience = Object.hasOwn(result, "data") || Object.hasOwn(result, "text");
  const protocol = ["content", "structuredContent", "isError", "_meta"]
    .some((field) => Object.hasOwn(result, field));
  if (convenience) {
    if (protocol || !outputSchema || !Object.hasOwn(result, "data") ||
        (result.text !== undefined && typeof result.text !== "string")) {
      throw new Error("Tool returned an invalid result");
    }
    signal.throwIfAborted();
    const parsedOutput = await outputSchema["~standard"].validate(result.data);
    if ("issues" in parsedOutput) {
      throw new Error("Tool returned output that does not match its schema");
    }
    return checkedProtocolValue<CallToolResult>("CallToolResult", {
      content: [{ type: "text", text: result.text ?? JSON.stringify(parsedOutput.value) }],
      structuredContent: parsedOutput.value,
      isError: false,
    });
  }

  if (isRecord(result._meta) && Object.hasOwn(result._meta, "io.modelcontextprotocol/serverInfo")) {
    throw new Error("Tool result metadata contains a framework-owned field");
  }
  let checked = checkedProtocolValue<CallToolResult>("CallToolResult", result);
  if (outputSchema && checked.isError !== true) {
    if (!Object.hasOwn(checked, "structuredContent")) {
      throw new Error("Tool result is missing structured content");
    }
    signal.throwIfAborted();
    const parsedOutput = await outputSchema["~standard"].validate(checked.structuredContent);
    if ("issues" in parsedOutput) {
      throw new Error("Tool returned output that does not match its schema");
    }
    checked = checkedProtocolValue<CallToolResult>("CallToolResult", {
      ...checked,
      structuredContent: parsedOutput.value,
    });
  }
  return checked;
}

type ProgressReporter = ReturnType<typeof progressReporter>;
type CheckedToolRunner = (
  input: unknown,
  context: ServerContext,
  signal: AbortSignal,
  deadlineMs: number,
  reporter: ProgressReporter | undefined,
) => Promise<unknown>;

function createLoggedToolRunner(
  clientLogging: NormalizedClientLogging,
  execute: CheckedToolExecutor,
  allowsInputRequired: boolean,
  access: "public" | ProtectedCapabilityAccess,
  requestState: RequestStateRuntime | undefined,
): CheckedToolRunner {
  return async (input, context, signal, deadlineMs, reporter) => {
    const logReporter = clientLogReporter(
      context,
      signal,
      clientLogging.maxEvents,
      clientLogging.maxEventBytes,
    );
    let result: unknown;
    try {
      result = await execute(input, {
        ...(allowsInputRequired
          ? directHandlerContext(
              access,
              context,
              signal,
              deadlineMs,
              requestState,
              logReporter.report,
            )
          : {
              signal,
              deadlineMs,
              principal: access === "public"
                ? undefined
                : principalFrom(context.http?.authInfo),
              reportLog: logReporter.report,
            }),
        ...(reporter ? { reportProgress: reporter.report } : {}),
      });
    } finally {
      await Promise.all([reporter?.finish(), logReporter.finish()]);
    }
    reporter?.throwIfFailed();
    logReporter.throwIfFailed();
    return result;
  };
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
                  await Promise.allSettled(pending);
    },
    throwIfFailed() { if (failure) throw failure; },
  };
}

function clientLogReporter(
  context: {
    readonly mcpReq: {
      readonly log: (level: LoggingLevel, data: unknown, logger?: string) => Promise<void>;
    };
  },
  signal: AbortSignal,
  maxEvents: number,
  maxEventBytes: number,
): {
  readonly report: (message: ClientLogMessage) => Promise<void>;
  readonly finish: () => Promise<void>;
  readonly throwIfFailed: () => void;
} {
  let closed = false;
  let failure: Error | undefined;
  let attempts = 0;
  const pending = new Set<Promise<void>>();
  return {
    report(message) {
      if (closed) return Promise.reject(new Error("Client logging is no longer available"));
      if (failure) return Promise.reject(failure);
      const operation = (async () => {
        try {
          signal.throwIfAborted();
          attempts += 1;
          if (attempts > maxEvents) throw new Error("Client log event limit exceeded");
          const notification = {
            method: "notifications/message" as const,
            params: {
              level: message.level,
              data: message.data,
              ...(message.logger === undefined ? {} : { logger: message.logger }),
            },
          };
          assertJsonValue(notification, new WeakSet<object>());
          const encoded = JSON.stringify(notification);
          if (Buffer.byteLength(encoded, "utf8") > maxEventBytes) {
            throw new Error("Client log event exceeds configured size limit");
          }
          const parsed = specTypeSchemas.LoggingMessageNotification["~standard"].validate(
            JSON.parse(encoded) as unknown,
          );
          if (parsed instanceof Promise || "issues" in parsed) {
            throw new Error("Client log event is invalid");
          }
          const params = parsed.value.params;
          await context.mcpReq.log(params.level, params.data, params.logger);
        } catch (error) {
          failure = error instanceof Error ? error : new Error("Client log emission failed");
          throw failure;
        }
      })();
      pending.add(operation);
      void operation.then(() => pending.delete(operation), () => pending.delete(operation));
      return operation;
    },
    async finish() {
      closed = true;
      await Promise.allSettled(pending);
    },
    throwIfFailed() { if (failure) throw failure; },
  };
}

async function withClientReporters<Result>(
  context: ServerContext,
  signal: AbortSignal,
  logging: NormalizedClientLogging | undefined,
  maxProgressEvents: number,
  maxProgressEventBytes: number,
  run: (
    reportLog?: (message: ClientLogMessage) => Promise<void>,
    reportProgress?: (update: ProgressUpdate) => Promise<void>,
  ) => Promise<Result> | Result,
): Promise<Result> {
  const logReporter = logging
    ? clientLogReporter(context, signal, logging.maxEvents, logging.maxEventBytes)
    : undefined;
  const reporter = requestOperations.getStore()?.legacy || context.mcpReq._meta?.progressToken === undefined
    ? undefined
    : progressReporter(context, signal, maxProgressEvents, maxProgressEventBytes);
  let result: Result;
  try {
    result = await run(logReporter?.report, reporter?.report);
  } finally {
    await Promise.all([logReporter?.finish(), reporter?.finish()]);
  }
  logReporter?.throwIfFailed();
  reporter?.throwIfFailed();
  return result;
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

function catalogueListings(
  tools: readonly EmseepeaTool[],
  resources: readonly EmseepeaResource[],
  prompts: readonly EmseepeaPrompt[],
  supportedTools = tools,
  supportedResources = resources,
  supportedPrompts = prompts,
): ReadonlyMap<ListMethod, readonly Readonly<Record<string, unknown>>[]> {
  const catalogues = new Map<ListMethod, readonly Readonly<Record<string, unknown>>[]>();
  if (supportedTools.length) catalogues.set("tools/list", tools.map((tool) => tool[TOOL_LISTING]));
  if (supportedResources.some((resource) => resource[RESOURCE_KIND] === "static")) {
    catalogues.set("resources/list", resources
      .filter((resource) => resource[RESOURCE_LISTING].method === "resources/list")
      .map((resource) => resource[RESOURCE_LISTING].value));
  }
  if (supportedResources.some((resource) => resource[RESOURCE_KIND] === "template")) {
    catalogues.set("resources/templates/list", resources
      .filter((resource) => resource[RESOURCE_LISTING].method === "resources/templates/list")
      .map((resource) => resource[RESOURCE_LISTING].value));
  }
  if (supportedPrompts.length) catalogues.set(
    "prompts/list",
    prompts.map((prompt) => prompt[PROMPT_LISTING]),
  );
  return catalogues;
}

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
    compiled.set(method, compileCataloguePages(method, listResultKey(method), entries, options));
  }
  return compiled;
}

function compileCataloguePages(
  method: ListMethod,
  resultKey: string,
  entries: readonly Readonly<Record<string, unknown>>[],
  options: NormalizedListPagination,
): CompiledCataloguePages {
  const groups: Readonly<Record<string, unknown>>[][] = entries.length ? [] : [[]];
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

function compileUnpaginatedCatalogue(
  catalogues: ReadonlyMap<ListMethod, readonly Readonly<Record<string, unknown>>[]>,
): CompiledListPagination {
  return new Map([...catalogues].map(([method, entries]) => [method, Object.freeze({
    first: Object.freeze({
      [listResultKey(method)]: Object.freeze([...entries]),
    }),
    byCursor: new Map(),
  })]));
}

function listResultKey(method: ListMethod): "tools" | "resources" | "resourceTemplates" | "prompts" {
  if (method === "tools/list") return "tools";
  if (method === "prompts/list") return "prompts";
  return method === "resources/templates/list" ? "resourceTemplates" : "resources";
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
  const observability = normalizeObservability(options.observability);
  const callerClassifications = normalizeCallerClassifications(options.callerClassifications);
  const readiness = options.readiness;
  const readinessTimeoutMs = callbackTimeout("readiness", readiness, "readinessTimeoutMs", options.readinessTimeoutMs);
  const stopping = new AbortController();
  let pendingReadiness: Promise<boolean> | undefined;
  async function ready(): Promise<boolean> {
    if (stopping.signal.aborted) return false;
    if (!readiness) return true;
    if (!pendingReadiness) {
      const deadline = Date.now() + readinessTimeoutMs;
      pendingReadiness = runWithDeadline(stopping.signal, deadline, async (signal) => {
        try { return await readiness({ signal }) === true && Date.now() < deadline; }
        finally { pendingReadiness = undefined; }
      }).catch(() => false);
    }
    const result = await pendingReadiness;
    return result && !stopping.signal.aborted;
  }
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
  const tools = Object.freeze([...(options.tools ?? []), ...(options.additionalTools ?? [])]);
  const resources = Object.freeze([...(options.resources ?? [])]);
  const prompts = Object.freeze([...(options.prompts ?? [])]);
  const discoverableTools = Object.freeze(tools.filter((tool) => tool[DISCOVERABLE]));
  const discoverableResources = Object.freeze(resources.filter((resource) => resource[DISCOVERABLE]));
  const discoverablePrompts = Object.freeze(prompts.filter((prompt) => prompt[DISCOVERABLE]));
  assertUniqueToolNames(tools);
  assertUniqueResources(resources);
  assertUniquePromptNames(prompts);
  const paginationOptions = options.listPagination
    ? normalizeListPagination(options.listPagination)
    : undefined;
  const maxRequestBytes = positiveInteger("maxRequestBytes", options.maxRequestBytes ?? 1024 * 1024);
  if (options.clientRoots !== undefined && !isRecord(options.clientRoots)) {
    throw new TypeError("clientRoots must be an object");
  }
  const maxClientRoots = options.clientRoots === undefined ? undefined
    : positiveInteger("clientRoots.maxRoots", options.clientRoots.maxRoots === undefined ? 100 : options.clientRoots.maxRoots);
  const requestState = options.requestState
    ? createRequestStateRuntime(options.requestState)
    : undefined;
  const maxApplicationResultBytes = positiveInteger(
    "maxApplicationResultBytes",
    options.maxApplicationResultBytes ?? 1024 * 1024,
  );
  const clientLoggingOptions = options.clientLogging;
  if (clientLoggingOptions !== undefined && !isRecord(clientLoggingOptions)) {
    throw new TypeError("clientLogging must be an object");
  }
  const clientLogging = clientLoggingOptions === undefined
    ? undefined
    : Object.freeze({
        maxEvents: positiveInteger(
          "clientLogging.maxEvents",
          (clientLoggingOptions as ClientLoggingOptions).maxEvents ?? 32,
        ),
        maxEventBytes: positiveInteger(
          "clientLogging.maxEventBytes",
          (clientLoggingOptions as ClientLoggingOptions).maxEventBytes ?? 8 * 1024,
        ),
      });
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
  const resourceSubscriptions = options.resourceSubscriptions && Object.freeze({
    maxActive: positiveInteger("resourceSubscriptions.maxActive", options.resourceSubscriptions.maxActive ?? 16),
    maxEvents: positiveInteger("resourceSubscriptions.maxEvents", options.resourceSubscriptions.maxEvents ?? 256),
    maxEventBytes: positiveInteger(
      "resourceSubscriptions.maxEventBytes",
      options.resourceSubscriptions.maxEventBytes ?? 8 * 1024,
    ),
    maxUriBytes: positiveInteger(
      "resourceSubscriptions.maxUriBytes",
      options.resourceSubscriptions.maxUriBytes ?? 512,
    ),
    lifetimeMs: positiveInteger(
      "resourceSubscriptions.lifetimeMs",
      options.resourceSubscriptions.lifetimeMs ?? 30_000,
    ),
  });
  const deployment = normalizeDeployment(options.deployment ?? { mode: "loopback" });
  const authentication = options.authentication
    ? normalizeAuthentication(options.authentication)
    : undefined;
  const hasStreaming = tools.some((tool) => tool[TOOL_STREAMING]);
  const hasProgress = hasStreaming || resources.length > 0 || prompts.length > 0;
  if ([
    ...tools.map((tool) => tool[TOOL_ACCESS]),
    ...resources.map((resource) => resource[RESOURCE_ACCESS]),
    ...prompts.map((prompt) => prompt[PROMPT_ACCESS]),
  ].some((access) => access !== "public") && !authentication) {
    throw new TypeError("Protected capabilities require authentication configuration");
  }
  const toolsByName = new Map(tools.map((tool) => [tool[TOOL_NAME], tool]));
  const resourcesByUri = new Map(resources
    .filter((resource) => resource[RESOURCE_KIND] === "static")
    .map((resource) => [resource[RESOURCE_URI], resource]));
  const resourceTemplates = resources.filter((resource) => resource[RESOURCE_KIND] === "template");
  const promptsByName = new Map(prompts.map((prompt) => [prompt[PROMPT_NAME], prompt]));
  const enabledMethods = new Set(["server/discover"]);
  if (tools.length) enabledMethods.add("tools/list").add("tools/call");
  if (resources.length) enabledMethods.add("resources/list").add("resources/read");
  if (resources.some((resource) => resource[RESOURCE_KIND] === "template")) {
    enabledMethods.add("resources/templates/list");
  }
  if (resourceSubscriptions && resources.length) enabledMethods.add("subscriptions/listen");
  if (prompts.length) enabledMethods.add("prompts/list").add("prompts/get");
  const hasCompletion = resources.some((resource) => resource[HAS_COMPLETION]) ||
    prompts.some((prompt) => prompt[HAS_COMPLETION]);
  if (hasCompletion) enabledMethods.add("completion/complete");
  const cacheHints = options.cacheHints === undefined
    ? undefined
    : normalizeCacheHints(options.cacheHints, enabledMethods);
  const baseCatalogues = catalogueListings(
    discoverableTools,
    discoverableResources,
    discoverablePrompts,
    tools,
    resources,
    prompts,
  );
  const hasSuppressedCapabilities = discoverableTools.length !== tools.length ||
    discoverableResources.length !== resources.length || discoverablePrompts.length !== prompts.length;
  const basePagination = paginationOptions
    ? compileListPagination(paginationOptions, baseCatalogues)
    : hasSuppressedCapabilities
      ? compileUnpaginatedCatalogue(baseCatalogues)
      : undefined;
  const resourceEvents = resourceSubscriptions ? new InMemoryServerEventBus() : undefined;
  const activeSubscriptions = new Set<{ close: () => Promise<void> }>();
  const sdkHandler = createMcpHandler(() => {
    const request = requestOperations.getStore();
    const activeTools = request?.filterCatalogues
      ? tools.filter((tool) => accessAllows(tool[TOOL_ACCESS], request.principal))
      : tools;
    const activeResources = request?.filterCatalogues
      ? resources.filter((resource) => accessAllows(resource[RESOURCE_ACCESS], request.principal))
      : resources;
    const activePrompts = request?.filterCatalogues
      ? prompts.filter((prompt) => accessAllows(prompt[PROMPT_ACCESS], request.principal))
      : prompts;
    const activeDiscoverableTools = request?.filterCatalogues
      ? discoverableTools.filter((tool) => accessAllows(tool[TOOL_ACCESS], request.principal))
      : discoverableTools;
    const activeDiscoverableResources = request?.filterCatalogues
      ? discoverableResources.filter((resource) => accessAllows(resource[RESOURCE_ACCESS], request.principal))
      : discoverableResources;
    const activeDiscoverablePrompts = request?.filterCatalogues
      ? discoverablePrompts.filter((prompt) => accessAllows(prompt[PROMPT_ACCESS], request.principal))
      : discoverablePrompts;
    const activeHasCompletion = activeResources.some((resource) => resource[HAS_COMPLETION]) ||
      activePrompts.some((prompt) => prompt[HAS_COMPLETION]);
    const activeClientLogging = request?.legacy ? undefined : clientLogging;
    const server = new McpServer(
      serverInfo,
      {
        capabilities: {
          ...(activeTools.length ? { tools: { listChanged: false } } : {}),
          ...(activeResources.length ? {
            resources: {
              subscribe: Boolean(resourceSubscriptions) && !request?.legacy,
              listChanged: false,
            },
          } : {}),
          ...(activePrompts.length ? { prompts: { listChanged: false } } : {}),
          ...(activeHasCompletion ? { completions: {} } : {}),
          ...(activeClientLogging ? { logging: {} } : {}),
        },
        instructions: options.instructions,
        cacheHints: request?.filterCatalogues || request?.legacy ? undefined : cacheHints,
        supportedProtocolVersions: [...SUPPORTED_PROTOCOLS],
        ...(requestState && !request?.legacy ? { requestState: { verify: requestState.verify } } : {}),
      },
    );
    for (const tool of activeTools) {
      tool[REGISTER](
        server,
        operationTimeoutMs,
        maxApplicationResultBytes,
        maxProgressEvents,
        maxProgressEventBytes,
        requestState,
        activeClientLogging,
      );
    }
    for (const resource of activeResources) {
      resource[REGISTER](
        server,
        operationTimeoutMs,
        maxApplicationResultBytes,
        maxProgressEvents,
        maxProgressEventBytes,
        requestState,
        activeClientLogging,
      );
    }
    for (const prompt of activePrompts) {
      prompt[REGISTER](
        server,
        operationTimeoutMs,
        maxApplicationResultBytes,
        maxProgressEvents,
        maxProgressEventBytes,
        requestState,
        activeClientLogging,
      );
    }
    const filteredCatalogues = request?.filterCatalogues
      ? catalogueListings(
          activeDiscoverableTools,
          activeDiscoverableResources,
          activeDiscoverablePrompts,
          activeTools,
          activeResources,
          activePrompts,
        )
      : undefined;
    const pagination = filteredCatalogues
      ? paginationOptions
        ? compileListPagination(paginationOptions, filteredCatalogues)
        : activeDiscoverableTools.length !== activeTools.length ||
            activeDiscoverableResources.length !== activeResources.length ||
            activeDiscoverablePrompts.length !== activePrompts.length
          ? compileUnpaginatedCatalogue(filteredCatalogues)
          : undefined
      : basePagination;
    if (pagination) installListPagination(server, pagination);
    return server;
  }, {
    onerror: () => markCurrentProtocolOutcome("protocol_error"),
    responseMode: hasProgress || resourceSubscriptions || clientLogging ? "auto" : "json",
    keepAliveMs: 0,
  });
  const nodeHandler = toNodeHandler(sdkHandler);
  const app = createMcpFastifyApp({ host: deployment.mode === "loopback" ? "127.0.0.1" : "0.0.0.0" });
  async function serveResourceSubscription(
    request: FastifyRequest,
    reply: FastifyReply,
    uri: string,
  ): Promise<void> {
    if (!resourceSubscriptions || !resourceEvents) return;
    if (activeSubscriptions.size >= resourceSubscriptions.maxActive) {
      await sendRpcError(reply, 503, -32603, "Subscription capacity is exhausted", requestId(
        isRecord(request.body) ? request.body.id : undefined,
      ));
      return;
    }
    const subscriptionId = requestId(isRecord(request.body) ? request.body.id : undefined);
    const totalByteLimit = Math.min(
      Number.MAX_SAFE_INTEGER,
      resourceSubscriptions.maxEvents * resourceSubscriptions.maxEventBytes,
    );
    let admitted = 0;
    let admittedBytes = 0;
    let detach = () => {};
    let ended = false;
    const boundedBus: ServerEventBus = {
      publish: (event) => resourceEvents.publish(event),
      subscribe(listener) {
        detach = resourceEvents.subscribe((event: ServerEvent) => {
          if (ended || event.kind !== "resource_updated" || event.uri !== uri) return;
          const frameBytes = Buffer.byteLength(`event: message\ndata: ${JSON.stringify({
            jsonrpc: "2.0",
            method: "notifications/resources/updated",
            params: {
              uri,
              _meta: { "io.modelcontextprotocol/subscriptionId": subscriptionId },
            },
          })}\n\n`, "utf8");
          if (frameBytes > resourceSubscriptions.maxEventBytes ||
              admitted >= resourceSubscriptions.maxEvents ||
              admittedBytes + frameBytes > totalByteLimit) {
            ended = true;
            detach();
            reply.raw.destroy();
            return;
          }
          admitted += 1;
          admittedBytes += frameBytes;
          listener(event);
        });
        return () => {
          ended = true;
          detach();
        };
      },
    };
    const handler = createMcpHandler(() => new McpServer(serverInfo, {
      capabilities: { resources: { subscribe: true, listChanged: false } },
      supportedProtocolVersions: [PROTOCOL_VERSION],
    }), {
      legacy: "reject",
      onerror: () => markObservabilityProtocolError(request),
      responseMode: "sse",
      bus: boundedBus,
      maxSubscriptions: 1,
      keepAliveMs: 0,
    });
    activeSubscriptions.add(handler);
    const lifetime = setTimeout(() => { void handler.close(); }, resourceSubscriptions.lifetimeMs);
    lifetime.unref();
    const closeDisconnected = () => {
      activeSubscriptions.delete(handler);
      void handler.close();
    };
    reply.raw.once("close", closeDisconnected);
    reply.hijack();
    try {
      await toNodeHandler(handler)(request.raw, reply.raw, request.body);
    } finally {
      reply.raw.off("close", closeDisconnected);
      clearTimeout(lifetime);
      activeSubscriptions.delete(handler);
      await handler.close();
    }
  }
  const observabilityLimits = observability.length ? { deliveryTimeoutMs: 1_000 } : undefined;
  const finishObservability = observabilityLimits
    ? installObservability(app, observability, (body) => capabilityNameForRequest(
        body,
        toolsByName,
        resourcesByUri,
        resourceTemplates,
        promptsByName,
      ), callerClassifications, observabilityLimits)
    : undefined;
  const limiter = deployment.mode === "production-behind-proxy"
    ? new FixedWindowRateLimiter(deployment.rateLimit)
    : undefined;

  app.get("/healthz", health("ok\n"));
  app.get("/readyz", async (_request, reply) => {
    const available = await ready();
    await reply.header("cache-control", "no-store").type("text/plain; charset=utf-8")
      .code(available ? 200 : 503).send(available ? "ready\n" : "not ready\n");
  });
  app.addHook("preClose", async () => {
    stopping.abort();
    await Promise.all([...activeSubscriptions].map((handler) => handler.close()));
  });
  if (authentication) {
    app.all("/.well-known/*", async (request, reply) => {
      const response = oauthMetadataResponse(
        new Request(new URL(request.url, authentication.metadata.resourceServerUrl.origin), {
          method: request.method,
        }),
        authentication.metadata,
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
    const protocolVersionHeader = singleHeader(request.raw.rawHeaders, "mcp-protocol-version");
    const mcpMethodHeader = singleHeader(request.raw.rawHeaders, "mcp-method");
    const mcpNameHeader = singleHeader(request.raw.rawHeaders, "mcp-name");
    if (protocolVersionHeader === null || mcpMethodHeader === null || mcpNameHeader === null) {
      await sendRpcError(reply, 400, -32020, "Conflicting MCP headers", requestId(
        isRecord(request.body) ? request.body.id : undefined,
      ));
      return;
    }
    const classification = classifyInboundRequest({
      httpMethod: request.method,
      ...(protocolVersionHeader ? { protocolVersionHeader } : {}),
      ...(mcpMethodHeader ? { mcpMethodHeader } : {}),
      ...(mcpNameHeader ? { mcpNameHeader } : {}),
      body: request.body,
    });
    if (classification.kind === "reject") {
      await sendRpcError(
        reply,
        classification.httpStatus,
        classification.code,
        classification.message,
        requestId(isRecord(request.body) ? request.body.id : undefined),
        isRecord(classification.data) ? classification.data : undefined,
      );
      return;
    }
    const legacy = classification.kind === "legacy";
    if (legacy && classification.requestedVersion &&
        !LEGACY_PROTOCOL_VERSIONS.includes(classification.requestedVersion)) {
      await sendRpcError(
        reply,
        400,
        ProtocolErrorCode.UnsupportedProtocolVersion,
        `Unsupported protocol version for the initialize handshake: ` +
          `${classification.requestedVersion}. The initialize handshake accepts only the ` +
          `legacy revisions listed in data.supported. MCP ${PROTOCOL_VERSION} does not use ` +
          `initialize: send each request with the MCP-Protocol-Version header and a matching ` +
          `_meta protocol version instead.`,
        requestId(isRecord(request.body) ? request.body.id : undefined),
        { requested: classification.requestedVersion, supported: [...LEGACY_PROTOCOL_VERSIONS] },
      );
      return;
    }
    if (!await validateMcpRequestHeaders(request, reply, legacy)) return;
    if (!legacy && isRecord(request.body) && typeof request.body.method === "string" &&
        !enabledMethods.has(request.body.method)) {
      await sendRpcError(reply, 404, -32601, "Method not found", requestId(request.body.id));
      return;
    }
    const protectsCatalogue = authentication?.discovery === "protected";
    let subscriptionTarget: ReturnType<typeof resourceSubscriptionTarget> | undefined;
    if (!legacy && isRecord(request.body) && request.body.method === "subscriptions/listen") {
      try {
        subscriptionTarget = resourceSubscriptionTarget(
          request.body,
          resourceSubscriptions!.maxUriBytes,
          resourcesByUri,
          resourceTemplates,
        );
      } catch {
        await sendRpcError(reply, 400, -32602, "Invalid resource subscription", requestId(request.body.id));
        return;
      }
      if (!subscriptionTarget.resource && !protectsCatalogue) {
        await sendRpcError(reply, 200, -32602, "Capability not found", requestId(request.body.id));
        return;
      }
    }
    const access = subscriptionTarget?.resource?.[RESOURCE_ACCESS] ?? capabilityAccessForRequest(
      request.body,
      toolsByName,
      resourcesByUri,
      resourceTemplates,
      promptsByName,
    );
    if (isCapabilityInvocation(request.body) && access === undefined) {
      markObservabilityProtocolError(request);
    }
    let authInfo: AuthInfo | undefined;
    if (authentication && (protectsCatalogue || access && access !== "public")) {
      try {
        authInfo = await verifyAuthenticatedRequest(
          request,
          reply,
          protectsCatalogue ? [] : (access as ProtectedCapabilityAccess).requiredScopes,
          authentication,
        );
        (request.raw as typeof request.raw & { auth?: AuthInfo }).auth = authInfo;
      } catch (error) {
        await sendWebResponse(reply, bearerAuthChallengeResponse(safeOAuthError(error), {
          requiredScopes: protectsCatalogue
            ? []
            : [...(access as ProtectedCapabilityAccess).requiredScopes],
          resourceMetadataUrl: authentication.resourceMetadataUrl,
        }));
        return;
      }
    }
    const principal = authInfo ? principalFrom(authInfo) : undefined;
    if (protectsCatalogue) reply.raw.setHeader("cache-control", "private, no-store");
    if (protectsCatalogue && isCapabilityInvocation(request.body) &&
        (access === undefined || !accessAllows(access, principal))) {
      await sendRpcError(reply, 200, -32602, "Capability not found", requestId(
        isRecord(request.body) ? request.body.id : undefined,
      ));
      return;
    }
    if (subscriptionTarget) {
      await serveResourceSubscription(request, reply, subscriptionTarget.uri);
      return;
    }
    const capability = capabilityNameForRequest(
      request.body,
      toolsByName,
      resourcesByUri,
      resourceTemplates,
      promptsByName,
    );
    const disconnected = new AbortController();
    const abort = () => disconnected.abort();
    request.raw.once("aborted", abort);
    reply.raw.once("close", abort);
    if (requestAlreadyClosed(request, reply)) abort();
    reply.hijack();
    try {
      await requestOperations.run(
        {
          deadlineMs: Date.now() + operationTimeoutMs,
          signal: disconnected.signal,
          principal,
          filterCatalogues: protectsCatalogue,
          capability,
          legacy,
          maxClientRoots,
          observability: observabilityState(request),
        },
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
  runtimes.set(app, {
    deployment,
    requestTimeoutMs: operationTimeoutMs + 5_000,
    stopping,
    observabilityLimits,
    finishObservability,
    ...(resourceEvents ? {
      notifyResourceUpdated(uri: string) {
        if (stopping.signal.aborted) throw new Error("Cannot notify from a stopped Em See Pea app");
        if (typeof uri !== "string" || Buffer.byteLength(uri, "utf8") > resourceSubscriptions!.maxUriBytes ||
            !(resourcesByUri.has(uri) || resourceTemplates.some(
              (resource) => resource[RESOURCE_MATCHES]?.(uri),
            ))) {
          throw new TypeError("Resource update URI must match a registered resource");
        }
        resourceEvents.publish({ kind: "resource_updated", uri });
      },
    } : {}),
  });
  return app;
}

export function notifyResourceUpdated(app: FastifyInstance, uri: string): void {
  const notify = runtimes.get(app)?.notifyResourceUpdated;
  if (!notify) throw new TypeError("notifyResourceUpdated requires resourceSubscriptions");
  notify(uri);
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

async function verifyAuthenticatedRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  requiredScopes: readonly string[],
  authentication: NormalizedOAuth,
): Promise<AuthInfo> {
  const disconnected = new AbortController();
  const abort = () => disconnected.abort();
  request.raw.once("aborted", abort);
  reply.raw.once("close", abort);
  if (requestAlreadyClosed(request, reply)) abort();
  try {
    const authInfo = await runWithDeadline(
      disconnected.signal,
      Date.now() + authentication.verificationTimeoutMs,
      () => verifyBearerToken(singleHeader(request.raw.rawHeaders, "authorization"), {
        verifier: {
          async verifyAccessToken(token) {
            const authInfo = await authentication.verifier.verifyAccessToken(token);
            principalFrom(authInfo);
            return authInfo;
          },
        },
        requiredScopes: [...requiredScopes],
        resourceMetadataUrl: authentication.resourceMetadataUrl,
      }),
    );
    if (!authInfo.resource || authInfo.resource.hash || !checkResourceAllowed({
      requestedResource: authInfo.resource,
      configuredResource: authentication.metadata.resourceServerUrl,
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

function capabilityAccessForRequest(
  body: unknown,
  toolsByName: ReadonlyMap<string, EmseepeaTool>,
  resourcesByUri: ReadonlyMap<string, EmseepeaResource>,
  resourceTemplates: readonly EmseepeaResource[],
  promptsByName: ReadonlyMap<string, EmseepeaPrompt>,
): "public" | ProtectedCapabilityAccess | undefined {
  if (!isRecord(body) || !isRecord(body.params)) return undefined;
  const params = body.params;
  if (body.method === "tools/call" && typeof params.name === "string") {
    return toolsByName.get(params.name)?.[TOOL_ACCESS];
  }
  if (body.method === "resources/read" && typeof params.uri === "string") {
    return resourcesByUri.get(params.uri)?.[RESOURCE_ACCESS] ?? resourceTemplates.find(
      (resource) => resource[RESOURCE_MATCHES]?.(params.uri as string),
    )?.[RESOURCE_ACCESS];
  }
  if (body.method === "prompts/get" && typeof params.name === "string") {
    return promptsByName.get(params.name)?.[PROMPT_ACCESS];
  }
  if (body.method === "completion/complete" && isRecord(params.ref)) {
    const reference = params.ref;
    if (reference.type === "ref/prompt" && typeof reference.name === "string") {
      return promptsByName.get(reference.name)?.[PROMPT_ACCESS];
    }
    if (reference.type === "ref/resource" && typeof reference.uri === "string") {
      return resourceTemplates.find(
        (resource) => resource[RESOURCE_URI] === reference.uri,
      )?.[RESOURCE_ACCESS];
    }
  }
  return undefined;
}

function resourceSubscriptionTarget(
  body: unknown,
  maxUriBytes: number,
  resourcesByUri: ReadonlyMap<string, EmseepeaResource>,
  resourceTemplates: readonly EmseepeaResource[],
): { readonly uri: string; readonly resource?: EmseepeaResource } {
  if (!isRecord(body) || body.method !== "subscriptions/listen" || !isRecord(body.params) ||
      !isRecord(body.params.notifications)) {
    throw new TypeError("Invalid resource subscription");
  }
  const notifications = body.params.notifications;
  if (Object.keys(notifications).some((key) => key !== "resourceSubscriptions") ||
      !Array.isArray(notifications.resourceSubscriptions) ||
      notifications.resourceSubscriptions.length !== 1 ||
      typeof notifications.resourceSubscriptions[0] !== "string" ||
      Buffer.byteLength(notifications.resourceSubscriptions[0], "utf8") > maxUriBytes) {
    throw new TypeError("Invalid resource subscription");
  }
  const uri = notifications.resourceSubscriptions[0];
  return {
    uri,
    resource: resourcesByUri.get(uri) ?? resourceTemplates.find(
      (candidate) => candidate[RESOURCE_MATCHES]?.(uri),
    ),
  };
}

function isCapabilityInvocation(body: unknown): boolean {
  return isRecord(body) && (
    body.method === "tools/call" || body.method === "resources/read" ||
    body.method === "prompts/get" || body.method === "completion/complete" ||
    body.method === "subscriptions/listen"
  );
}

function capabilityNameForRequest(
  body: unknown,
  toolsByName: ReadonlyMap<string, EmseepeaTool>,
  resourcesByUri: ReadonlyMap<string, EmseepeaResource>,
  resourceTemplates: readonly EmseepeaResource[],
  promptsByName: ReadonlyMap<string, EmseepeaPrompt>,
): string | undefined {
  if (!isRecord(body) || !isRecord(body.params)) return undefined;
  const params = body.params;
  if (body.method === "tools/call" && typeof params.name === "string") {
    return toolsByName.has(params.name) ? params.name : undefined;
  }
  if (body.method === "resources/read" && typeof params.uri === "string") {
    const resource = resourcesByUri.get(params.uri) ?? resourceTemplates.find(
      (candidate) => candidate[RESOURCE_MATCHES]?.(params.uri as string),
    );
    return resource?.[RESOURCE_NAME];
  }
  if (body.method === "subscriptions/listen" && isRecord(params.notifications) &&
      Array.isArray(params.notifications.resourceSubscriptions) &&
      typeof params.notifications.resourceSubscriptions[0] === "string") {
    const uri = params.notifications.resourceSubscriptions[0];
    return (resourcesByUri.get(uri) ?? resourceTemplates.find(
      (candidate) => candidate[RESOURCE_MATCHES]?.(uri),
    ))?.[RESOURCE_NAME];
  }
  if (body.method === "prompts/get" && typeof params.name === "string") {
    return promptsByName.has(params.name) ? params.name : undefined;
  }
  if (body.method === "completion/complete" && isRecord(params.ref)) {
    const reference = params.ref;
    return reference.type === "ref/prompt" && typeof reference.name === "string"
      ? (promptsByName.has(reference.name) ? reference.name : undefined)
      : reference.type === "ref/resource" && typeof reference.uri === "string"
        ? resourceTemplates.find((candidate) => candidate[RESOURCE_URI] === reference.uri)?.[RESOURCE_NAME]
        : undefined;
  }
  return undefined;
}

function principalFrom(authInfo: AuthInfo | undefined): Principal {
  if (!authInfo) throw new Error("Protected capability reached execution without verified authorization");
  if (typeof authInfo.clientId !== "string" || !authInfo.clientId.trim() || authInfo.clientId.length > 256) {
    throw new TypeError("Authentication verifier returned an invalid clientId");
  }
  if (!Array.isArray(authInfo.scopes) || authInfo.scopes.some(
    (scope) => typeof scope !== "string" || !/^[\x21\x23-\x5B\x5D-\x7E]+$/.test(scope),
  ) || new Set(authInfo.scopes).size !== authInfo.scopes.length) {
    throw new TypeError("Authentication verifier returned invalid permissions");
  }
  const permissions = Object.freeze([...authInfo.scopes]);
  return Object.freeze({
    clientId: authInfo.clientId,
    permissions,
    resource: authInfo.resource?.href,
  });
}

function accessAllows(
  access: "public" | ProtectedCapabilityAccess,
  principal: Principal | undefined,
): boolean {
  if (access === "public") return true;
  return principal !== undefined &&
    access.requiredScopes.every((permission) => principal.permissions.includes(permission));
}

export async function serveEmseepea(
  app: FastifyInstance,
  options: ServeOptions = {},
): Promise<RunningEmseepeaServer> {
  const runtime = runtimes.get(app);
  if (!runtime) throw new TypeError("serveEmseepea requires an app created by createEmseepea");
  const host = options.host ?? (runtime.deployment.mode === "loopback" ? "127.0.0.1" : "0.0.0.0");
  if (runtime.deployment.mode === "loopback" && !isLoopbackHost(host)) {
    throw new TypeError("The loopback deployment profile cannot bind publicly");
  }
  const port = nonNegativePort(options.port ?? 3000);
  const shutdownTimeoutMs = positiveInteger("shutdownTimeoutMs", options.shutdownTimeoutMs ?? 5_000);
  const observabilityFlushTimeoutMs = positiveInteger(
    "observabilityFlushTimeoutMs",
    options.observabilityFlushTimeoutMs === undefined ? 1_000 : options.observabilityFlushTimeoutMs,
  );
  if (observabilityFlushTimeoutMs > 60_000) {
    throw new TypeError("observabilityFlushTimeoutMs must not exceed 60000");
  }
  if (runtime.observabilityLimits) {
    runtime.observabilityLimits.deliveryTimeoutMs = observabilityFlushTimeoutMs;
  }
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
    close: () => {
      runtime.stopping.abort();
      return closing ??= closeApp(
        app,
        shutdownTimeoutMs,
        observabilityFlushTimeoutMs,
        runtime.finishObservability,
      );
    },
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
  markObservabilityProtocolError(reply.request);
  await reply.code(status).send({
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data ? { data } : {}) },
  });
}

function markCurrentProtocolOutcome(outcome: "tool_error" | "protocol_error"): void {
  const state = requestOperations.getStore()?.observability;
  if (!state || state.protocolOutcome === "protocol_error") return;
  state.protocolOutcome = outcome;
}

function markObservabilityProtocolError(request: FastifyRequest): void {
  const state = observabilityState(request);
  if (state) state.protocolOutcome = "protocol_error";
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

/**
 * The client address out of `x-forwarded-for`, counted from the end.
 *
 * Counting from the end is the whole point. Proxies APPEND, so the entries
 * nearest the end are the ones written by infrastructure and the ones nearest
 * the start are whatever the caller sent. `hops` says how many of those
 * trailing entries belong to infrastructure; the client is the one just
 * before them.
 *
 * At 0 nothing trustworthy appends, so a header with more than one entry is
 * not evidence of anything and is refused rather than read.
 */
function forwardedClient(forwardedFor: string | null | undefined, hops: number): string | undefined {
  if (!forwardedFor) return undefined;
  const entries = forwardedFor.split(",").map((entry) => entry.trim());
  if (hops === 0) return entries.length === 1 ? normalizeIp(entries[0]) : undefined;
  if (entries.length <= hops) return undefined;
  return normalizeIp(entries[entries.length - 1 - hops]);
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
  // ADR-0102: the boundary is either an address the proxy connects from, or a
  // secret the proxy injects that a caller cannot know. Exactly one is
  // configured, and `normalizeDeployment` refuses a profile with neither, so
  // the `else` below is reached only when a boundary was proved by header.
  if (deployment.proxyBoundary !== undefined) {
    if (!provedProxyHop(request.raw.rawHeaders, deployment.proxyBoundary)) {
      // The same message as the address failure: naming the header or saying
      // the value was close would help a caller guess at it.
      return reject(403, "Request did not come from a trusted proxy");
    }
  } else {
    const peer = normalizeIp(request.raw.socket.remoteAddress);
    if (!deployment.trustedProxyAddresses?.has(peer ?? "")) {
      return reject(403, "Request did not come from a trusted proxy");
    }
  }
  const proto = singleHeader(request.raw.rawHeaders, "x-forwarded-proto");
  const forwardedFor = singleHeader(request.raw.rawHeaders, "x-forwarded-for");
  const host = singleHeader(request.raw.rawHeaders, "host");
  const origin = singleHeader(request.raw.rawHeaders, "origin");
  const client = forwardedClient(forwardedFor, deployment.forwardedHops);
  if (proto !== "https" || !client) {
    // ADR-0102: the operator calibrating forwardedHops needs to know the header
    // was too short for what was declared; the caller must not be told, because
    // a refused caller who learns that could add prefix entries until they are
    // served. The response is the same generic message for every reason.
    if (forwardedFor !== null && forwardedFor !== undefined
        && forwardedFor.split(",").length <= deployment.forwardedHops) {
      const state = observabilityState(request);
      if (state) state.forwardingRefusal = "hop-count-mismatch";
    }
    return reject(403, "Invalid forwarding metadata");
  }
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

function normalizeCapabilityAccess(
  kind: string,
  access: unknown,
  requiredScopes: unknown,
): "public" | ProtectedCapabilityAccess {
  if (access === "public") return access;
  if (access !== "protected" || !Array.isArray(requiredScopes) || requiredScopes.length === 0) {
    throw new TypeError(`${kind} access must be explicitly declared as "public" or protected with scopes`);
  }
  const scopes = requiredScopes.map((scope) => {
    if (typeof scope !== "string" || !/^[\x21\x23-\x5B\x5D-\x7E]+$/.test(scope)) {
      throw new TypeError(`Protected ${kind.toLowerCase()} scopes must be valid OAuth scope tokens`);
    }
    return scope;
  });
  if (new Set(scopes).size !== scopes.length) {
    throw new TypeError(`Protected ${kind.toLowerCase()} scopes must be unique`);
  }
  return { type: "protected", requiredScopes: scopes };
}

function normalizeDiscoverable(kind: string, value: unknown): boolean {
  if (value === undefined || value === true) return true;
  if (value === false) return false;
  throw new TypeError(`${kind} discoverable must be a boolean`);
}

function accessMetadata(
  metadata: Readonly<MetaObject> | undefined,
  access: "public" | ProtectedCapabilityAccess,
): Readonly<MetaObject> {
  return Object.freeze({
    ...metadata,
    "io.emseepea/access": access === "public"
      ? Object.freeze({ type: "public" as const })
      : Object.freeze({ type: "protected" as const, requiredScopes: [...access.requiredScopes] }),
  });
}

function normalizeAuthentication(options: AuthenticationOptions): NormalizedOAuth {
  if (!options.verifier || typeof options.verifier.verifyAccessToken !== "function") {
    throw new TypeError("authentication.verifier must implement verifyAccessToken");
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
      "authentication.verificationTimeoutMs",
      options.verificationTimeoutMs ?? 10_000,
    ),
    discovery: options.discovery === undefined || options.discovery === "public"
      ? "public"
      : options.discovery === "protected"
        ? "protected"
        : (() => { throw new TypeError('authentication.discovery must be "public" or "protected"'); })(),
  };
}

function normalizeObservability(
  adapters: readonly ObservabilityAdapter[] | undefined,
): readonly ObservabilityAdapter[] {
  if (adapters === undefined) return [];
  if (!Array.isArray(adapters)) throw new TypeError("observability must be an array");
  const ids = new Set<string>();
  return Object.freeze(adapters.map((adapter) => {
    if (!adapter || typeof adapter !== "object" ||
        typeof adapter.id !== "string" || !/^[A-Za-z0-9_.-]{1,64}$/.test(adapter.id) ||
        typeof adapter.emit !== "function" ||
        adapter.flush !== undefined && typeof adapter.flush !== "function") {
      throw new TypeError("observability adapters require a valid id, emit function, and optional flush function");
    }
    if (ids.has(adapter.id)) throw new TypeError(`Duplicate observability adapter id: ${adapter.id}`);
    ids.add(adapter.id);
    return Object.freeze({
      id: adapter.id,
      emit: adapter.emit,
      ...(adapter.flush ? { flush: adapter.flush } : {}),
    });
  }));
}

function normalizeCallerClassifications(
  classifications: readonly CallerClassification[] | undefined,
): readonly CallerClassification[] | undefined {
  if (classifications === undefined) return undefined;
  if (!Array.isArray(classifications) || classifications.length < 1 || classifications.length > 16) {
    throw new TypeError("callerClassifications must contain 1 to 16 entries");
  }
  const normalized = classifications.map((classification) => {
    if (!classification || typeof classification !== "object" ||
        typeof classification.id !== "string" || classification.id === "_OTHER" ||
        !/^[A-Za-z0-9_.-]{1,64}$/.test(classification.id) ||
        typeof classification.userAgentPrefix !== "string" ||
        classification.userAgentPrefix.length < 1 || classification.userAgentPrefix.length > 128) {
      throw new TypeError("caller classifications require a valid id and 1 to 128 character user-agent prefix");
    }
    return Object.freeze({ id: classification.id, userAgentPrefix: classification.userAgentPrefix });
  });
  for (const [index, classification] of normalized.entries()) {
    if (normalized.some((other, otherIndex) => otherIndex !== index && (
      other.id === classification.id || other.userAgentPrefix.startsWith(classification.userAgentPrefix)
    ))) {
      throw new TypeError("caller classifications require unique ids and non-overlapping prefixes");
    }
  }
  return Object.freeze(normalized);
}

function isLoopbackUrl(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

// ADR-0102: a header-proved proxy boundary. The value is a credential, so it
// is held as a SHA-256 digest and compared against the digest of whatever
// arrived. Equal-length digests let `timingSafeEqual` do its job without the
// comparison leaking the secret's length.
function normalizeProxyBoundary(
  boundary: { readonly header: string; readonly secret: string },
): { readonly header: string; readonly digest: Buffer } {
  const header = boundary.header.toLowerCase();
  if (!/^[a-z0-9!#$%&'*+.^_`|~-]+$/.test(header)) {
    throw new TypeError(`proxyBoundary.header is not a valid header name: ${boundary.header}`);
  }
  // A caller controls what arrives in a forwarding header, and a proxy
  // rewrites them for its own purposes, so neither can carry the proof.
  if (header.startsWith("x-forwarded-") || header === "forwarded" || header === "host") {
    throw new TypeError(`proxyBoundary.header must not be a forwarding header: ${boundary.header}`);
  }
  if (boundary.secret.length < 32) {
    throw new TypeError("proxyBoundary.secret must be at least 32 characters");
  }
  // A header value reaches the request path decoded as latin1, while this
  // string hashes as UTF-8. Outside printable ASCII the two disagree and the
  // secret could never match, refusing every request with nothing to say why.
  // Surrounding spaces are refused for the same reason: a proxy strips them.
  if (!/^[\x21-\x7e](?:[\x20-\x7e]*[\x21-\x7e])?$/.test(boundary.secret)) {
    throw new TypeError("proxyBoundary.secret must be printable ASCII with no surrounding spaces");
  }
  return { header, digest: createHash("sha256").update(boundary.secret).digest() };
}

function provedProxyHop(
  rawHeaders: readonly string[],
  boundary: { readonly header: string; readonly digest: Buffer },
): boolean {
  // `singleHeader` returns null for a repeated field, so a caller cannot send
  // the header twice and hope one of them is taken.
  const supplied = singleHeader(rawHeaders, boundary.header);
  if (supplied === null || supplied === undefined || supplied === "") return false;
  return timingSafeEqual(createHash("sha256").update(supplied).digest(), boundary.digest);
}

function normalizeDeployment(profile: DeploymentProfile): NormalizedDeployment {
  if (profile.mode === "loopback") return profile;
  // ADR-0102: a deployment states its proxy boundary one way or the other. An
  // omission must not read as "platform-enforced", because that is also what
  // forgetting looks like.
  const declared = profile.proxyBoundary !== undefined;
  const enumerated = profile.trustedProxyAddresses !== undefined;
  if (declared === enumerated) {
    throw new TypeError("Production deployment needs exactly one of trustedProxyAddresses or proxyBoundary");
  }

  if (!profile.allowedAuthorities.length || !profile.allowedOrigins.length ||
      (enumerated && !profile.trustedProxyAddresses?.length)) {
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
    trustedProxyAddresses: profile.trustedProxyAddresses === undefined
      ? undefined
      : new Set(profile.trustedProxyAddresses.map((value) => requiredNormalized(
        "trusted proxy IP address", value, normalizeIp,
      ))),
    proxyBoundary: profile.proxyBoundary === undefined
      ? undefined
      : normalizeProxyBoundary(profile.proxyBoundary),
    forwardedHops: nonNegativeInteger("forwardedHops", profile.forwardedHops ?? 0),
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
  legacy: boolean,
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
  if (legacy || !isRecord(body) || typeof body.method !== "string") return true;
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
  type: "CallToolResult" | "Implementation" | "Prompt" | "Resource" | "ResourceTemplate" | "Tool",
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
    assertJsonValue(child, seen, allowUndefinedProperties);
  }
  seen.delete(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function jsonMetadataSchema(
  schema: z.ZodType,
  io: "input" | "output",
): Record<string, unknown> {
  return { ...z.toJSONSchema(schema, { target: "draft-2020-12", io }) };
}

const SCHEMA_VALUE_KEYWORDS = new Set([
  "items", "contains", "additionalProperties", "unevaluatedProperties",
  "unevaluatedItems", "propertyNames", "not", "if", "then", "else",
]);
const SCHEMA_LIST_KEYWORDS = new Set(["prefixItems", "oneOf", "anyOf", "allOf"]);
const SCHEMA_MAP_KEYWORDS = new Set([
  "properties", "patternProperties", "dependentSchemas", "$defs", "definitions",
]);

/**
 * Drops a closure the declaration applied to the output direction alone, so adding
 * a result field later does not break a client pinned to an older published schema.
 * A declaration closed in both directions keeps its closure, and so does a node with
 * no input counterpart: an unverifiable node fails closed rather than opening.
 * Builds new objects throughout and never mutates the supplied documents.
 */
function openOutputOnlyClosures(output: unknown, input: unknown): unknown {
  if (!isRecord(output)) return output;
  const peer = isRecord(input) ? input : undefined;
  const opened: Record<string, unknown> = {};
  for (const [keyword, value] of Object.entries(output)) {
    if (keyword === "additionalProperties" && value === false) {
      // Drop the closure only when the counterpart is itself an object node that
      // stays open. A missing counterpart, or one of a different kind -- which a
      // transform between the two directions produces -- cannot confirm the
      // author closed the output direction alone, so the closure is kept.
      const counterpartIsOpenObject = peer !== undefined
        && (peer.type === "object" || isRecord(peer.properties))
        && peer.additionalProperties !== false;
      if (!counterpartIsOpenObject) opened[keyword] = value;
      continue;
    }
    const peerValue = peer?.[keyword];
    if (SCHEMA_VALUE_KEYWORDS.has(keyword)) {
      opened[keyword] = openOutputOnlyClosures(value, peerValue);
    } else if (SCHEMA_LIST_KEYWORDS.has(keyword) && Array.isArray(value)) {
      opened[keyword] = value.map((member, index) =>
        openOutputOnlyClosures(member, Array.isArray(peerValue) ? peerValue[index] : undefined));
    } else if (SCHEMA_MAP_KEYWORDS.has(keyword) && isRecord(value)) {
      opened[keyword] = Object.fromEntries(Object.entries(value).map(([name, member]) =>
        [name, openOutputOnlyClosures(member, isRecord(peerValue) ? peerValue[name] : undefined)]));
    } else {
      opened[keyword] = value;
    }
  }
  return opened;
}

function standardJsonSchema(
  schema: StandardSchemaWithJSON,
  io: "input" | "output",
): Record<string, unknown> {
  const document = { ...schema["~standard"].jsonSchema[io]({ target: "draft-2020-12" }) };
  if (io !== "output") return document;
  const input = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
  return openOutputOnlyClosures(document, input) as Record<string, unknown>;
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

function sdkMetadataSchema<Schema extends z.ZodType>(schema: Schema): Schema {
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
  } as unknown as Schema;
}

function sdkOutputMetadataSchema(schema: StandardSchemaWithJSON): StandardSchemaWithJSON {
  // Built once per tool at registration. These accessors are read on every
  // tools/list request, and the underlying conversion is not memoised.
  // Cloned before freezing: the conversion copies only the top level, so
  // freezing in place would reach into a document the supplying schema owns.
  const input = deepFreeze(structuredClone(standardJsonSchema(schema, "input")));
  const output = deepFreeze(structuredClone(standardJsonSchema(schema, "output")));
  return {
    "~standard": {
      version: 1,
      vendor: "emseepea",
      validate: (value: unknown) => ({ value }),
      jsonSchema: {
        input: () => input,
        output: () => output,
      },
    },
  };
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
          principal: request?.principal,
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
function nonNegativeInteger(field: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${field} must be a non-negative safe integer`);
  return value;
}
function positiveInteger(field: string, value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${field} must be a positive safe integer`);
  return value;
}
function callbackTimeout(callbackName: string, callback: unknown, timeoutName: string, value: number | undefined): number {
  if (callback !== undefined && typeof callback !== "function") throw new TypeError(`${callbackName} must be a function`);
  if (value !== undefined && callback === undefined) throw new TypeError(`${timeoutName} requires ${callbackName}`);
  const timeout = positiveInteger(timeoutName, value === undefined ? 1_000 : value);
  if (timeout > 60_000) throw new TypeError(`${timeoutName} must not exceed 60000`);
  return timeout;
}
function nonNegativePort(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 65_535) {
    throw new TypeError("port must be an integer from 0 to 65535");
  }
  return value;
}

function directHandlerContext(
  access: "public" | ProtectedCapabilityAccess,
  context: ServerContext,
  signal: AbortSignal,
  deadlineMs: number,
  requestState: RequestStateRuntime | undefined,
  reportLog?: (message: ClientLogMessage) => Promise<void>,
  reportProgress?: (update: ProgressUpdate) => Promise<void>,
): ResourcePromptContext<"public"> & ResourcePromptContext<"protected"> {
  return {
    signal,
    deadlineMs,
    principal: access === "public" ? undefined : principalFrom(context.http?.authInfo),
    inputResponses: checkedDirectInputResponses(context, signal, deadlineMs),
    ...(requestState ? {
      requestState: context.mcpReq.requestState(),
      mintRequestState: (payload: unknown) => requestState.mint(payload, context),
    } : {}),
    ...(reportLog ? { reportLog } : {}),
    ...(reportProgress ? { reportProgress } : {}),
  } as ResourcePromptContext<"public"> & ResourcePromptContext<"protected">;
}

async function assertInputRequired(
  result: SdkInputRequiredResult,
  requestState: RequestStateRuntime | undefined,
  context: ServerContext,
): Promise<void> {
  if (!result.inputRequests && result.requestState === undefined) {
    throw new Error("Client-input result must include requests or state");
  }
  if (result.inputRequests && Object.values(result.inputRequests).some(
    (request) => request.method !== "elicitation/create" && request.method !== "roots/list",
  )) {
    throw new Error("Client-input request kind is not supported");
  }
  if (result.inputRequests && Object.values(result.inputRequests).some(
    (request) => request.method === "roots/list",
  )) {
    const operation = requestOperations.getStore();
    if (operation?.legacy || operation?.maxClientRoots === undefined) {
      throw new Error("Client roots are unavailable for this request");
    }
    // The SDK checks outgoing requests against this round's client capabilities.
  }
  if (result.requestState !== undefined) {
    if (!requestState) throw new Error("Client-input request state is not configured");
    await requestState.verify(result.requestState, context);
  }
}

function assertClientRootsEnabled(context: ServerContext): number {
  const operation = requestOperations.getStore();
  const envelope: unknown = context.mcpReq.envelope;
  const capabilities = isRecord(envelope) ? envelope["io.modelcontextprotocol/clientCapabilities"] : undefined;
  if (operation?.legacy || operation?.maxClientRoots === undefined ||
      !isRecord(capabilities) || !isRecord(capabilities.roots)) {
    throw new Error("Client roots are unavailable for this request");
  }
  return operation.maxClientRoots;
}

function checkedDirectInputResponses(
  context: ServerContext,
  signal: AbortSignal,
  deadlineMs: number,
): CheckedInputResponses | undefined {
  const operation = requestOperations.getStore();
  if (operation?.maxClientRoots === undefined || operation.legacy) {
    return checkedInputResponses(context.mcpReq.inputResponses) as CheckedInputResponses | undefined;
  }
  if (context.mcpReq.droppedInputResponseKeys?.length) throw new Error("Malformed client input response");
  const responses = context.mcpReq.inputResponses;
  if (responses === undefined) return undefined;
  const checked = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of Object.entries(responses)) {
    if (isRecord(value) && Object.hasOwn(value, "roots")) {
      const maxRoots = assertClientRootsEnabled(context);
      if (!Array.isArray(value.roots) || value.roots.length > maxRoots || Object.hasOwn(value, "action")) {
        throw new Error("Invalid roots response");
      }
      const result = specTypeSchemas.ListRootsResult["~standard"].validate(value);
      if (result instanceof Promise || "issues" in result) throw new Error("Invalid roots response");
      for (const root of result.value.roots) {
        if (new URL(root.uri).protocol !== "file:") throw new Error("Invalid root URI");
      }
      checked[key] = deepFreeze(structuredClone(result.value));
    } else {
      const result = specTypeSchemas.ElicitResult["~standard"].validate(value);
      if (result instanceof Promise || "issues" in result) throw new Error("Invalid client input response");
      checked[key] = deepFreeze(structuredClone(result.value));
    }
  }
  signal.throwIfAborted();
  if (Date.now() >= deadlineMs) throw new Error("Client input validation exceeded its deadline");
  checkedRootsResponses.add(checked);
  return Object.freeze(checked) as CheckedInputResponses;
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

async function closeApp(
  app: FastifyInstance,
  timeoutMs: number,
  flushTimeoutMs: number,
  finishObservability: AppRuntime["finishObservability"],
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  let onClosed: () => void;
  const httpClosed = new Promise<void>((resolve) => { onClosed = resolve; });
  app.server.once("close", onClosed!);
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      app.server.close();
      app.server.closeAllConnections();
      resolve();
    }, timeoutMs);
    timer.unref();
  });
  try {
    await Promise.race([app.close(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    if (finishObservability) {
      const expired = new Promise<void>((resolve) => {
        // Keep the process alive long enough to finish flushing after sockets close.
        timer = setTimeout(resolve, flushTimeoutMs);
      });
      try {
        await Promise.race([
          httpClosed.then(() => finishObservability(flushTimeoutMs)).catch(() => {}),
          expired,
        ]);
      } finally {
        if (timer) clearTimeout(timer);
        app.server.off("close", onClosed!);
      }
    } else {
      app.server.off("close", onClosed!);
    }
  }
}
