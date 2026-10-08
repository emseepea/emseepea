import { createHash } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  Client,
  InsufficientScopeError,
  ProtocolError,
  SdkHttpError,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  discoverOAuthProtectedResourceMetadata,
  type CallToolResult,
} from "@modelcontextprotocol/client";

export type McpCliQualificationStatus = "passed" | "failed" | "blocked" | "incomplete";

export interface McpCliContentExpectation {
  readonly sha256: string;
  readonly bytes?: number;
  readonly mimeType?: string;
}

export interface McpCliResourceLinkExpectation {
  readonly uri: string;
  readonly mimeType?: string;
}

export interface McpCliEmbeddedResourceExpectation extends McpCliContentExpectation {
  readonly uri: string;
}

interface McpCliCheckpointBase {
  readonly id: string;
  readonly tokenEnvironment?: string;
}

export type McpCliCheckpoint =
  | (McpCliCheckpointBase & {
      readonly operation: "oauth/discover";
      readonly expectedScopes?: readonly string[];
    })
  | (McpCliCheckpointBase & {
      readonly operation: "tools/list";
      readonly expectedNames?: readonly string[];
      readonly expect?: "success" | "denied";
    })
  | (McpCliCheckpointBase & {
      readonly operation: "resources/list";
      readonly expectedUris?: readonly string[];
      readonly expect?: "success" | "denied";
    })
  | (McpCliCheckpointBase & {
      readonly operation: "resources/templates/list";
      readonly expectedUriTemplates?: readonly string[];
      readonly expect?: "success" | "denied";
    })
  | (McpCliCheckpointBase & {
      readonly operation: "resources/read";
      readonly uri: string;
      readonly expectedContents?: readonly McpCliContentExpectation[];
      readonly maxContentBytes?: number;
      readonly expect?: "success" | "denied";
    })
  | (McpCliCheckpointBase & {
      readonly operation: "tools/call";
      readonly name: string;
      readonly arguments?: Readonly<Record<string, unknown>>;
      readonly expectedResourceLinks?: readonly McpCliResourceLinkExpectation[];
      readonly expectedEmbeddedResources?: readonly McpCliEmbeddedResourceExpectation[];
      readonly maxEmbeddedResourceBytes?: number;
      readonly minimumProgress?: number;
      readonly cancelAfterMs?: number;
      readonly expect?: "success" | "denied" | "cancelled";
    })
  | {
      readonly id: string;
      readonly operation: "record";
      readonly outcome: "blocked" | "incomplete";
      readonly category: string;
    };

export interface McpCliQualificationScenario {
  readonly name: string;
  readonly endpoint: URL;
  readonly protocolVersion?: "2026-07-28" | "2025-11-25" | "2025-06-18" | "2025-03-26";
  readonly requestTimeoutMs?: number;
  readonly tokenEnvironment?: string;
  readonly checkpoints: readonly McpCliCheckpoint[];
}

export interface McpCliCheckpointEvidence {
  readonly id: string;
  readonly operation: McpCliCheckpoint["operation"];
  readonly status: McpCliQualificationStatus;
  readonly category: string;
  readonly observation?: Readonly<Record<string, unknown>>;
}

export interface McpCliQualificationEvidence {
  readonly schemaVersion: 1;
  readonly evidenceKind: "mcp-cli";
  readonly nativeChatgpt: "not-tested";
  readonly name: string;
  readonly endpointSha256: string;
  readonly protocolVersion: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly status: McpCliQualificationStatus;
  readonly checkpoints: readonly McpCliCheckpointEvidence[];
}

const MAX_CHECKPOINTS = 128;
const MAX_EXPECTATIONS = 512;
const MAX_CONTENT_EXPECTATIONS = 128;
const MAX_PROGRESS_EVENTS = 10_000;
const DEFAULT_MAX_CONTENT_BYTES = 16 * 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const SHA256 = /^[a-f0-9]{64}$/;
const ENVIRONMENT_NAME = /^[A-Z_][A-Z0-9_]{0,127}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

/** Preserve TypeScript checking for an adopter-owned qualification scenario. */
export function defineMcpCliQualification(
  scenario: McpCliQualificationScenario,
): McpCliQualificationScenario {
  return scenario;
}

/**
 * Run deterministic MCP protocol checks and write bounded private evidence.
 * This does not exercise or qualify native ChatGPT.
 */
export async function runMcpCliQualification(
  scenario: McpCliQualificationScenario,
  output: string,
): Promise<McpCliQualificationEvidence> {
  validateScenario(scenario, output);
  const startedAt = new Date().toISOString();
  const checkpoints: McpCliCheckpointEvidence[] = [];
  for (const checkpoint of scenario.checkpoints) {
    checkpoints.push(await runCheckpoint(scenario, checkpoint, checkpoints));
  }
  const evidence = Object.freeze({
    schemaVersion: 1 as const,
    evidenceKind: "mcp-cli" as const,
    nativeChatgpt: "not-tested" as const,
    name: scenario.name,
    endpointSha256: sha256(scenario.endpoint.href),
    protocolVersion: scenario.protocolVersion ?? "2026-07-28",
    startedAt,
    finishedAt: new Date().toISOString(),
    status: overallStatus(checkpoints),
    checkpoints: Object.freeze(checkpoints),
  });
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  for (const secret of configuredSecrets(scenario)) {
    if (serialized.includes(secret)) {
      throw new Error("MCP CLI qualification evidence contains a configured credential");
    }
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, serialized, { mode: 0o600 });
  await chmod(output, 0o600);
  return evidence;
}

async function runCheckpoint(
  scenario: McpCliQualificationScenario,
  checkpoint: McpCliCheckpoint,
  previous: readonly McpCliCheckpointEvidence[],
): Promise<McpCliCheckpointEvidence> {
  if (checkpoint.operation === "record") {
    return frozenEvidence(checkpoint, checkpoint.outcome, checkpoint.category);
  }
  if (checkpoint.operation === "oauth/discover") {
    return runOAuthCheckpoint(scenario, checkpoint);
  }

  const tokenEnvironment = checkpoint.tokenEnvironment ?? scenario.tokenEnvironment;
  const token = tokenEnvironment === undefined ? undefined : process.env[tokenEnvironment];
  if (tokenEnvironment !== undefined && !token) {
    return frozenEvidence(checkpoint, "blocked", "missing-credential");
  }

  const client = new Client(
    { name: "emseepea-mcp-cli-qualification", version: "0.0.0" },
    scenario.protocolVersion === undefined || scenario.protocolVersion === "2026-07-28"
      ? { versionNegotiation: { mode: { pin: scenario.protocolVersion ?? "2026-07-28" } } }
      : {
          supportedProtocolVersions: [scenario.protocolVersion],
          versionNegotiation: { mode: "legacy" },
        },
  );
  const timeout = scenario.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  try {
    await client.connect(new StreamableHTTPClientTransport(
      scenario.endpoint,
      token ? { authProvider: { token: async () => token } } : undefined,
    ), { timeout });
    return await executeConnectedCheckpoint(client, checkpoint, timeout);
  } catch (error) {
    const category = errorCategory(error);
    const expected = checkpoint.expect ?? "success";
    if (expected === "denied" && category === "denied") {
      return frozenEvidence(checkpoint, "passed", "denial-observed");
    }
    if (expected === "denied" && category === "hidden-or-missing" &&
        hasSuccessfulBaseline(checkpoint, previous)) {
      return frozenEvidence(checkpoint, "passed", "denial-observed");
    }
    if (expected === "cancelled" && category === "cancelled") {
      return frozenEvidence(checkpoint, "passed", "cancellation-observed");
    }
    const status = category === "unreachable" || category === "missing-credential"
      ? "blocked"
      : "failed";
    return frozenEvidence(checkpoint, status, category);
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function runOAuthCheckpoint(
  scenario: McpCliQualificationScenario,
  checkpoint: Extract<McpCliCheckpoint, { operation: "oauth/discover" }>,
): Promise<McpCliCheckpointEvidence> {
  try {
    const timeout = scenario.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const metadata = await discoverOAuthProtectedResourceMetadata(
      scenario.endpoint,
      undefined,
      (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(timeout) }),
    );
    if (!metadata) return frozenEvidence(checkpoint, "failed", "metadata-missing");
    const scopes = [...(metadata.scopes_supported ?? [])].sort();
    const servers = [...(metadata.authorization_servers ?? [])].sort();
    const observation = {
      resourceSha256: sha256(metadata.resource),
      authorizationServerCount: servers.length,
      authorizationServersSha256: sha256(JSON.stringify(servers)),
      scopeCount: scopes.length,
      scopesSha256: sha256(JSON.stringify(scopes)),
    };
    if (checkpoint.expectedScopes !== undefined &&
        !sameStrings(scopes, [...checkpoint.expectedScopes].sort())) {
      return frozenEvidence(checkpoint, "failed", "scope-mismatch", observation);
    }
    return frozenEvidence(checkpoint, "passed", "metadata-observed", observation);
  } catch (error) {
    const category = errorCategory(error);
    return frozenEvidence(
      checkpoint,
      category === "unreachable" ? "blocked" : "failed",
      category,
    );
  }
}

async function executeConnectedCheckpoint(
  client: Client,
  checkpoint: Exclude<McpCliCheckpoint, { operation: "record" | "oauth/discover" }>,
  timeout: number,
): Promise<McpCliCheckpointEvidence> {
  const expected = checkpoint.expect ?? "success";
  let observation: Readonly<Record<string, unknown>>;

  if (checkpoint.operation === "tools/list") {
    const names = (await client.listTools(undefined, { cacheMode: "bypass", timeout })).tools
      .map(({ name }) => name).sort();
    observation = listObservation(names);
    if (checkpoint.expectedNames !== undefined &&
        !sameStrings(names, [...checkpoint.expectedNames].sort())) {
      return frozenEvidence(checkpoint, "failed", "catalogue-mismatch", observation);
    }
  } else if (checkpoint.operation === "resources/list") {
    const uris = (await client.listResources(undefined, { cacheMode: "bypass", timeout })).resources
      .map(({ uri }) => uri).sort();
    observation = listObservation(uris);
    if (checkpoint.expectedUris !== undefined &&
        !sameStrings(uris, [...checkpoint.expectedUris].sort())) {
      return frozenEvidence(checkpoint, "failed", "catalogue-mismatch", observation);
    }
  } else if (checkpoint.operation === "resources/templates/list") {
    const templates = (await client.listResourceTemplates(undefined, { cacheMode: "bypass", timeout }))
      .resourceTemplates.map(({ uriTemplate }) => uriTemplate).sort();
    observation = listObservation(templates);
    if (checkpoint.expectedUriTemplates !== undefined &&
        !sameStrings(templates, [...checkpoint.expectedUriTemplates].sort())) {
      return frozenEvidence(checkpoint, "failed", "catalogue-mismatch", observation);
    }
  } else if (checkpoint.operation === "resources/read") {
    const result = await client.readResource(
      { uri: checkpoint.uri },
      { cacheMode: "bypass", timeout },
    );
    if (result.contents.length > MAX_CONTENT_EXPECTATIONS) {
      throw new Error("resource response contains too many content items");
    }
    const contents = result.contents.map((content) => contentObservation(
      content,
      checkpoint.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES,
    ));
    observation = {
      requestedUriSha256: sha256(checkpoint.uri),
      contents,
    };
    if (checkpoint.expectedContents !== undefined &&
        !sameContentExpectations(contents, checkpoint.expectedContents)) {
      return frozenEvidence(checkpoint, "failed", "content-mismatch", observation);
    }
  } else {
    return runToolCheckpoint(client, checkpoint, timeout);
  }

  if (expected !== "success") {
    return frozenEvidence(checkpoint, "failed", "unexpected-success", observation);
  }
  return frozenEvidence(checkpoint, "passed", "expectation-met", observation);
}

async function runToolCheckpoint(
  client: Client,
  checkpoint: Extract<McpCliCheckpoint, { operation: "tools/call" }>,
  timeout: number,
): Promise<McpCliCheckpointEvidence> {
  let progressCount = 0;
  let progressTruncated = false;
  const controller = checkpoint.cancelAfterMs === undefined ? undefined : new AbortController();
  const timer = controller === undefined ? undefined : setTimeout(
    () => controller.abort(new Error("qualification cancellation")),
    checkpoint.cancelAfterMs,
  );
  let result: CallToolResult;
  try {
    result = await client.callTool(
      { name: checkpoint.name, arguments: checkpoint.arguments ?? {} },
      {
        ...(controller ? { signal: controller.signal } : {}),
        timeout,
        onprogress: () => {
          if (progressCount < MAX_PROGRESS_EVENTS) progressCount += 1;
          else progressTruncated = true;
        },
      },
    );
  } catch (error) {
    if (controller?.signal.aborted) {
      if ((checkpoint.expect ?? "success") === "cancelled") {
        return frozenEvidence(checkpoint, "passed", "client-cancellation-observed", {
          argumentsSha256: sha256(JSON.stringify(checkpoint.arguments ?? {})),
          progressCount,
          progressTruncated,
        });
      }
      return frozenEvidence(checkpoint, "failed", "unexpected-cancellation");
    }
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  const links = resourceLinks(result).map(({ uri, mimeType }) => ({
    uriSha256: sha256(uri),
    ...(mimeType === undefined ? {} : { mimeType }),
  }));
  const embedded = embeddedResources(
    result,
    checkpoint.maxEmbeddedResourceBytes ?? DEFAULT_MAX_CONTENT_BYTES,
  );
  const observation = {
    toolNameSha256: sha256(checkpoint.name),
    argumentsSha256: sha256(JSON.stringify(checkpoint.arguments ?? {})),
    progressCount,
    progressTruncated,
    isError: result.isError === true,
    resourceLinks: links,
    embeddedResources: embedded,
    resultSha256: sha256(JSON.stringify(result)),
  };
  if ((checkpoint.expect ?? "success") !== "success") {
    return frozenEvidence(checkpoint, "failed", "unexpected-success", observation);
  }
  if (result.isError === true) {
    return frozenEvidence(checkpoint, "failed", "tool-error", observation);
  }
  if (checkpoint.minimumProgress !== undefined && progressCount < checkpoint.minimumProgress) {
    return frozenEvidence(checkpoint, "failed", "progress-missing", observation);
  }
  if (checkpoint.expectedResourceLinks !== undefined &&
      !sameLinks(links, checkpoint.expectedResourceLinks)) {
    return frozenEvidence(checkpoint, "failed", "resource-link-mismatch", observation);
  }
  if (checkpoint.expectedEmbeddedResources !== undefined &&
      !sameEmbeddedResources(embedded, checkpoint.expectedEmbeddedResources)) {
    return frozenEvidence(checkpoint, "failed", "embedded-resource-mismatch", observation);
  }
  return frozenEvidence(checkpoint, "passed", "expectation-met", observation);
}

function validateScenario(scenario: McpCliQualificationScenario, output: string): void {
  if (!scenario || typeof scenario !== "object") throw new TypeError("qualification scenario is required");
  if (typeof scenario.name !== "string" || !scenario.name.trim() || scenario.name.length > 128) {
    throw new TypeError("qualification name must contain 1 to 128 characters");
  }
  if (!(scenario.endpoint instanceof URL) || !["http:", "https:"].includes(scenario.endpoint.protocol)) {
    throw new TypeError("qualification endpoint must be an HTTP or HTTPS URL");
  }
  if (scenario.endpoint.username || scenario.endpoint.password || scenario.endpoint.hash) {
    throw new TypeError("qualification endpoint must not contain credentials or a fragment");
  }
  if (scenario.endpoint.protocol === "http:" && !isLoopbackHost(scenario.endpoint.hostname)) {
    throw new TypeError("plain HTTP qualification endpoints must use a loopback host");
  }
  for (const name of scenario.endpoint.searchParams.keys()) {
    if (/(?:token|secret|key|auth|credential)/i.test(name)) {
      throw new TypeError("qualification endpoint must not contain credential-like query parameters");
    }
  }
  if (typeof output !== "string" || !output.trim()) throw new TypeError("qualification output is required");
  if (scenario.requestTimeoutMs !== undefined &&
      (!Number.isSafeInteger(scenario.requestTimeoutMs) || scenario.requestTimeoutMs < 100 ||
       scenario.requestTimeoutMs > 60_000)) {
    throw new TypeError("requestTimeoutMs must be an integer from 100 to 60000");
  }
  if (!Array.isArray(scenario.checkpoints) || scenario.checkpoints.length === 0 ||
      scenario.checkpoints.length > MAX_CHECKPOINTS) {
    throw new TypeError(`qualification checkpoints must contain 1 to ${MAX_CHECKPOINTS} entries`);
  }
  const ids = new Set<string>();
  if (scenario.tokenEnvironment !== undefined) validateEnvironmentName(scenario.tokenEnvironment);
  for (const checkpoint of scenario.checkpoints) {
    if (!IDENTIFIER.test(checkpoint.id) || ids.has(checkpoint.id)) {
      throw new TypeError("qualification checkpoint IDs must be unique bounded identifiers");
    }
    ids.add(checkpoint.id);
    if ("tokenEnvironment" in checkpoint && checkpoint.tokenEnvironment !== undefined) {
      validateEnvironmentName(checkpoint.tokenEnvironment);
    }
    validateCheckpoint(checkpoint, scenario.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
  }
}

function validateCheckpoint(checkpoint: McpCliCheckpoint, requestTimeoutMs: number): void {
  if (checkpoint.operation === "record") {
    if (!IDENTIFIER.test(checkpoint.category)) throw new TypeError("record category must be a bounded identifier");
    return;
  }
  if (checkpoint.operation === "oauth/discover") {
    validateArrayBound(checkpoint.expectedScopes, "expected scopes", MAX_EXPECTATIONS);
  }
  if (checkpoint.operation === "tools/list") {
    validateArrayBound(checkpoint.expectedNames, "expected tool names", MAX_EXPECTATIONS);
  }
  if (checkpoint.operation === "resources/list") {
    validateArrayBound(checkpoint.expectedUris, "expected resource URIs", MAX_EXPECTATIONS);
  }
  if (checkpoint.operation === "resources/templates/list") {
    validateArrayBound(checkpoint.expectedUriTemplates, "expected resource templates", MAX_EXPECTATIONS);
  }
  if (checkpoint.operation === "resources/read") {
    if (!checkpoint.uri || checkpoint.uri.length > 4_096) throw new TypeError("resource URI is required and bounded");
    validateArrayBound(checkpoint.expectedContents, "expected resource contents", MAX_CONTENT_EXPECTATIONS);
    for (const expected of checkpoint.expectedContents ?? []) validateContentExpectation(expected);
    if (checkpoint.maxContentBytes !== undefined &&
        (!Number.isSafeInteger(checkpoint.maxContentBytes) || checkpoint.maxContentBytes < 1 ||
         checkpoint.maxContentBytes > 64 * 1024 * 1024)) {
      throw new TypeError("maxContentBytes must be an integer from 1 to 67108864");
    }
  }
  if (checkpoint.operation === "tools/call") {
    validateArrayBound(checkpoint.expectedResourceLinks, "expected resource links", MAX_CONTENT_EXPECTATIONS);
    for (const expected of checkpoint.expectedResourceLinks ?? []) {
      if (!expected.uri || expected.uri.length > 4_096) {
        throw new TypeError("resource link URI is required and bounded");
      }
      if (expected.mimeType !== undefined) validateMimeType(expected.mimeType);
    }
    validateArrayBound(
      checkpoint.expectedEmbeddedResources,
      "expected embedded resources",
      MAX_CONTENT_EXPECTATIONS,
    );
    for (const expected of checkpoint.expectedEmbeddedResources ?? []) {
      validateResourceUri(expected.uri, "embedded resource URI");
      validateContentExpectation(expected);
    }
    validateContentByteLimit(checkpoint.maxEmbeddedResourceBytes, "maxEmbeddedResourceBytes");
  }
  if (checkpoint.operation === "tools/call") {
    if (!checkpoint.name || checkpoint.name.length > 256) throw new TypeError("tool name is required and bounded");
    const argumentsText = JSON.stringify(checkpoint.arguments ?? {});
    if (argumentsText.length > 65_536) throw new TypeError("tool arguments exceed 65536 JSON characters");
    if (checkpoint.minimumProgress !== undefined &&
        (!Number.isSafeInteger(checkpoint.minimumProgress) || checkpoint.minimumProgress < 0 ||
         checkpoint.minimumProgress > MAX_PROGRESS_EVENTS)) {
      throw new TypeError(`minimumProgress must be an integer from 0 to ${MAX_PROGRESS_EVENTS}`);
    }
    if (checkpoint.cancelAfterMs !== undefined &&
        (!Number.isSafeInteger(checkpoint.cancelAfterMs) || checkpoint.cancelAfterMs < 1 ||
         checkpoint.cancelAfterMs > 60_000)) {
      throw new TypeError("cancelAfterMs must be an integer from 1 to 60000");
    }
    if (checkpoint.expect === "cancelled" && checkpoint.cancelAfterMs === undefined) {
      throw new TypeError("cancelled tool checkpoints require cancelAfterMs");
    }
    if (checkpoint.cancelAfterMs !== undefined &&
        checkpoint.cancelAfterMs >= requestTimeoutMs) {
      throw new TypeError("cancelAfterMs must be shorter than the request timeout");
    }
  }
}

function validateArrayBound(value: readonly unknown[] | undefined, label: string, maximum: number): void {
  if (value !== undefined && (!Array.isArray(value) || value.length > maximum)) {
    throw new TypeError(`${label} must contain at most ${maximum} entries`);
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "[::1]" ||
    /^127(?:\.[0-9]{1,3}){3}$/.test(hostname);
}

function validateContentExpectation(expected: McpCliContentExpectation): void {
  if (!SHA256.test(expected.sha256)) throw new TypeError("content sha256 must be lowercase hexadecimal");
  if (expected.bytes !== undefined && (!Number.isSafeInteger(expected.bytes) || expected.bytes < 0)) {
    throw new TypeError("content bytes must be a non-negative integer");
  }
  if (expected.mimeType !== undefined) validateMimeType(expected.mimeType);
}

function validateContentByteLimit(value: number | undefined, label: string): void {
  if (value !== undefined &&
      (!Number.isSafeInteger(value) || value < 1 || value > 64 * 1024 * 1024)) {
    throw new TypeError(`${label} must be an integer from 1 to 67108864`);
  }
}

function validateResourceUri(value: string, label: string): void {
  if (!value || value.length > 4_096) throw new TypeError(`${label} is required and bounded`);
}

function validateMimeType(value: string): void {
  const hasControlCharacter = [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (!value || value.length > 256 || hasControlCharacter) {
    throw new TypeError("MIME type must contain 1 to 256 printable characters");
  }
}

function validateEnvironmentName(name: string): void {
  if (!ENVIRONMENT_NAME.test(name)) throw new TypeError("token environment name is invalid");
}

function contentObservation(
  content: { uri: string; mimeType?: string; text?: string; blob?: string },
  maximum: number,
): Readonly<Record<string, unknown>> {
  validateResourceUri(content.uri, "observed resource URI");
  if (content.mimeType !== undefined) validateMimeType(content.mimeType);
  let bytes: Buffer;
  if (typeof content.text === "string") {
    bytes = Buffer.from(content.text, "utf8");
  } else if (typeof content.blob === "string") {
    if (content.blob.length > Math.ceil(maximum / 3) * 4 + 4) {
      throw new Error("resource content exceeds configured byte limit");
    }
    if (!isBase64(content.blob)) throw new Error("resource content blob is not valid base64");
    bytes = Buffer.from(content.blob, "base64");
  } else {
    throw new Error("resource content has no text or blob bytes");
  }
  if (bytes.byteLength > maximum) throw new Error("resource content exceeds configured byte limit");
  return Object.freeze({
    uriSha256: sha256(content.uri),
    ...(content.mimeType === undefined ? {} : { mimeType: content.mimeType }),
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  });
}

function isBase64(value: string): boolean {
  if (value.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false;
  const unpadded = value.replace(/=+$/, "");
  return Buffer.from(value, "base64").toString("base64").replace(/=+$/, "") === unpadded;
}

function sameContentExpectations(
  observed: readonly Readonly<Record<string, unknown>>[],
  expected: readonly McpCliContentExpectation[],
): boolean {
  return observed.length === expected.length && observed.every((item, index) => {
    const wanted = expected[index];
    return wanted !== undefined && item.sha256 === wanted.sha256 &&
      (wanted.bytes === undefined || item.bytes === wanted.bytes) &&
      (wanted.mimeType === undefined || item.mimeType === wanted.mimeType);
  });
}

function resourceLinks(result: CallToolResult): Array<{ uri: string; mimeType?: string }> {
  const links: Array<{ uri: string; mimeType?: string }> = [];
  for (const content of result.content) {
    if (content.type !== "resource_link") continue;
    if (links.length === MAX_CONTENT_EXPECTATIONS) {
      throw new Error("tool response contains too many resource links");
    }
    if (content.mimeType !== undefined) validateMimeType(content.mimeType);
    links.push({ uri: content.uri, ...(content.mimeType === undefined ? {} : { mimeType: content.mimeType }) });
  }
  return links;
}

function embeddedResources(
  result: CallToolResult,
  maximum: number,
): readonly Readonly<Record<string, unknown>>[] {
  const resources: Readonly<Record<string, unknown>>[] = [];
  for (const content of result.content) {
    if (content.type !== "resource") continue;
    if (resources.length === MAX_CONTENT_EXPECTATIONS) {
      throw new Error("tool response contains too many embedded resources");
    }
    resources.push(contentObservation(content.resource, maximum));
  }
  return resources;
}

function sameEmbeddedResources(
  observed: readonly Readonly<Record<string, unknown>>[],
  expected: readonly McpCliEmbeddedResourceExpectation[],
): boolean {
  return observed.length === expected.length && observed.every((item, index) => {
    const wanted = expected[index];
    return wanted !== undefined && item.uriSha256 === sha256(wanted.uri) &&
      item.sha256 === wanted.sha256 &&
      (wanted.bytes === undefined || item.bytes === wanted.bytes) &&
      (wanted.mimeType === undefined || item.mimeType === wanted.mimeType);
  });
}

function sameLinks(
  observed: readonly { uriSha256: string; mimeType?: string }[],
  expected: readonly McpCliResourceLinkExpectation[],
): boolean {
  return observed.length === expected.length && observed.every((item, index) => {
    const wanted = expected[index];
    return wanted !== undefined && item.uriSha256 === sha256(wanted.uri) &&
      (wanted.mimeType === undefined || item.mimeType === wanted.mimeType);
  });
}

function listObservation(values: readonly string[]): Readonly<Record<string, unknown>> {
  return Object.freeze({ count: values.length, valuesSha256: sha256(JSON.stringify(values)) });
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function frozenEvidence(
  checkpoint: { id: string; operation: McpCliCheckpoint["operation"] },
  status: McpCliQualificationStatus,
  category: string,
  observation?: Readonly<Record<string, unknown>>,
): McpCliCheckpointEvidence {
  return Object.freeze({
    id: checkpoint.id,
    operation: checkpoint.operation,
    status,
    category,
    ...(observation === undefined ? {} : { observation: Object.freeze(observation) }),
  });
}

function overallStatus(checkpoints: readonly McpCliCheckpointEvidence[]): McpCliQualificationStatus {
  if (checkpoints.some(({ status }) => status === "failed")) return "failed";
  if (checkpoints.some(({ status }) => status === "blocked")) return "blocked";
  if (checkpoints.some(({ status }) => status === "incomplete")) return "incomplete";
  return "passed";
}

function hasSuccessfulBaseline(
  checkpoint: Exclude<McpCliCheckpoint, { operation: "record" | "oauth/discover" }>,
  previous: readonly McpCliCheckpointEvidence[],
): boolean {
  const target = checkpointTarget(checkpoint);
  if (target === undefined) return false;
  return previous.some((item) => item.status === "passed" && item.operation === checkpoint.operation &&
    item.observation?.[target.field] === target.sha256);
}

function checkpointTarget(
  checkpoint: Exclude<McpCliCheckpoint, { operation: "record" | "oauth/discover" }>,
): { readonly field: string; readonly sha256: string } | undefined {
  if (checkpoint.operation === "resources/read") {
    return { field: "requestedUriSha256", sha256: sha256(checkpoint.uri) };
  }
  if (checkpoint.operation === "tools/call") {
    return { field: "toolNameSha256", sha256: sha256(checkpoint.name) };
  }
  return undefined;
}

function errorCategory(error: unknown): string {
  if (error instanceof UnauthorizedError || error instanceof InsufficientScopeError) return "denied";
  if (error instanceof ProtocolError && error.message === "Capability not found") {
    return "hidden-or-missing";
  }
  if (error instanceof SdkHttpError) {
    if (error.status === 401 || error.status === 403) return "denied";
    return error.status >= 500 ? "unreachable" : "protocol-error";
  }
  if (error instanceof Error) {
    if (error.name === "AbortError" || /cancel/i.test(error.name)) return "cancelled";
    if (error.name === "TypeError" || /fetch|connect|network|ECONN/i.test(error.message)) return "unreachable";
  }
  return "unexpected-error";
}

function configuredSecrets(scenario: McpCliQualificationScenario): string[] {
  const names = new Set<string>();
  if (scenario.tokenEnvironment) names.add(scenario.tokenEnvironment);
  for (const checkpoint of scenario.checkpoints) {
    if ("tokenEnvironment" in checkpoint && checkpoint.tokenEnvironment) {
      names.add(checkpoint.tokenEnvironment);
    }
  }
  return [...names].flatMap((name) => process.env[name] ? [process.env[name]!] : []);
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
