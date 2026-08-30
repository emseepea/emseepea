import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
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
  "io.modelcontextprotocol/clientInfo": { name: "pagination-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};
const listMethods = [
  ["tools/list", "tools"],
  ["resources/list", "resources"],
  ["resources/templates/list", "resourceTemplates"],
  ["prompts/list", "prompts"],
];

test("list pagination rejects invalid startup bounds", () => {
  const definitions = catalogueDefinitions(1);
  for (const pageSize of [0, 1.5, 101]) {
    assert.throws(() => paginatedApp(definitions, { pageSize }), /listPagination\.pageSize/);
  }
  assert.throws(
    () => paginatedApp(definitions, { pageSize: 1, maxPageBytes: 0 }),
    /listPagination\.maxPageBytes/,
  );
  assert.throws(
    () => paginatedApp(definitions, { pageSize: 1, maxPageBytes: 1 }),
    /entry larger than listPagination\.maxPageBytes/,
  );
});

test("all active catalogues paginate with bounded immutable cursors", async () => {
  const definitions = catalogueDefinitions(5);
  const first = await serveEmseepea(paginatedApp(definitions), { port: 0 });
  const second = await serveEmseepea(paginatedApp(definitions), { port: 0 });
  const changed = await serveEmseepea(paginatedApp(catalogueDefinitions(6)), { port: 0 });
  const changedPageSize = await serveEmseepea(paginatedApp(definitions, {
    pageSize: 3,
    maxPageBytes: 16 * 1024,
  }), { port: 0 });
  const changedByteLimit = await serveEmseepea(paginatedApp(definitions, {
    pageSize: 2,
    maxPageBytes: 32 * 1024,
  }), { port: 0 });
  const unpaginated = await serveEmseepea(unpaginatedApp(definitions), { port: 0 });

  try {
    const cursors = new Map();
    for (const [method, field] of listMethods) {
      const expected = expectedNames(field, 5);
      const actualEntries = [];
      let cursor;
      for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
        const result = await rpc(first.url, method, cursor ? { cursor } : {});
        assert.equal(result.response.status, 200, method);
        assert.equal(result.body.result.resultType, "complete", method);
        assert.equal(result.body.result.ttlMs, 0, method);
        assert.equal(result.body.result.cacheScope, "private", method);
        assert.ok(result.body.result[field].length <= 2, method);
        assert.ok(pageBytes(field, result.body.result) <= 16 * 1024, method);
        actualEntries.push(...result.body.result[field]);
        cursor = result.body.result.nextCursor;
        if (pageIndex < 2) assert.match(cursor, /^[A-Za-z0-9_-]{43}$/, method);
        else assert.equal(cursor, undefined, method);
        if (pageIndex === 0) cursors.set(method, result.body.result.nextCursor);
      }
      const actualNames = actualEntries.map(({ name }) => name);
      assert.deepEqual(actualNames, expected, method);
      assert.equal(new Set(actualNames).size, actualNames.length, method);
      const wholeCatalogue = await rpc(unpaginated.url, method);
      assert.deepEqual(actualEntries, wholeCatalogue.body.result[field], method);
    }

    const toolCursor = cursors.get("tools/list");
    const replay = await rpc(second.url, "tools/list", { cursor: toolCursor });
    assert.deepEqual(replay.body.result.tools.map(({ name }) => name), ["tool-2", "tool-3"]);

    for (const cursor of [
      "",
      "not-a-cursor",
      "x".repeat(200),
      `${toolCursor.slice(0, -1)}${toolCursor.endsWith("A") ? "B" : "A"}`,
    ]) {
      assertInvalidCursor(await rpc(first.url, "tools/list", { cursor }));
    }
    assertInvalidCursor(await rpc(first.url, "prompts/list", { cursor: toolCursor }));
    assertInvalidCursor(await rpc(changed.url, "tools/list", { cursor: toolCursor }));
    assertInvalidCursor(await rpc(changedPageSize.url, "tools/list", { cursor: toolCursor }));
    assertInvalidCursor(await rpc(changedByteLimit.url, "tools/list", { cursor: toolCursor }));
    assert.equal(definitions.handlerCalls(), 0);

    const client = new Client(
      { name: "pagination-client", version: "0.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await client.connect(new StreamableHTTPClientTransport(first.url));
    try {
      assert.deepEqual((await client.listTools()).tools.map(({ name }) => name), expectedNames("tools", 5));
      assert.deepEqual((await client.listResources()).resources.map(({ name }) => name), expectedNames("resources", 5));
      assert.deepEqual(
        (await client.listResourceTemplates()).resourceTemplates.map(({ name }) => name),
        expectedNames("resourceTemplates", 5),
      );
      assert.deepEqual((await client.listPrompts()).prompts.map(({ name }) => name), expectedNames("prompts", 5));
      assert.deepEqual(
        (await client.listTools({ cursor: toolCursor })).tools.map(({ name }) => name),
        ["tool-2", "tool-3"],
      );
      assert.deepEqual(
        (await client.listResources({ cursor: cursors.get("resources/list") })).resources.map(({ name }) => name),
        ["resource-2", "resource-3"],
      );
      assert.deepEqual(
        (await client.listResourceTemplates({
          cursor: cursors.get("resources/templates/list"),
        })).resourceTemplates.map(({ name }) => name),
        ["template-2", "template-3"],
      );
      assert.deepEqual(
        (await client.listPrompts({ cursor: cursors.get("prompts/list") })).prompts.map(({ name }) => name),
        ["prompt-2", "prompt-3"],
      );
    } finally {
      await client.close();
    }
  } finally {
    await Promise.all([
      first.close(),
      second.close(),
      changed.close(),
      changedPageSize.close(),
      changedByteLimit.close(),
      unpaginated.close(),
    ]);
  }
});

test("the byte limit can end a page before the item limit", async () => {
  const definitions = catalogueDefinitions(2);
  const unpaginated = await serveEmseepea(createEmseepea({
    name: "pagination-byte-baseline",
    version: "0.0.0",
    tools: definitions.tools,
  }), { port: 0 });
  let paginated;
  try {
    const wholeCatalogue = (await rpc(unpaginated.url, "tools/list")).body.result.tools;
    const maxPageBytes = Math.max(
      pageBytes("tools", { tools: [wholeCatalogue[0]], nextCursor: "x".repeat(43) }),
      pageBytes("tools", { tools: [wholeCatalogue[1]] }),
    );
    assert.ok(pageBytes("tools", { tools: wholeCatalogue }) > maxPageBytes);
    paginated = await serveEmseepea(createEmseepea({
      name: "pagination-byte-limit",
      version: "0.0.0",
      tools: definitions.tools,
      listPagination: { pageSize: 2, maxPageBytes },
    }), { port: 0 });

    const first = await rpc(paginated.url, "tools/list");
    assert.deepEqual(first.body.result.tools.map(({ name }) => name), ["tool-0"]);
    assert.ok(pageBytes("tools", first.body.result) <= maxPageBytes);
    const second = await rpc(paginated.url, "tools/list", {
      cursor: first.body.result.nextCursor,
    });
    assert.deepEqual(second.body.result.tools.map(({ name }) => name), ["tool-1"]);
    assert.ok(pageBytes("tools", second.body.result) <= maxPageBytes);
    assert.equal(second.body.result.nextCursor, undefined);
  } finally {
    await Promise.all([unpaginated.close(), paginated?.close()]);
  }
});

test("pagination remains opt-in", async () => {
  const definitions = catalogueDefinitions(5);
  const running = await serveEmseepea(createEmseepea({
    name: "unpaginated-test",
    version: "0.0.0",
    tools: definitions.tools,
  }), { port: 0 });
  try {
    const result = await rpc(running.url, "tools/list");
    assert.equal(result.body.result.tools.length, 5);
    assert.equal(result.body.result.nextCursor, undefined);
    const missing = await rpc(running.url, "resources/list");
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.error.code, -32601);
  } finally {
    await running.close();
  }
});

function catalogueDefinitions(count) {
  let calls = 0;
  const indexes = Array.from({ length: count }, (_, index) => index);
  return {
    tools: indexes.map((index) => defineTool({
      name: `tool-${index}`,
      title: `Tool ${index}`,
      access: "public",
      description: `Tool ${index}`,
      inputSchema: z.object({ query: z.string().optional().describe("Optional query") }),
      outputSchema: z.object({ index: z.number().describe("Catalogue index") }),
      handler: () => { calls += 1; return { text: String(index), data: { index } }; },
    })),
    resources: indexes.map((index) => {
      const uri = `page://resources/item-${index}`;
      return defineResource({
        name: `resource-${index}`,
        uri,
        title: `Resource ${index}`,
        description: `Resource description ${index}`,
        mimeType: "text/plain",
        handler: () => { calls += 1; return { contents: [{ uri, text: String(index) }] }; },
      });
    }),
    resourceTemplates: indexes.map((index) => defineResourceTemplate({
      name: `template-${index}`,
      uriTemplate: `page://template-${index}/{item}`,
      title: `Template ${index}`,
      description: `Template description ${index}`,
      mimeType: "application/json",
      handler: ({ uri }) => { calls += 1; return { contents: [{ uri, text: String(index) }] }; },
    })),
    prompts: indexes.map((index) => definePrompt({
      name: `prompt-${index}`,
      title: `Prompt ${index}`,
      description: `Prompt description ${index}`,
      argsSchema: z.object({ topic: z.string().describe("Topic") }),
      handler: ({ topic }) => {
        calls += 1;
        return { messages: [{ role: "user", content: { type: "text", text: topic } }] };
      },
    })),
    handlerCalls: () => calls,
  };
}

function unpaginatedApp(definitions) {
  return createEmseepea({
    name: "pagination-baseline",
    version: "0.0.0",
    tools: definitions.tools,
    resources: [...definitions.resources, ...definitions.resourceTemplates],
    prompts: definitions.prompts,
  });
}

function paginatedApp(definitions, listPagination = { pageSize: 2, maxPageBytes: 16 * 1024 }) {
  return createEmseepea({
    name: "pagination-test",
    version: "0.0.0",
    tools: definitions.tools,
    resources: [...definitions.resources, ...definitions.resourceTemplates],
    prompts: definitions.prompts,
    listPagination,
  });
}

function expectedNames(field, count) {
  const prefix = {
    tools: "tool",
    resources: "resource",
    resourceTemplates: "template",
    prompts: "prompt",
  }[field];
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

function pageBytes(field, result) {
  return Buffer.byteLength(JSON.stringify({
    [field]: result[field],
    ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
  }), "utf8");
}

function assertInvalidCursor(result) {
  assert.equal(result.response.status, 200);
  assert.equal(result.body.error.code, -32602);
  assert.equal(result.body.error.message, "Invalid pagination cursor");
}

async function rpc(url, method, params = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
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
