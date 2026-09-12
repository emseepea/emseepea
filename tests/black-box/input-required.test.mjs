import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
  acceptedContent,
  createEmseepea,
  defineMappedTool,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  defineStreamingTool,
  defineTool,
  inputRequired,
  inputResponse,
  serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";

const answerSchema = z.object({ answer: z.string().min(1) });
const stateSchema = z.object({ value: z.string() });

test("signed request state resumes every direct handler", async () => {
  const calls = { prompt: 0, resource: 0, template: 0, tool: 0 };
  const resume = async (kind, context, finish) => {
    calls[kind] += 1;
    const state = stateSchema.safeParse(context.requestState);
    if (state.success) return finish(state.data.value);
    assert.equal(typeof context.mintRequestState, "function");
    return inputRequired({
      requestState: await context.mintRequestState({ value: "resumed" }),
    });
  };
  const tool = defineTool({
    name: "stateful-tool",
    access: "public",
    description: "Resume a tool call from signed request state.",
    inputSchema: z.object({}),
    outputSchema: z.object({ value: z.string() }),
    async handler(_input, context) {
      calls.tool += 1;
      const state = stateSchema.safeParse(context.requestState);
      const answer = acceptedContent(context.inputResponses, "person", answerSchema);
      if (state.success && answer) {
        return { data: { value: `${state.data.value}:${answer.answer}` } };
      }
      assert.equal(typeof context.mintRequestState, "function");
      return inputRequired({
        requestState: await context.mintRequestState({ value: "resumed" }),
        inputRequests: {
          person: inputRequired.elicit({
            message: "Who should resume this request?",
            requestedSchema: answerSchema,
          }),
        },
      });
    },
  });
  const resource = defineResource({
    name: "stateful-resource",
    access: "public",
    uri: "state://static",
    handler: (context) => resume("resource", context, (value) => ({
      contents: [{ uri: "state://static", text: value }],
    })),
  });
  const template = defineResourceTemplate({
    name: "stateful-template",
    access: "public",
    uriTemplate: "state://template/{id}",
    handler: ({ uri }, context) => resume("template", context, (value) => ({
      contents: [{ uri, text: value }],
    })),
  });
  const prompt = definePrompt({
    name: "stateful-prompt",
    access: "public",
    argsSchema: z.object({}),
    handler: (_args, context) => resume("prompt", context, (value) => ({
      messages: [{ role: "user", content: { type: "text", text: value } }],
    })),
  });
  const running = await serveEmseepea(createEmseepea({
    name: "request-state-test",
    version: "0.0.0",
    tools: [tool],
    resources: [resource, template],
    prompts: [prompt],
    requestState: {
      key: "0123456789abcdef0123456789abcdef",
      ttlSeconds: 60,
      maxBytes: 4 * 1024,
    },
  }), { port: 0 });
  const client = new Client(
    { name: "request-state-client", version: "0.0.0" },
    {
      capabilities: { elicitation: { form: {} } },
      inputRequired: { maxRounds: 2 },
      versionNegotiation: { mode: { pin: "2026-07-28" } },
    },
  );
  client.setRequestHandler("elicitation/create", async () => ({
    action: "accept",
    content: { answer: "Ada" },
  }));

  try {
    await client.connect(new StreamableHTTPClientTransport(running.url));
    assert.equal((await client.callTool({ name: "stateful-tool", arguments: {} }))
      .structuredContent.value, "resumed:Ada");
    assert.equal((await client.readResource({ uri: "state://static" })).contents[0].text, "resumed");
    assert.equal((await client.readResource({ uri: "state://template/1" })).contents[0].text, "resumed");
    assert.equal((await client.getPrompt({ name: "stateful-prompt", arguments: {} }))
      .messages[0].content.text, "resumed");
    assert.deepEqual(calls, { prompt: 2, resource: 2, template: 2, tool: 2 });
  } finally {
    await client.close();
    await running.close();
  }
});

test("request state rejects tampering, changed capabilities, and changed keys", async () => {
  const calls = { alpha: 0, beta: 0 };
  let resourceCalls = 0;
  const statefulTool = (name) => defineTool({
    name,
    access: "public",
    description: `Resume ${name} from signed state.`,
    inputSchema: z.object({}),
    outputSchema: z.object({ value: z.string() }),
    async handler(_input, context) {
      calls[name] += 1;
      const state = stateSchema.safeParse(context.requestState);
      if (state.success) return { data: state.data };
      return inputRequired({ requestState: await context.mintRequestState({ value: name }) });
    },
  });
  const tools = [statefulTool("alpha"), statefulTool("beta")];
  const resource = defineResource({
    name: "wrong-method-target",
    access: "public",
    uri: "state://wrong-method",
    handler() {
      resourceCalls += 1;
      return { contents: [{ uri: "state://wrong-method", text: "unexpected" }] };
    },
  });
  const makeServer = (key) => serveEmseepea(createEmseepea({
    name: "request-state-security-test",
    version: "0.0.0",
    tools,
    resources: [resource],
    requestState: { key, ttlSeconds: 60, maxBytes: 4 * 1024 },
  }), { port: 0 });
  const first = await makeServer("0123456789abcdef0123456789abcdef");
  const otherKey = await makeServer("abcdef0123456789abcdef0123456789");
  let child;

  try {
    const initial = await rawToolCall(first.url, "alpha");
    const state = initial.body.result.requestState;
    assert.equal(typeof state, "string");

    const macStart = state.lastIndexOf(".") + 1;
    const tampered = `${state.slice(0, macStart)}${state[macStart] === "a" ? "b" : "a"}${state.slice(macStart + 1)}`;

    for (const [url, name, candidate] of [
      [first.url, "alpha", tampered],
      [first.url, "alpha", `${state}${"x".repeat(5_000)}`],
      [first.url, "beta", state],
      [otherKey.url, "alpha", state],
    ]) {
      const rejected = await rawToolCall(url, name, candidate);
      assert.equal(rejected.body.error.code, -32602);
      assert.equal(rejected.body.error.message, "Invalid or expired requestState");
      assert.equal(JSON.stringify(rejected.body).includes("alpha"), false);
    }
    const wrongMethod = await rawResourceRead(first.url, "state://wrong-method", state);
    assert.equal(wrongMethod.body.error.code, -32602);
    assert.equal(resourceCalls, 0);

    await first.close();
    child = spawn(process.execPath, [fileURLToPath(new URL(
      "../fixtures/request-state-server.mjs",
      import.meta.url,
    ))], {
      stdio: ["ignore", "ignore", "inherit", "ipc"],
    });
    const [childUrl] = await once(child, "message", { signal: AbortSignal.timeout(5_000) });
    const resumedAfterRestart = await rawToolCall(new URL(childUrl), "alpha", state);
    assert.equal(resumedAfterRestart.body.result.structuredContent.value, "alpha");
    assert.deepEqual(calls, { alpha: 1, beta: 0 });
  } finally {
    if (child?.connected) child.send("close");
    if (child && child.exitCode === null) await once(child, "exit");
    await Promise.all([first.close(), otherKey.close()]);
  }
});

test("expired request state fails before handler re-entry", async () => {
  let handlerCalls = 0;
  const tool = defineTool({
    name: "expiring-state",
    access: "public",
    description: "Resume state before its expiry.",
    inputSchema: z.object({}),
    outputSchema: z.object({ value: z.string() }),
    async handler(_input, context) {
      handlerCalls += 1;
      return inputRequired({ requestState: await context.mintRequestState({ value: "late" }) });
    },
  });
  const running = await serveEmseepea(createEmseepea({
    name: "expiring-request-state-test",
    version: "0.0.0",
    tools: [tool],
    requestState: {
      key: "0123456789abcdef0123456789abcdef",
      ttlSeconds: 1,
    },
  }), { port: 0 });

  try {
    const initial = await rawToolCall(running.url, "expiring-state");
    await delay(2_100);
    const expired = await rawToolCall(running.url, "expiring-state", initial.body.result.requestState);
    assert.equal(expired.body.error.code, -32602);
    assert.equal(expired.body.error.message, "Invalid or expired requestState");
    assert.equal(handlerCalls, 1);
  } finally {
    await running.close();
  }
});

test("request-state configuration fails closed at startup", () => {
  const base = { name: "invalid-state-config", version: "0.0.0" };
  assert.throws(() => createEmseepea({
    ...base,
    requestState: { key: "short", ttlSeconds: 60 },
  }), /at least 32 bytes/);
  assert.throws(() => createEmseepea({
    ...base,
    requestState: { key: "0123456789abcdef0123456789abcdef", ttlSeconds: 0 },
  }), /positive safe integer/);
  assert.throws(() => createEmseepea({
    ...base,
    requestState: {
      key: "0123456789abcdef0123456789abcdef",
      ttlSeconds: 60,
      maxBytes: 0,
    },
  }), /positive safe integer/);
});

test("protected request state is authorized and bound to its principal every round", async () => {
  let verifierCalls = 0;
  let handlerCalls = 0;
  const tool = defineTool({
    name: "protected-state",
    access: "protected",
    requiredScopes: ["state:use"],
    description: "Resume protected signed state.",
    inputSchema: z.object({}),
    outputSchema: z.object({ value: z.string() }),
    async handler(_input, context) {
      handlerCalls += 1;
      const state = stateSchema.safeParse(context.requestState);
      if (state.success) return { data: state.data };
      return inputRequired({
        requestState: await context.mintRequestState({ value: context.principal.clientId }),
      });
    },
  });
  const running = await serveEmseepea(createEmseepea({
    name: "protected-request-state-test",
    version: "0.0.0",
    tools: [tool],
    requestState: {
      key: "0123456789abcdef0123456789abcdef",
      ttlSeconds: 60,
    },
    authentication: {
      verifier: {
        async verifyAccessToken(token) {
          verifierCalls += 1;
          return {
            token,
            clientId: token,
            scopes: ["state:use"],
            expiresAt: Math.floor(Date.now() / 1_000) + 60,
            resource: new URL("https://api.example/mcp"),
          };
        },
      },
      metadata: {
        resourceServerUrl: new URL("https://api.example/mcp"),
        scopesSupported: ["state:use"],
        oauthMetadata: {
          issuer: "https://auth.example",
          authorization_endpoint: "https://auth.example/authorize",
          token_endpoint: "https://auth.example/token",
          response_types_supported: ["code"],
        },
      },
    },
  }), { port: 0 });

  try {
    const initial = await rawToolCall(running.url, "protected-state", undefined, "client-a");
    const state = initial.body.result.requestState;
    const wrongPrincipal = await rawToolCall(running.url, "protected-state", state, "client-b");
    assert.equal(wrongPrincipal.body.error.code, -32602);
    assert.equal(handlerCalls, 1);
    const resumed = await rawToolCall(running.url, "protected-state", state, "client-a");
    assert.equal(resumed.body.result.structuredContent.value, "client-a");
    assert.equal(handlerCalls, 2);
    assert.equal(verifierCalls, 3);
  } finally {
    await running.close();
  }
});

test("direct handlers can request client input through every supported method", async () => {
  const calls = { prompt: 0, resource: 0, template: 0, tool: 0 };
  const requestIds = new Map();
  const tool = defineTool({
    name: "greet-person",
    access: "public",
    description: "Ask for a name, then greet that person.",
    inputSchema: z.object({}),
    outputSchema: z.object({ greeting: z.string() }),
    handler(_input, context) {
      calls.tool += 1;
      const answer = acceptedContent(context.inputResponses, "person", answerSchema);
      if (!answer) {
        return inputRequired({
          inputRequests: {
            person: inputRequired.elicit({
              message: "Who should be greeted?",
              requestedSchema: answerSchema,
            }),
          },
        });
      }
      return { data: { greeting: `Hello, ${answer.answer}.` } };
    },
  });
  const resource = defineResource({
    access: "public",
    name: "requested-summary",
    uri: "coffee://summary",
    handler(context) {
      calls.resource += 1;
      const answer = acceptedContent(context.inputResponses, "summary", answerSchema);
      if (!answer) {
        return inputRequired({
          inputRequests: {
            summary: inputRequired.elicit({
              message: "How should the coffee be described?",
              requestedSchema: answerSchema,
            }),
          },
        });
      }
      return { contents: [{ uri: "coffee://summary", text: answer.answer }] };
    },
  });
  const prompt = definePrompt({
    access: "public",
    name: "authorization-link",
    argsSchema: z.object({}),
    handler(_args, context) {
      calls.prompt += 1;
      const response = inputResponse(context.inputResponses, "authorization");
      if (response.kind !== "elicit") {
        return inputRequired({
          inputRequests: {
            authorization: inputRequired.elicitUrl({
              message: "Authorize access in the browser.",
              url: "https://auth.example/authorize",
            }),
          },
        });
      }
      return {
        messages: [{
          role: "user",
          content: { type: "text", text: `Authorization response: ${response.action}.` },
        }],
      };
    },
  });
  const template = defineResourceTemplate({
    access: "public",
    name: "personal-summary",
    uriTemplate: "coffee://summary/{name}",
    handler({ uri }, context) {
      calls.template += 1;
      const answer = acceptedContent(context.inputResponses, "note", answerSchema);
      if (!answer) {
        return inputRequired({
          inputRequests: {
            note: inputRequired.elicit({
              message: "What note should be included?",
              requestedSchema: answerSchema,
            }),
          },
        });
      }
      return { contents: [{ uri, text: answer.answer }] };
    },
  });
  const app = createEmseepea({
    name: "input-required-test",
    version: "0.0.0",
    tools: [tool],
    resources: [resource, template],
    prompts: [prompt],
  });
  app.addHook("preHandler", async (request) => {
    const body = request.body;
    if (!body || Array.isArray(body) || typeof body !== "object" ||
        typeof body.method !== "string" || !("id" in body)) return;
    const ids = requestIds.get(body.method) ?? [];
    ids.push(body.id);
    requestIds.set(body.method, ids);
  });
  const running = await serveEmseepea(app, { port: 0 });
  const client = new Client(
    { name: "input-required-client", version: "0.0.0" },
    {
      capabilities: {
        elicitation: { form: {}, url: {} },
      },
      inputRequired: { maxRounds: 2 },
      versionNegotiation: { mode: { pin: "2026-07-28" } },
    },
  );
  client.setRequestHandler("elicitation/create", async (request) =>
    request.params.mode === "url"
      ? { action: "accept" }
      : { action: "accept", content: { answer: "Ada" } });

  try {
    await client.connect(new StreamableHTTPClientTransport(running.url));
    const greeting = await client.callTool({ name: "greet-person", arguments: {} });
    assert.equal(greeting.content[0].text, JSON.stringify({ greeting: "Hello, Ada." }));
    const summary = await client.readResource({ uri: "coffee://summary" });
    assert.equal(summary.contents[0].text, "Ada");
    const personal = await client.readResource({ uri: "coffee://summary/Ada" });
    assert.equal(personal.contents[0].text, "Ada");
    const urlPrompt = await client.getPrompt({ name: "authorization-link", arguments: {} });
    assert.equal(urlPrompt.messages[0].content.text, "Authorization response: accept.");
    assert.deepEqual(calls, { prompt: 2, resource: 2, template: 2, tool: 2 });
    assertFreshRoundIds(requestIds, "tools/call", 2);
    assertFreshRoundIds(requestIds, "resources/read", 4);
    assertFreshRoundIds(requestIds, "prompts/get", 2);

    for (const [capabilities, run] of [
      [{ elicitation: { form: {} } }, (limitedClient) => limitedClient.getPrompt({
        name: "authorization-link",
        arguments: {},
      })],
      [{ elicitation: { url: {} } }, (limitedClient) => limitedClient.readResource({
        uri: "coffee://summary",
      })],
    ]) {
      const limitedClient = new Client(
        { name: "limited-input-client", version: "0.0.0" },
        {
          capabilities,
          inputRequired: { maxRounds: 1 },
          versionNegotiation: { mode: { pin: "2026-07-28" } },
        },
      );
      try {
        await limitedClient.connect(new StreamableHTTPClientTransport(running.url));
        await assert.rejects(run(limitedClient), /capabilit/i);
      } finally {
        await limitedClient.close();
      }
    }
    assert.deepEqual(calls, { prompt: 3, resource: 3, template: 2, tool: 2 });
  } finally {
    await client.close();
    await running.close();
  }
});

test("client input stays bounded, untrusted, cancellable, and authorized per round", async () => {
  let verifierCalls = 0;
  let toolCalls = 0;
  let timedOut = false;
  let cancelled = false;
  let markCancelRound;
  const cancelRound = new Promise((resolve) => { markCancelRound = resolve; });
  const tool = defineTool({
    name: "confirm-name",
    access: "protected",
    requiredScopes: ["names:write"],
    description: "Ask for and confirm a name.",
    inputSchema: z.object({
      mode: z.enum(["normal", "oversized", "stateful", "slow", "cancel"]),
    }),
    outputSchema: z.object({ status: z.string() }),
    async handler({ mode }, context) {
      toolCalls += 1;
      if (mode === "oversized") {
        return inputRequired({
          inputRequests: {
            person: inputRequired.elicit({
              message: "x".repeat(2_000),
              requestedSchema: answerSchema,
            }),
          },
        });
      }
      if (mode === "stateful") {
        return { resultType: "input_required", requestState: "secret-state-sentinel" };
      }
      const view = inputResponse(context.inputResponses, "person");
      if (view.kind === "elicit" && view.action !== "accept") {
        return { text: view.action, data: { status: view.action } };
      }
      const answer = acceptedContent(context.inputResponses, "person", answerSchema);
      if (!answer) {
        return inputRequired({
          inputRequests: {
            person: inputRequired.elicit({
              message: "Which name should be confirmed?",
              requestedSchema: answerSchema,
            }),
          },
        });
      }
      if (mode === "slow") {
        context.signal.addEventListener("abort", () => { timedOut = true; }, { once: true });
        await delay(500, undefined, { signal: context.signal });
      }
      if (mode === "cancel") {
        context.signal.addEventListener("abort", () => { cancelled = true; }, { once: true });
        markCancelRound();
        await delay(500, undefined, { signal: context.signal });
      }
      return { text: answer.answer, data: { status: answer.answer } };
    },
  });
  const app = createEmseepea({
    name: "input-required-safety-test",
    version: "0.0.0",
    tools: [tool],
    maxApplicationResultBytes: 512,
    operationTimeoutMs: 100,
    authentication: {
      verifier: {
        async verifyAccessToken(token) {
          verifierCalls += 1;
          if (token !== "valid") throw new Error("invalid token detail");
          return {
            token,
            clientId: "input-required-client",
            scopes: ["names:write"],
            expiresAt: Math.floor(Date.now() / 1_000) + 60,
            resource: new URL("https://api.example/mcp"),
          };
        },
      },
      metadata: {
        resourceServerUrl: new URL("https://api.example/mcp"),
        scopesSupported: ["names:write"],
        oauthMetadata: {
          issuer: "https://auth.example",
          authorization_endpoint: "https://auth.example/authorize",
          token_endpoint: "https://auth.example/token",
          response_types_supported: ["code"],
        },
      },
    },
  });
  const running = await serveEmseepea(app, { port: 0 });

  try {
    const accepted = await withElicitationClient(running.url, {
      action: "accept",
      content: { answer: "Ada" },
    }, (client) => client.callTool({ name: "confirm-name", arguments: { mode: "normal" } }));
    assert.equal(accepted.structuredContent.status, "Ada");
    assert.equal(verifierCalls, 2);

    await assert.rejects(
      withElicitationClient(
        running.url,
        { action: "accept", content: { answer: "Ada" } },
        (client) => client.callTool({ name: "confirm-name", arguments: { mode: "normal" } }),
        { dropRetryAuth: true },
      ),
      (error) => error.data?.status === 401,
    );
    assert.equal(verifierCalls, 3);
    assert.equal(toolCalls, 3);

    for (const action of ["decline", "cancel"]) {
      const result = await withElicitationClient(
        running.url,
        { action },
        (client) => client.callTool({ name: "confirm-name", arguments: { mode: "normal" } }),
      );
      assert.equal(result.structuredContent.status, action);
    }
    assert.equal(verifierCalls, 7);

    await assert.rejects(
      withElicitationClient(
        running.url,
        { action: "accept", content: { answer: "" } },
        (client) => client.callTool({ name: "confirm-name", arguments: { mode: "normal" } }),
        { maxRounds: 1 },
      ),
      /round/i,
    );
    assert.equal(verifierCalls, 9);

    const oversized = await withElicitationClient(
      running.url,
      { action: "accept", content: { answer: "Ada" } },
      (client) => client.callTool({ name: "confirm-name", arguments: { mode: "oversized" } }),
    );
    assert.equal(oversized.isError, true);
    assert.equal(oversized.content[0].text, "Tool execution failed");
    assert.equal(verifierCalls, 10);

    const stateful = await withElicitationClient(
      running.url,
      { action: "accept", content: { answer: "Ada" } },
      (client) => client.callTool({ name: "confirm-name", arguments: { mode: "stateful" } }),
    );
    assert.equal(stateful.isError, true);
    assert.equal(stateful.content[0].text, "Tool execution failed");
    assert.equal(JSON.stringify(stateful).includes("secret-state-sentinel"), false);
    assert.equal(verifierCalls, 11);

    const slow = await withElicitationClient(
      running.url,
      { action: "accept", content: { answer: "Ada" } },
      (client) => client.callTool({ name: "confirm-name", arguments: { mode: "slow" } }),
    );
    assert.equal(slow.isError, true);
    assert.equal(timedOut, true);
    assert.equal(verifierCalls, 13);

    const controller = new AbortController();
    const cancelledCall = withElicitationClient(
      running.url,
      { action: "accept", content: { answer: "Ada" } },
      (client) => client.callTool(
        { name: "confirm-name", arguments: { mode: "cancel" } },
        { signal: controller.signal },
      ),
    );
    await cancelRound;
    controller.abort();
    await assert.rejects(cancelledCall, /abort/i);
    await delay(10);
    assert.equal(cancelled, true);
    assert.equal(verifierCalls, 15);

    await assert.rejects(
      withElicitationClient(
        running.url,
        undefined,
        (client) => client.callTool({ name: "confirm-name", arguments: { mode: "normal" } }),
        { capabilities: false },
      ),
      /capabilit/i,
    );
    assert.equal(verifierCalls, 16);
    assert.equal(toolCalls, 16);
  } finally {
    await running.close();
  }
});

test("mapped and streaming tools cannot bypass their checked execution paths", async () => {
  const schema = z.object({});
  const request = () => inputRequired({
    inputRequests: {
      person: inputRequired.elicit({
        message: "Who?",
        requestedSchema: answerSchema,
      }),
    },
  });
  const mapped = defineMappedTool({
    name: "mapped-input-request",
    access: "public",
    description: "Reject client-input requests after mapped execution.",
    inputSchema: schema,
    outputSchema: schema,
    backendInputSchema: schema,
    backendOutputSchema: schema,
    mapInput: () => ({}),
    adapter: () => ({}),
    mapOutput: request,
  });
  const streaming = defineStreamingTool({
    name: "streaming-input-request",
    access: "public",
    description: "Reject client-input requests after streaming execution.",
    inputSchema: schema,
    outputSchema: schema,
    handler: request,
  });
  const deprecatedRoots = defineTool({
    name: "deprecated-roots-request",
    access: "public",
    description: "Reject a deprecated roots request.",
    inputSchema: schema,
    outputSchema: schema,
    handler: () => ({
      resultType: "input_required",
      inputRequests: { roots: { method: "roots/list" } },
    }),
  });
  const deprecatedSampling = defineTool({
    name: "deprecated-sampling-request",
    access: "public",
    description: "Reject a deprecated Sampling request.",
    inputSchema: schema,
    outputSchema: schema,
    handler: () => ({
      resultType: "input_required",
      inputRequests: {
        sample: {
          method: "sampling/createMessage",
          params: { messages: [], maxTokens: 1 },
        },
      },
    }),
  });
  const inspect = defineTool({
    name: "inspect-untrusted-response",
    access: "public",
    description: "Report whether untrusted client input passed validation.",
    inputSchema: schema,
    outputSchema: z.object({ accepted: z.boolean(), kind: z.string() }),
    handler: (_input, context) => ({
      text: "Input inspected",
      data: {
        accepted: acceptedContent(context.inputResponses, "person", answerSchema) !== undefined,
        kind: inputResponse(context.inputResponses, "person").kind,
      },
    }),
  });
  const running = await serveEmseepea(createEmseepea({
    name: "input-required-boundary-test",
    version: "0.0.0",
    tools: [mapped, streaming, deprecatedRoots, deprecatedSampling, inspect],
  }), { port: 0 });
  const client = new Client(
    { name: "input-required-boundary-client", version: "0.0.0" },
    {
      capabilities: { elicitation: { form: {} }, sampling: {} },
      inputRequired: { maxRounds: 1 },
      versionNegotiation: { mode: { pin: "2026-07-28" } },
    },
  );
  let elicitationCalls = 0;
  let samplingCalls = 0;
  client.setRequestHandler("elicitation/create", async () => {
    elicitationCalls += 1;
    return { action: "accept", content: { answer: "Ada" } };
  });
  client.setRequestHandler("sampling/createMessage", async () => {
    samplingCalls += 1;
    return {
      role: "assistant",
      content: { type: "text", text: "Unexpected" },
      model: "test-model",
      stopReason: "endTurn",
    };
  });

  try {
    await client.connect(new StreamableHTTPClientTransport(running.url));
    for (const name of [
      "mapped-input-request",
      "streaming-input-request",
      "deprecated-roots-request",
      "deprecated-sampling-request",
    ]) {
      const result = await client.callTool({ name, arguments: {} });
      assert.equal(result.isError, true);
      assert.equal(result.content[0].text, "Tool execution failed");
    }
    const unexpected = await client.callTool({
      name: "inspect-untrusted-response",
      arguments: {},
      inputResponses: { person: { roots: [] } },
    });
    assert.deepEqual(unexpected.structuredContent, { accepted: false, kind: "missing" });
    const malformed = await client.callTool({
      name: "inspect-untrusted-response",
      arguments: {},
      inputResponses: { person: { action: "accept", content: { answer: 42 } } },
    });
    assert.deepEqual(malformed.structuredContent, { accepted: false, kind: "elicit" });
    assert.equal(elicitationCalls, 0);
    assert.equal(samplingCalls, 0);
  } finally {
    await client.close();
    await running.close();
  }
});

async function withElicitationClient(url, response, run, options = {}) {
  const client = new Client(
    { name: "input-required-safety-client", version: "0.0.0" },
    {
      capabilities: options.capabilities === false ? {} : { elicitation: { form: {} } },
      inputRequired: { maxRounds: options.maxRounds ?? 2 },
      versionNegotiation: { mode: { pin: "2026-07-28" } },
    },
  );
  if (options.capabilities !== false) {
    client.setRequestHandler("elicitation/create", async () => response);
  }
  const transportOptions = {
    requestInit: { headers: { authorization: "Bearer valid" } },
  };
  if (options.dropRetryAuth) {
    transportOptions.fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      const message = JSON.parse(String(init?.body));
      if (message.params?.inputResponses) headers.delete("authorization");
      return fetch(input, { ...init, headers });
    };
  }
  await client.connect(new StreamableHTTPClientTransport(url, transportOptions));
  try {
    return await run(client);
  } finally {
    await client.close();
  }
}

function assertFreshRoundIds(requestIds, method, expectedCount) {
  const ids = requestIds.get(method) ?? [];
  assert.equal(ids.length, expectedCount);
  assert.equal(new Set(ids).size, expectedCount);
}

async function rawToolCall(url, name, requestState, token) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "tools/call",
      "Mcp-Name": name,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name,
        arguments: {},
        ...(requestState ? { requestState } : {}),
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "raw-state-client", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  return { response, body: await response.json() };
}


async function rawResourceRead(url, uri, requestState) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "resources/read",
      "Mcp-Name": uri,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "resources/read",
      params: {
        uri,
        requestState,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "raw-state-client", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  return { response, body: await response.json() };
}
