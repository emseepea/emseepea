import {
  createEmseepea,
  defineElicitationView,
  defineMappedTool,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  defineStreamingTool,
  defineTool,
  notifyResourceUpdated,
  renderElicitationForm,
  serveEmseepea,
} from "@emseepea/server";
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
  handler: ({ value }) => ({ text: value, data: { value } }),
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
  handler: () => ({ contents: [{ uri: resourceUri, text: "value" }] }),
});
const resourceTemplate = defineResourceTemplate({
  access: "public",
  name: "smoke-resource-template",
  uriTemplate: "smoke://resource/{value}",
  complete: { value: (partial) => ["checked"].filter((value) => value.startsWith(partial)) },
  handler: ({ uri }) => ({ contents: [{ uri, text: "value" }] }),
});
const prompt = definePrompt({
  access: "public",
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
  additionalTools: [feedback],
  resources: [resource, resourceTemplate],
  prompts: [prompt],
  resourceSubscriptions: { maxLifetimeMs: 5_000 },
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
