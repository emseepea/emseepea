import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import {
  createEmseepea,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  defineTool,
  inputRequired,
  serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";

const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "cache-hint-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": { elicitation: { form: {} } },
};

test("cache instructions reach every cacheable result through raw HTTP and the client", async () => {
  const calls = { tool: 0, prompt: 0 };
  const staticHint = { ttlMs: 70 };
  const templateHint = { cacheScope: "public" };
  const cacheHints = {
    "server/discover": { ttlMs: 10, cacheScope: "private" },
    "tools/list": { ttlMs: 20, cacheScope: "public" },
    "resources/list": { ttlMs: 30, cacheScope: "private" },
    "resources/templates/list": { ttlMs: 40, cacheScope: "public" },
    "prompts/list": { ttlMs: 50, cacheScope: "private" },
    "resources/read": { ttlMs: 60, cacheScope: "private" },
  };
  const definitions = completeDefinitions(calls, staticHint, templateHint);
  const app = createEmseepea({
    name: "cache-hints",
    version: "0.0.0",
    ...definitions,
    cacheHints,
  });
  cacheHints["server/discover"].ttlMs = 999;
  staticHint.ttlMs = 999;
  templateHint.cacheScope = "private";
  const running = await serveEmseepea(app, { port: 0 });

  try {
    const expected = new Map([
      ["server/discover", [10, "private"]],
      ["tools/list", [20, "public"]],
      ["resources/list", [30, "private"]],
      ["resources/templates/list", [40, "public"]],
      ["prompts/list", [50, "private"]],
      ["resources/read", [70, "private"]],
    ]);
    for (const [method, [ttlMs, cacheScope]] of expected) {
      const params = method === "resources/read" ? { uri: "cache://beans/report" } : {};
      assertHint((await rpc(running.url, method, params)).body.result, ttlMs, cacheScope);
    }
    assertHint(
      (await rpc(running.url, "resources/read", { uri: "cache://origins/kenya" })).body.result,
      60,
      "public",
    );

    const toolResult = (await rpc(running.url, "tools/call", {
      name: "bean-count",
      arguments: {},
    })).body.result;
    assert.equal(toolResult.ttlMs, undefined);
    assert.equal(toolResult.cacheScope, undefined);
    const promptResult = (await rpc(running.url, "prompts/get", {
      name: "bean-report",
      arguments: {},
    })).body.result;
    assert.equal(promptResult.ttlMs, undefined);
    assert.equal(promptResult.cacheScope, undefined);
    assert.deepEqual(calls, { tool: 1, prompt: 1 });

    const resources = (await rpc(running.url, "resources/list")).body.result.resources;
    const templates = (await rpc(running.url, "resources/templates/list")).body.result.resourceTemplates;
    assert.equal(resources[0].cacheHint, undefined);
    assert.equal(templates[0].cacheHint, undefined);

    const client = new Client(
      { name: "cache-hint-client", version: "0.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await client.connect(new StreamableHTTPClientTransport(running.url));
    try {
      assertHint(await client.discover(), 10, "private");
      assertHint(await client.listTools(), 20, "public");
      assertHint(await client.listResources(), 30, "private");
      assertHint(await client.listResourceTemplates(), 40, "public");
      assertHint(await client.listPrompts(), 50, "private");
      assertHint(await client.readResource({ uri: "cache://beans/report" }), 70, "private");
      assertHint(await client.readResource({ uri: "cache://origins/kenya" }), 60, "public");
    } finally {
      await client.close();
    }
  } finally {
    await running.close();
  }
});

test("configured list hints survive bounded pagination", async () => {
  const definitions = completeDefinitions({ tool: 0, prompt: 0 }, {}, {});
  const running = await serveEmseepea(createEmseepea({
    name: "paginated-cache-hints",
    version: "0.0.0",
    ...definitions,
    tools: [definitions.tools[0], defineTool({
      name: "second-tool",
      access: "public",
      description: "Return a second count.",
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      handler: () => ({ text: "One bean", data: { count: 1 } }),
    })],
    listPagination: { pageSize: 1 },
    cacheHints: { "tools/list": { ttlMs: 120, cacheScope: "public" } },
  }), { port: 0 });
  try {
    const first = (await rpc(running.url, "tools/list")).body.result;
    assertHint(first, 120, "public");
    assert.ok(first.nextCursor);
    assertHint((await rpc(running.url, "tools/list", { cursor: first.nextCursor })).body.result, 120, "public");
  } finally {
    await running.close();
  }
});

test("bad or unenforceable cache instructions fail before serving", () => {
  const definitions = completeDefinitions({ tool: 0, prompt: 0 }, {}, {});
  const create = (cacheHints) => createEmseepea({
    name: "invalid-cache-hints",
    version: "0.0.0",
    ...definitions,
    cacheHints,
  });
  for (const cacheHints of [null, [], { "tools/call": {} }, { unknown: {} }]) {
    assert.throws(() => create(cacheHints), /cacheHints/);
  }
  for (const hint of [null, [], { ttlMs: -1 }, { ttlMs: 1.5 }, { ttlMs: Number.MAX_VALUE },
    { cacheScope: "shared" }, { ttlMs: 1, extra: true }]) {
    assert.throws(() => create({ "tools/list": hint }), /cacheHint/);
  }
  assert.throws(
    () => createEmseepea({
      name: "disabled-cache-hint",
      version: "0.0.0",
      cacheHints: { "resources/read": { ttlMs: 1 } },
    }),
    /disabled method/,
  );
  assert.doesNotThrow(() => createEmseepea({
    name: "omitted-cache-hint",
    version: "0.0.0",
    cacheHints: { "tools/list": undefined },
  }));
  assert.throws(
    () => defineResource({
      name: "bad-resource-cache",
      uri: "cache://bad/resource",
      cacheHint: { ttlMs: -1 },
      handler: () => ({ contents: [{ uri: "cache://bad/resource", text: "bad" }] }),
    }),
    /cacheHint/,
  );
  assert.throws(
    () => defineResourceTemplate({
      name: "bad-template-cache",
      uriTemplate: "cache://bad/{name}",
      cacheHint: { extra: true },
      handler: ({ uri }) => ({ contents: [{ uri, text: "bad" }] }),
    }),
    /cacheHint/,
  );
});

test("defaults remain private and input requests are never cacheable", async () => {
  const uri = "cache://input/report";
  const running = await serveEmseepea(createEmseepea({
    name: "cache-defaults",
    version: "0.0.0",
    resources: [defineResource({
      name: "input-report",
      uri,
      cacheHint: { ttlMs: 500, cacheScope: "public" },
      handler: () => inputRequired({
        inputRequests: {
          question: inputRequired.elicit({
            message: "Choose the report period.",
            schema: z.object({ period: z.string() }),
          }),
        },
      }),
    })],
  }), { port: 0 });
  try {
    assertHint((await rpc(running.url, "server/discover")).body.result, 0, "private");
    assertHint((await rpc(running.url, "resources/list")).body.result, 0, "private");
    const result = (await rpc(running.url, "resources/read", { uri })).body.result;
    assert.equal(result.resultType, "input_required");
    assert.equal(result.ttlMs, undefined);
    assert.equal(result.cacheScope, undefined);
  } finally {
    await running.close();
  }
});

function completeDefinitions(calls, staticHint, templateHint) {
  return {
    tools: [defineTool({
      name: "bean-count",
      access: "public",
      description: "Count the beans in the report.",
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      handler: () => {
        calls.tool += 1;
        return { text: "Three beans", data: { count: 3 } };
      },
    })],
    resources: [
      defineResource({
        name: "bean-report",
        uri: "cache://beans/report",
        cacheHint: staticHint,
        handler: () => ({ contents: [{ uri: "cache://beans/report", text: "Three beans" }] }),
      }),
      defineResourceTemplate({
        name: "bean-detail",
        uriTemplate: "cache://origins/{origin}",
        cacheHint: templateHint,
        handler: ({ uri }) => ({ contents: [{ uri, text: "Bean detail" }] }),
      }),
    ],
    prompts: [definePrompt({
      name: "bean-report",
      argsSchema: z.object({}),
      handler: () => {
        calls.prompt += 1;
        return { messages: [{ role: "user", content: { type: "text", text: "Summarise the beans." } }] };
      },
    })],
  };
}

function assertHint(result, ttlMs, cacheScope) {
  assert.equal(result.ttlMs, ttlMs);
  assert.equal(result.cacheScope, cacheScope);
}

async function rpc(url, method, params = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(method === "tools/call" || method === "prompts/get"
        ? { "Mcp-Name": params.name }
        : method === "resources/read"
          ? { "Mcp-Name": params.uri }
          : {}),
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
