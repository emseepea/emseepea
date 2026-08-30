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
  "io.modelcontextprotocol/clientInfo": { name: "metadata-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("advertised MCP metadata is complete, checked, and copied", async () => {
  const toolIcons = [{ src: "https://example.test/tool.png", mimeType: "image/png", sizes: ["32x32"], theme: "light" }];
  const toolAnnotations = { title: "Bean details", readOnlyHint: true, openWorldHint: false };
  const resourceAnnotations = { audience: ["assistant"], priority: 0.8 };
  const serverIcons = [{ src: "https://example.test/server.png", mimeType: "image/png" }];

  const tool = defineTool({
    name: "get-bean",
    title: "Get bean details",
    access: "public",
    description: "Get the recorded details for one coffee bean.",
    icons: toolIcons,
    annotations: toolAnnotations,
    _meta: { "com.example/catalogue": "coffee", "io.emseepea/access": "must-not-win" },
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ origin: z.string() }),
    handler: ({ name }) => ({ text: `${name} is from Burundi.`, data: { origin: "Burundi" } }),
  });
  const resource = defineResource({
    name: "bean-report",
    uri: "report://coffee/beans",
    title: "Bean report",
    description: "The current bean report.",
    mimeType: "application/json",
    icons: [{ src: "https://example.test/report.png" }],
    annotations: resourceAnnotations,
    size: 128,
    _meta: { "com.example/report": "current" },
    handler: () => ({ contents: [{ uri: "report://coffee/beans", text: "Three beans" }] }),
  });
  const template = defineResourceTemplate({
    name: "origin-report",
    uriTemplate: "report://coffee/origins/{origin}",
    title: "Origin report",
    icons: [{ src: "https://example.test/origin.png", theme: "dark" }],
    annotations: { audience: ["user"] },
    _meta: { "com.example/report": "origin" },
    handler: ({ uri }) => ({ contents: [{ uri, text: "Origin report" }] }),
  });
  const prompt = definePrompt({
    name: "brew-guide",
    title: "Brew guide",
    description: "Create a brew guide.",
    icons: [{ src: "https://example.test/prompt.png" }],
    _meta: { "com.example/prompt": "brew" },
    argsSchema: z.object({
      method: z.string().describe("The method to use."),
    }),
    handler: ({ method }) => ({
      messages: [{ role: "user", content: { type: "text", text: `Brew with ${method}.` } }],
    }),
  });
  const app = createEmseepea({
    name: "metadata-server",
    version: "0.0.0",
    title: "Coffee metadata server",
    description: "Shows complete MCP metadata.",
    icons: serverIcons,
    websiteUrl: "https://example.test/coffee",
    tools: [tool],
    resources: [resource, template],
    prompts: [prompt],
  });

  toolIcons[0].src = "https://changed.invalid/tool.png";
  toolAnnotations.readOnlyHint = false;
  resourceAnnotations.priority = 0;
  serverIcons[0].src = "https://changed.invalid/server.png";

  const running = await serveEmseepea(app, { port: 0 });
  try {
    const discover = (await rpc(running.url, "server/discover")).body.result;
    assert.deepEqual(discover._meta["io.modelcontextprotocol/serverInfo"], {
      name: "metadata-server",
      version: "0.0.0",
      title: "Coffee metadata server",
      description: "Shows complete MCP metadata.",
      icons: [{ src: "https://example.test/server.png", mimeType: "image/png" }],
      websiteUrl: "https://example.test/coffee",
    });

    const listedTool = (await rpc(running.url, "tools/list")).body.result.tools[0];
    assert.deepEqual(listedTool.icons, [{
      src: "https://example.test/tool.png",
      mimeType: "image/png",
      sizes: ["32x32"],
      theme: "light",
    }]);
    assert.deepEqual(listedTool.annotations, {
      title: "Bean details",
      readOnlyHint: true,
      openWorldHint: false,
    });
    assert.equal(listedTool._meta["com.example/catalogue"], "coffee");
    assert.deepEqual(listedTool._meta["io.emseepea/access"], { type: "public" });

    const listedResource = (await rpc(running.url, "resources/list")).body.result.resources[0];
    assert.equal(listedResource.size, 128);
    assert.deepEqual(listedResource.annotations, { audience: ["assistant"], priority: 0.8 });
    assert.deepEqual(listedResource.icons, [{ src: "https://example.test/report.png" }]);
    assert.equal(listedResource._meta["com.example/report"], "current");

    const listedTemplate = (await rpc(running.url, "resources/templates/list")).body.result.resourceTemplates[0];
    assert.deepEqual(listedTemplate.icons, [{ src: "https://example.test/origin.png", theme: "dark" }]);
    assert.deepEqual(listedTemplate.annotations, { audience: ["user"] });
    assert.equal(listedTemplate._meta["com.example/report"], "origin");

    const listedPrompt = (await rpc(running.url, "prompts/list")).body.result.prompts[0];
    assert.deepEqual(listedPrompt.icons, [{ src: "https://example.test/prompt.png" }]);
    assert.equal(listedPrompt._meta["com.example/prompt"], "brew");
    assert.equal(listedPrompt.arguments[0].description, "The method to use.");
  } finally {
    await running.close();
  }
});

test("invalid MCP metadata fails during definition or server creation", () => {
  const arrayWithExtraData = [];
  arrayWithExtraData.note = "would be lost during JSON encoding";

  assert.throws(() => defineTool({
    name: "bad-icon",
    access: "public",
    description: "Invalid icon metadata.",
    icons: [{ src: "https://example.test/icon.png", theme: "blue" }],
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    handler: () => ({ text: "no", data: {} }),
  }), /Tool metadata does not match/);
  assert.throws(() => defineResource({
    name: "bad-annotations",
    uri: "report://coffee/bad-annotations",
    annotations: { audience: ["server"] },
    handler: () => ({ contents: [] }),
  }), /Resource metadata does not match/);
  assert.throws(() => defineResourceTemplate({
    name: "bad-priority",
    uriTemplate: "report://coffee/{origin}",
    annotations: { priority: 2 },
    handler: () => ({ contents: [] }),
  }), /ResourceTemplate metadata does not match/);
  assert.throws(() => definePrompt({
    name: "bad-meta",
    _meta: { "com.example/value": 1n },
    argsSchema: z.object({}),
    handler: () => ({ messages: [] }),
  }), /Prompt metadata must be JSON data/);
  assert.throws(() => definePrompt({
    name: "lossy-meta",
    _meta: { "com.example/value": Number.NaN },
    argsSchema: z.object({}),
    handler: () => ({ messages: [] }),
  }), /Prompt metadata must be JSON data/);
  assert.throws(() => definePrompt({
    name: "lossy-array-meta",
    _meta: { "com.example/value": arrayWithExtraData },
    argsSchema: z.object({}),
    handler: () => ({ messages: [] }),
  }), /Prompt metadata must be JSON data/);
  assert.throws(() => createEmseepea({
    name: "bad-server-icon",
    version: "0.0.0",
    icons: [{ src: "https://example.test/icon.png", theme: "blue" }],
  }), /Implementation metadata does not match/);
});

async function rpc(url, method, params = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(method === "prompts/get" || method === "tools/call"
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
