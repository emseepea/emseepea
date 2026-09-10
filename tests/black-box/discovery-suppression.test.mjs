import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmseepea,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  defineTool,
  serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";

const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "discovery-suppression-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("lifecycle-hidden capabilities stay callable but leave every discovery list", async () => {
  const definitions = capabilities();
  const unpaginated = await serveEmseepea(app(definitions), { port: 0 });
  const paginated = await serveEmseepea(app(definitions, { pageSize: 1 }), { port: 0 });

  try {
    for (const running of [unpaginated, paginated]) {
      const discover = await rpc(running.url, "server/discover");
      assert.deepEqual(discover.body.result.capabilities.tools, { listChanged: false });
      assert.deepEqual(discover.body.result.capabilities.resources, {
        subscribe: false,
        listChanged: false,
      });
      assert.deepEqual(discover.body.result.capabilities.prompts, { listChanged: false });
      assert.deepEqual(discover.body.result.capabilities.completions, {});

      assert.deepEqual(await listedNames(running.url, "tools/list", "tools"), ["visible-tool"]);
      assert.deepEqual(await listedNames(running.url, "resources/list", "resources"), ["visible-resource"]);
      assert.deepEqual(
        await listedNames(running.url, "resources/templates/list", "resourceTemplates"),
        ["visible-template"],
      );
      assert.deepEqual(await listedNames(running.url, "prompts/list", "prompts"), ["visible-prompt"]);
    }

    assert.equal((await rpc(unpaginated.url, "tools/call", {
      name: "retiring-tool",
      arguments: {},
    })).body.result.structuredContent.state, "callable");
    assert.equal((await rpc(unpaginated.url, "resources/read", {
      uri: "retiring://static",
    })).body.result.contents[0].text, "callable");
    assert.equal((await rpc(unpaginated.url, "resources/read", {
      uri: "retiring://templates/known",
    })).body.result.contents[0].text, "known");
    assert.equal((await rpc(unpaginated.url, "prompts/get", {
      name: "retiring-prompt",
      arguments: { topic: "known" },
    })).body.result.messages[0].content.text, "known");
    assert.deepEqual((await rpc(unpaginated.url, "completion/complete", {
      ref: { type: "ref/prompt", name: "retiring-prompt" },
      argument: { name: "topic", value: "k" },
    })).body.result.completion.values, ["known"]);
    assert.deepEqual((await rpc(unpaginated.url, "completion/complete", {
      ref: { type: "ref/resource", uri: "retiring://templates/{topic}" },
      argument: { name: "topic", value: "k" },
    })).body.result.completion.values, ["known"]);
  } finally {
    await Promise.all([unpaginated.close(), paginated.close()]);
  }
});

test("omitted and explicit true discovery flags produce the same public catalogue", async () => {
  const implicit = await serveEmseepea(app(capabilities()), { port: 0 });
  const explicit = await serveEmseepea(app(capabilities(true)), { port: 0 });

  try {
    for (const method of [
      "server/discover",
      "tools/list",
      "resources/list",
      "resources/templates/list",
      "prompts/list",
    ]) {
      assert.deepEqual((await rpc(explicit.url, method)).body.result, (await rpc(implicit.url, method)).body.result);
    }
  } finally {
    await Promise.all([implicit.close(), explicit.close()]);
  }
});

test("removing lifecycle-hidden capabilities makes every known direct operation unavailable", async () => {
  const running = await serveEmseepea(app(capabilities(undefined, false)), { port: 0 });

  try {
    for (const [method, params] of [
      ["tools/call", { name: "retiring-tool", arguments: {} }],
      ["resources/read", { uri: "retiring://static" }],
      ["resources/read", { uri: "retiring://templates/known" }],
      ["prompts/get", { name: "retiring-prompt", arguments: { topic: "known" } }],
      ["completion/complete", {
        ref: { type: "ref/prompt", name: "retiring-prompt" },
        argument: { name: "topic", value: "k" },
      }],
      ["completion/complete", {
        ref: { type: "ref/resource", uri: "retiring://templates/{topic}" },
        argument: { name: "topic", value: "k" },
      }],
    ]) {
      assertUnavailable(await rpc(running.url, method, params));
    }
  } finally {
    await running.close();
  }
});

test("authorization fails before hidden prompt handlers and completions", async () => {
  let handlerCalls = 0;
  let completionCalls = 0;
  const resourceServerUrl = new URL("https://api.example/mcp");
  const prompt = definePrompt({
    name: "retiring-prompt",
    access: "protected",
    requiredScopes: ["guides:read"],
    discoverable: false,
    argsSchema: z.object({ topic: z.string() }),
    complete: { topic: () => { completionCalls += 1; return ["known"]; } },
    handler: () => { handlerCalls += 1; return { messages: [] }; },
  });
  const running = await serveEmseepea(createEmseepea({
    name: "protected-discovery-suppression",
    version: "0.0.0",
    prompts: [prompt],
    authentication: {
      discovery: "protected",
      verifier: {
        async verifyAccessToken(token) {
          return {
            token,
            clientId: "restricted-client",
            scopes: ["other:read"],
            expiresAt: Math.floor(Date.now() / 1_000) + 60,
            resource: resourceServerUrl,
          };
        },
      },
      metadata: {
        resourceServerUrl,
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
    const get = await rpc(running.url, "prompts/get", {
      name: "retiring-prompt",
      arguments: { topic: "known" },
    }, "restricted");
    const complete = await rpc(running.url, "completion/complete", {
      ref: { type: "ref/prompt", name: "retiring-prompt" },
      argument: { name: "topic", value: "k" },
    }, "restricted");
    assert.deepEqual(get.body.error, { code: -32602, message: "Capability not found" });
    assert.deepEqual(complete.body.error, get.body.error);
    assert.equal(handlerCalls, 0);
    assert.equal(completionCalls, 0);
  } finally {
    await running.close();
  }
});

test("a hidden-only category remains advertised with an empty list", async () => {
  const hidden = defineTool({
    name: "retiring-tool",
    access: "public",
    discoverable: false,
    description: "A retiring tool.",
    inputSchema: z.object({}),
    outputSchema: z.object({ state: z.literal("callable") }),
    handler: () => ({ data: { state: "callable" } }),
  });
  const running = await serveEmseepea(createEmseepea({
    name: "hidden-only",
    version: "0.0.0",
    tools: [hidden],
  }), { port: 0 });

  try {
    assert.deepEqual((await rpc(running.url, "server/discover")).body.result.capabilities.tools, {
      listChanged: false,
    });
    assert.deepEqual((await rpc(running.url, "tools/list")).body.result.tools, []);
    assert.equal((await rpc(running.url, "tools/call", {
      name: "retiring-tool",
      arguments: {},
    })).body.result.isError, false);
  } finally {
    await running.close();
  }
});

test("discovery flags do not bypass validation", () => {
  assert.throws(() => defineTool({
    name: "invalid-discovery",
    access: "public",
    discoverable: "sometimes",
    description: "Invalid runtime input.",
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    handler: () => ({ data: {} }),
  }), /discoverable must be a boolean/);

  const hidden = defineTool({
    name: "duplicate-tool",
    access: "public",
    discoverable: false,
    description: "A hidden duplicate.",
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    handler: () => ({ data: {} }),
  });
  const visible = defineTool({
    name: "duplicate-tool",
    access: "public",
    description: "A visible duplicate.",
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    handler: () => ({ data: {} }),
  });
  assert.throws(
    () => createEmseepea({ name: "mixed-duplicates", version: "0.0.0", tools: [visible, hidden] }),
    /Duplicate tool name/,
  );
  assert.throws(
    () => createEmseepea({ name: "hidden-duplicates", version: "0.0.0", tools: [hidden, hidden] }),
    /Duplicate tool name/,
  );
});

function capabilities(visibleDiscoverable, includeRetiring = true) {
  const tool = (name, discoverable) => defineTool({
    name,
    access: "public",
    ...(discoverable === undefined ? {} : { discoverable }),
    description: "Return lifecycle state.",
    inputSchema: z.object({}),
    outputSchema: z.object({ state: z.literal("callable") }),
    handler: () => ({ data: { state: "callable" } }),
  });
  const resource = (name, uri, discoverable) => defineResource({
    name,
    uri,
    access: "public",
    ...(discoverable === undefined ? {} : { discoverable }),
    handler: () => ({ contents: [{ uri, text: "callable" }] }),
  });
  const template = (name, uriTemplate, discoverable) => defineResourceTemplate({
    name,
    uriTemplate,
    access: "public",
    ...(discoverable === undefined ? {} : { discoverable }),
    complete: { topic: () => ["known"] },
    handler: ({ uri, variables }) => ({ contents: [{ uri, text: variables.topic }] }),
  });
  const prompt = (name, discoverable) => definePrompt({
    name,
    access: "public",
    ...(discoverable === undefined ? {} : { discoverable }),
    argsSchema: z.object({ topic: z.string() }),
    complete: { topic: () => ["known"] },
    handler: ({ topic }) => ({
      messages: [{ role: "user", content: { type: "text", text: topic } }],
    }),
  });
  return {
    tools: [tool("visible-tool", visibleDiscoverable), ...(includeRetiring ? [tool("retiring-tool", false)] : [])],
    resources: [
      resource("visible-resource", "visible://static", visibleDiscoverable),
      ...(includeRetiring ? [resource("retiring-resource", "retiring://static", false)] : []),
      template("visible-template", "visible://templates/{topic}", visibleDiscoverable),
      ...(includeRetiring ? [template("retiring-template", "retiring://templates/{topic}", false)] : []),
    ],
    prompts: [prompt("visible-prompt", visibleDiscoverable), ...(includeRetiring ? [prompt("retiring-prompt", false)] : [])],
  };
}

function app(definitions, listPagination) {
  return createEmseepea({
    name: "discovery-suppression",
    version: "0.0.0",
    ...definitions,
    ...(listPagination ? { listPagination } : {}),
  });
}

async function listedNames(url, method, field) {
  const result = await rpc(url, method);
  assert.equal(result.body.result.nextCursor, undefined);
  return result.body.result[field].map(({ name }) => name);
}

function assertUnavailable(result) {
  assert.notEqual(result.body.result?.isError, false);
  assert.ok(result.body.error || result.body.result?.isError === true);
}

async function rpc(url, method, params = {}, token) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(["tools/call", "prompts/get"].includes(method) ? { "Mcp-Name": params.name } : {}),
      ...(method === "resources/read" ? { "Mcp-Name": params.uri } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: { ...params, _meta: requestMeta },
    }),
  });
  return { response, body: await response.json() };
}
