import {
  createEmseepea,
  defineElicitationView,
  defineMappedTool,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  defineStreamingTool,
  defineTool,
  renderElicitationForm,
  serveEmseepea,
} from "@emseepea/server";
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
  handler: ({ value }) => ({ text: value, data: { value } }),
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
  name: "smoke-resource",
  uri: resourceUri,
  handler: () => ({ contents: [{ uri: resourceUri, text: "value" }] }),
});
const resourceTemplate = defineResourceTemplate({
  name: "smoke-resource-template",
  uriTemplate: "smoke://resource/{value}",
  complete: { value: (partial) => ["checked"].filter((value) => value.startsWith(partial)) },
  handler: ({ uri }) => ({ contents: [{ uri, text: "value" }] }),
});
const prompt = definePrompt({
  name: "smoke-prompt",
  argsSchema: value,
  complete: { value: (partial) => ["checked"].filter((value) => value.startsWith(partial)) },
  handler: ({ value }) => ({
    messages: [{ role: "user", content: { type: "text", text: value } }],
  }),
});
const app = createEmseepea({
  name: "installed-package-smoke",
  version: "0.0.0",
  tools: [tool, mapped, streaming],
  resources: [resource, resourceTemplate],
  prompts: [prompt],
});
const running = await serveEmseepea(app, { port: 0 });
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
  const read = await request("resources/read", { uri: "smoke://resource/checked" });
  if (read.result.contents[0]?.uri !== "smoke://resource/checked") {
    throw new Error("installed package did not dispatch its resource template");
  }
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
  await running.close();
}
