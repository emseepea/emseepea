import {
  createEmseepea,
  defineElicitationView,
  defineMappedTool,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  defineStreamingTool,
  defineTool,
  inputRequired,
  rootsResponse,
  notifyResourceUpdated,
  renderElicitationForm,
  serveEmseepea,
} from "@emseepea/server";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { defineFeedbackSubmission } from "@emseepea/feedback";
import { z } from "zod";

const value = z.object({ value: z.string() });
const view = defineElicitationView({
  id: "smoke-view",
  heading: "Smoke <view>",
  legend: "Value",
  fields: [{ kind: "text", id: "value", name: "value", label: "Value" }],
  submitLabel: "Continue",
  state: { kind: "ready", focusTarget: "none" },
});
const fragment = renderElicitationForm(view, { headingLevel: 2 });
if (!fragment.includes("Smoke &lt;view&gt;") || fragment.includes("<html")) {
  throw new Error("installed package did not safely render an embedded UI fragment");
}
const tool = defineTool({
  name: "smoke-tool",
  access: "public",
  description: "Smoke-test a direct tool.",
  inputSchema: value,
  outputSchema: value,
  async handler({ value }, { reportLog }) {
    await reportLog?.({ level: "notice", logger: "release-smoke", data: value });
    return { text: value, data: { value } };
  },
});
const statefulTool = defineTool({
  name: "smoke-stateful-tool",
  access: "public",
  description: "Smoke-test signed request state.",
  inputSchema: z.object({}),
  outputSchema: value,
  async handler(_input, context) {
    const state = value.safeParse(context.requestState);
    if (state.success) return { data: state.data };
    if (!context.mintRequestState) throw new Error("request state is not configured");
    return inputRequired({
      requestState: await context.mintRequestState({ value: "signed state works" }),
    });
  },
});
const feedback = defineFeedbackSubmission({
  access: "public",
  scope: "release-smoke",
  backend: {
    submit: () => ({
      id: "release-feedback",
      recordedAt: "2026-09-10T00:00:00.000Z",
    }),
  },
});
let availabilityCalls = 0;
const mapped = defineMappedTool({
  name: "smoke-mapped-tool",
  access: "public",
  description: "Smoke-test a mapped tool.",
  inputSchema: value,
  outputSchema: value,
  backendInputSchema: value,
  backendOutputSchema: value,
  isAvailable(context) {
    availabilityCalls += 1;
    if (!Object.isFrozen(context) || "principal" in context) return false;
    return true;
  },
  mapInput: ({ value }) => ({ value }),
  adapter: ({ value }) => ({ value }),
  mapOutput: ({ value }) => ({ text: value, data: { value } }),
});
const streaming = defineStreamingTool({
  name: "smoke-streaming-tool",
  access: "public",
  description: "Smoke-test bounded progress.",
  inputSchema: z.object({}),
  outputSchema: z.object({ status: z.literal("complete") }),
  async handler(_input, { reportProgress }) {
    await reportProgress({ progress: 1, total: 1, message: "complete" });
    return { text: "complete", data: { status: "complete" } };
  },
});
const resourceUri = "smoke://static/value";
const resource = defineResource({
  access: "public",
  name: "smoke-resource",
  uri: resourceUri,
  async handler({ reportProgress }) {
    await reportProgress?.({ progress: 1, total: 1, message: "static" });
    return { contents: [
      { uri: resourceUri, text: "value" },
      { uri: "returned://installed/static", text: "static child" },
    ] };
  },
});
const resourceTemplate = defineResourceTemplate({
  access: "public",
  name: "smoke-resource-template",
  uriTemplate: "smoke://resource/{value}",
  complete: { value: (partial) => ["checked"].filter((value) => value.startsWith(partial)) },
  async handler({ uri }, context) {
    const state = value.safeParse(context.requestState);
    const round = state.success ? 2 : 1;
    await context.reportProgress?.({ progress: round, total: uri.endsWith("/rounds") ? 2 : 1, message: "template" });
    if (uri.endsWith("/rounds") && !state.success) {
      return inputRequired({ requestState: await context.mintRequestState({ value: "resumed" }) });
    }
    return { contents: [
      { uri, text: "value" },
      { uri: "returned://installed/template", text: "template child" },
    ] };
  },
});
const prompt = definePrompt({
  access: "public",
  name: "smoke-prompt",
  argsSchema: value,
  complete: { value: (partial) => ["checked"].filter((value) => value.startsWith(partial)) },
  async handler({ value: promptValue }, context) {
    const state = value.safeParse(context.requestState);
    const round = state.success ? 2 : 1;
    await context.reportProgress?.({
      progress: round,
      total: promptValue === "rounds" ? 2 : 1,
      message: promptValue === "byte-limit" ? "x".repeat(300) : "prompt",
    });
    if (promptValue === "event-limit") {
      await context.reportProgress?.({ progress: 2, total: 2, message: "overflow" });
    }
    if (promptValue === "rounds" && !state.success) {
      return inputRequired({ requestState: await context.mintRequestState({ value: "resumed" }) });
    }
    return { messages: [{ role: "user", content: { type: "text", text: promptValue } }] };
  },
});
let protectedCalls = 0;
const protectedResource = defineResource({
  access: "protected",
  requiredScopes: ["smoke:read"],
  name: "smoke-protected-resource",
  uri: "smoke://protected/resource",
  async handler({ reportProgress }) {
    protectedCalls += 1;
    await reportProgress?.({ progress: 1, total: 1 });
    return { contents: [{ uri: "smoke://protected/resource", text: "protected" }] };
  },
});
const protectedPrompt = definePrompt({
  access: "protected",
  requiredScopes: ["smoke:read"],
  name: "smoke-protected-prompt",
  argsSchema: z.object({}),
  async handler(_args, { reportProgress }) {
    protectedCalls += 1;
    await reportProgress?.({ progress: 1, total: 1 });
    return { messages: [] };
  },
});
const rootsTool = defineTool({
  name: "smoke-roots", access: "public", description: "Check client roots after installation.",
  inputSchema: z.object({}), outputSchema: z.object({ uri: z.string() }),
  handler(_input, context) {
    const roots = rootsResponse(context.inputResponses, "workspace");
    return roots === undefined
      ? inputRequired({ inputRequests: { workspace: inputRequired.roots() } })
      : { data: { uri: roots[0]?.uri ?? "" } };
  },
});
const app = createEmseepea({
  name: "installed-package-smoke",
  version: "0.0.0",
  tools: [tool, statefulTool, rootsTool, mapped, streaming],
  additionalTools: [feedback],
  resources: [resource, resourceTemplate, protectedResource],
  prompts: [prompt, protectedPrompt],
  maxProgressEvents: 1,
  maxProgressEventBytes: 256,
  resourceSubscriptions: { maxLifetimeMs: 5_000 },
  requestState: {
    key: "0123456789abcdef0123456789abcdef",
    ttlSeconds: 60,
    maxBytes: 4 * 1024,
  },
  authentication: {
    verifier: { verifyAccessToken: () => { throw new OAuthError(OAuthErrorCode.InvalidToken, "invalid"); } },
    metadata: {
      resourceServerUrl: new URL("https://api.example/mcp"),
      oauthMetadata: {
        issuer: "https://auth.example",
        authorization_endpoint: "https://auth.example/authorize",
        token_endpoint: "https://auth.example/token",
        response_types_supported: ["code"],
      },
    },
  },
  clientLogging: {},
  clientRoots: {},
});
const progressTokens = [];
app.addHook("preHandler", async (request) => {
  const body = request.body;
  if (!body || Array.isArray(body) || typeof body !== "object") return;
  const token = body.params?._meta?.progressToken;
  if (body.params?._meta?.["io.modelcontextprotocol/protocolVersion"] === "2026-07-28"
      && token !== undefined && token !== "denied-token") progressTokens.push(token);
});
const running = await serveEmseepea(app, { port: 0 });
const subscriptionController = new AbortController();
let subscriptionReader;
const request = async (method, params = {}) => {
  const response = await fetch(running.url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(method === "resources/read" ? { "Mcp-Name": params.uri } : {}),
      ...(method === "tools/call" ? { "Mcp-Name": params.name } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "release-smoke", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
  return response.json();
};
try {
  for (const protocolVersion of [
    "2025-11-25",
    "2025-06-18",
    "2025-03-26",
    "2024-11-05",
    "2024-10-07",
  ]) {
    const transport = new StreamableHTTPClientTransport(running.url);
    const client = new Client(
      { name: `installed-legacy-${protocolVersion}`, version: "0.0.0" },
      { supportedProtocolVersions: [protocolVersion], versionNegotiation: { mode: "legacy" } },
    );
    try {
      await client.connect(transport);
      if (client.getNegotiatedProtocolVersion() !== protocolVersion || transport.sessionId !== undefined) {
        throw new Error(`installed package did not negotiate stateless MCP ${protocolVersion}`);
      }
      const tools = await client.listTools();
      if (!tools.tools.some(({ name }) => name === "smoke-tool")) {
        throw new Error(`installed package did not list tools for MCP ${protocolVersion}`);
      }
      const result = await client.callTool({
        name: "smoke-tool",
        arguments: { value: protocolVersion },
      });
      if (result.structuredContent?.value !== protocolVersion || transport.sessionId !== undefined) {
        throw new Error(`installed package did not call a tool statelessly for MCP ${protocolVersion}`);
      }
      await client.readResource(
        { uri: resourceUri },
        { onprogress: () => { throw new Error(`legacy resource emitted progress for MCP ${protocolVersion}`); } },
      );
      await client.getPrompt(
        { name: "smoke-prompt", arguments: { value: protocolVersion } },
        { onprogress: () => { throw new Error(`legacy prompt emitted progress for MCP ${protocolVersion}`); } },
      );
    } finally {
      await client.close();
    }
  }
  const loggedMessages = [];
  const loggingClient = new Client(
    { name: "installed-logging-client", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  loggingClient.setNotificationHandler("notifications/message", ({ params }) => {
    loggedMessages.push(params);
  });
  try {
    await loggingClient.connect(new StreamableHTTPClientTransport(running.url));
    const loggedResult = await loggingClient.callTool({
      name: "smoke-tool",
      arguments: { value: "client logging works" },
      _meta: { "io.modelcontextprotocol/logLevel": "notice" },
    });
    if (loggedResult.structuredContent?.value !== "client logging works"
        || loggedMessages.length !== 1
        || loggedMessages[0].data !== "client logging works") {
      throw new Error("installed package did not deliver request-scoped client logging");
    }
  } finally {
    await loggingClient.close();
  }
  const firstStateRound = await request("tools/call", {
    name: "smoke-stateful-tool",
    arguments: {},
  });
  const rawStateResult = await request("tools/call", {
    name: "smoke-stateful-tool",
    arguments: {},
    requestState: firstStateRound.result.requestState,
  });
  if (rawStateResult.result.structuredContent?.value !== "signed state works") {
    throw new Error("installed package did not resume raw-HTTP request state");
  }
  const stateClient = new Client(
    { name: "installed-state-client", version: "0.0.0" },
    {
      capabilities: { roots: {} },
      inputRequired: { maxRounds: 2 },
      versionNegotiation: { mode: { pin: "2026-07-28" } },
    },
  );
  stateClient.setRequestHandler("roots/list", async () => ({ roots: [{ uri: "file:///release-smoke" }] }));
  try {
    await stateClient.connect(new StreamableHTTPClientTransport(running.url));
    const rootsResult = await stateClient.callTool({ name: "smoke-roots", arguments: {} });
    if (rootsResult.structuredContent?.uri !== "file:///release-smoke") {
      throw new Error("installed package did not complete the client roots round trip");
    }
    const stateResult = await stateClient.callTool({
      name: "smoke-stateful-tool",
      arguments: {},
    });
    if (stateResult.structuredContent?.value !== "signed state works") {
      throw new Error("installed package did not resume official-client request state");
    }
  } finally {
    await stateClient.close();
  }
  const feedbackResult = await request("tools/call", {
    name: "submit-feedback",
    arguments: {
      observation: "notable_success",
      detail: "The installed feedback package worked.",
    },
  });
  if (feedbackResult.result.structuredContent?.id !== "release-feedback") {
    throw new Error("installed feedback package did not compose with the server");
  }
  const mappedResult = await request("tools/call", {
    name: "smoke-mapped-tool",
    arguments: { value: "checked" },
  });
  if (mappedResult.result.structuredContent?.value !== "checked" || availabilityCalls !== 1) {
    throw new Error("installed package did not run its checked mapped-tool boundary");
  }
  const templates = await request("resources/templates/list");
  if (templates.result.resourceTemplates[0]?.uriTemplate !== "smoke://resource/{value}") {
    throw new Error("installed package did not expose its resource template");
  }
  const staticRead = await request("resources/read", { uri: resourceUri });
  if (staticRead.result.contents[0]?.uri !== resourceUri
      || staticRead.result.contents[1]?.uri !== "returned://installed/static") {
    throw new Error("installed package did not return static multi-content resources");
  }
  const templateRead = await request("resources/read", { uri: "smoke://resource/checked" });
  if (templateRead.result.contents[0]?.uri !== "smoke://resource/checked"
      || templateRead.result.contents[1]?.uri !== "returned://installed/template") {
    throw new Error("installed package did not return template multi-content resources");
  }
  const progressClient = new Client(
    { name: "installed-resource-prompt-progress", version: "0.0.0" },
    {
      inputRequired: { maxRounds: 2 },
      versionNegotiation: { mode: { pin: "2026-07-28" } },
    },
  );
  try {
    await progressClient.connect(new StreamableHTTPClientTransport(running.url));
    const order = [];
    for (const [name, call] of [
      ["static", (options) => progressClient.readResource({ uri: resourceUri }, options)],
      ["template", (options) => progressClient.readResource({ uri: "smoke://resource/checked" }, options)],
      ["prompt", (options) => progressClient.getPrompt({ name: "smoke-prompt", arguments: { value: "checked" } }, options)],
    ]) {
      await call({ onprogress: ({ message }) => order.push(`${name}:progress:${message}`) });
      order.push(`${name}:complete`);
    }
    if (order.join(",") !== [
      "static:progress:static", "static:complete",
      "template:progress:template", "template:complete",
      "prompt:progress:prompt", "prompt:complete",
    ].join(",")) {
      throw new Error("installed package did not isolate resource and prompt progress before terminal results");
    }
    for (const [name, call] of [
      ["template", (options) => progressClient.readResource({ uri: "smoke://resource/rounds" }, options)],
      ["prompt", (options) => progressClient.getPrompt({ name: "smoke-prompt", arguments: { value: "rounds" } }, options)],
    ]) {
      const rounds = [];
      await call({ onprogress: ({ progress }) => rounds.push(progress) });
      if ([...new Set(rounds)].join(",") !== "1,2") {
        throw new Error(`installed package did not issue fresh ${name} progress rounds`);
      }
    }
    const eventLimitUpdates = [];
    await expectFailure(() => progressClient.getPrompt(
      { name: "smoke-prompt", arguments: { value: "event-limit" } },
      { onprogress: (update) => eventLimitUpdates.push(update) },
    ), /Prompt rendering failed/, "progress event limit");
    if (eventLimitUpdates.length !== 1) throw new Error("installed package did not fail at its progress event limit");
    const byteLimitUpdates = [];
    await expectFailure(() => progressClient.getPrompt(
      { name: "smoke-prompt", arguments: { value: "byte-limit" } },
      { onprogress: (update) => byteLimitUpdates.push(update) },
    ), /Prompt rendering failed/, "progress event byte limit");
    if (byteLimitUpdates.length !== 0) throw new Error("installed package emitted an oversized progress event");
    if (new Set(progressTokens).size !== progressTokens.length) {
      throw new Error("installed package reused a resource or prompt progress token");
    }
  } finally {
    await progressClient.close();
  }
  for (const [method, params] of [
    ["resources/read", { uri: "smoke://protected/resource" }],
    ["prompts/get", { name: "smoke-protected-prompt", arguments: {} }],
  ]) {
    const denied = await progressRequest(running.url, method, params, "denied-token", "invalid");
    if (denied.status !== 401 || denied.body.includes("notifications/progress")) {
      throw new Error(`installed package did not authorize ${method} before progress`);
    }
  }
  if (protectedCalls !== 0) throw new Error("installed package ran a protected handler before authorization");
  for (const params of [
    {
      ref: { type: "ref/prompt", name: "smoke-prompt" },
      argument: { name: "value", value: "ch" },
    },
    {
      ref: { type: "ref/resource", uri: "smoke://resource/{value}" },
      argument: { name: "value", value: "ch" },
    },
  ]) {
    const completion = await request("completion/complete", params);
    if (completion.result.completion.values[0] !== "checked") {
      throw new Error("installed package did not complete its public definition");
    }
  }
  const subscription = await fetch(running.url, {
    method: "POST",
    signal: AbortSignal.any([subscriptionController.signal, AbortSignal.timeout(5_000)]),
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "subscriptions/listen",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "subscriptions/listen",
      params: {
        notifications: { resourceSubscriptions: [resourceUri] },
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "release-smoke", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  if (!subscription.ok || !subscription.headers.get("content-type")?.startsWith("text/event-stream")) {
    throw new Error("installed package did not open a resource subscription");
  }
  subscriptionReader = subscription.body.getReader();
  const acknowledged = await nextSseMessage(subscriptionReader);
  if (acknowledged.method !== "notifications/subscriptions/acknowledged") {
    throw new Error("installed package did not acknowledge its resource subscription");
  }
  notifyResourceUpdated(app, resourceUri);
  const updated = await nextSseMessage(subscriptionReader);
  if (updated.method !== "notifications/resources/updated" || updated.params?.uri !== resourceUri) {
    throw new Error("installed package did not deliver its resource update");
  }
  const streamed = await fetch(running.url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "tools/call",
      "Mcp-Name": "smoke-streaming-tool",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: "smoke-streaming-tool",
        arguments: {},
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "release-smoke", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
          progressToken: 1,
        },
      },
    }),
  });
  const streamBody = await streamed.text();
  if (!streamed.headers.get("content-type")?.startsWith("text/event-stream")
      || !streamBody.includes('"progress":1')
      || !streamBody.includes('"status":"complete"')) {
    throw new Error("installed package did not stream progress and its final result");
  }
} finally {
  subscriptionController.abort();
  await subscriptionReader?.cancel().catch(() => {});
  await running.close();
}

async function nextSseMessage(reader) {
  const decoder = new TextDecoder();
  let pending = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error("installed package resource subscription ended early");
    pending += decoder.decode(value, { stream: true });
    const boundary = pending.indexOf("\n\n");
    if (boundary === -1) continue;
    const data = pending.slice(0, boundary).split("\n").find((line) => line.startsWith("data: "));
    if (data) return JSON.parse(data.slice(6));
    pending = pending.slice(boundary + 2);
  }
}

async function expectFailure(call, expected, description) {
  try {
    await call();
  } catch (error) {
    if (expected.test(String(error))) return;
    throw error;
  }
  throw new Error(`installed package did not enforce its ${description}`);
}

async function progressRequest(url, method, params, progressToken, bearerToken) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      "Mcp-Name": method === "resources/read" ? params.uri : params.name,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "release-smoke", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
          progressToken,
        },
      },
    }),
  });
  return { status: response.status, body: await response.text() };
}
