import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
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
      return { text: `Hello, ${answer.answer}.`, data: { greeting: `Hello, ${answer.answer}.` } };
    },
  });
  const resource = defineResource({
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
    assert.equal(greeting.content[0].text, "Hello, Ada.");
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
    oauth: {
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
    tools: [mapped, streaming, deprecatedRoots, inspect],
  }), { port: 0 });
  const client = new Client(
    { name: "input-required-boundary-client", version: "0.0.0" },
    {
      capabilities: { elicitation: { form: {} } },
      inputRequired: { maxRounds: 1 },
      versionNegotiation: { mode: { pin: "2026-07-28" } },
    },
  );
  let elicitationCalls = 0;
  client.setRequestHandler("elicitation/create", async () => {
    elicitationCalls += 1;
    return { action: "accept", content: { answer: "Ada" } };
  });

  try {
    await client.connect(new StreamableHTTPClientTransport(running.url));
    for (const name of [
      "mapped-input-request",
      "streaming-input-request",
      "deprecated-roots-request",
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
