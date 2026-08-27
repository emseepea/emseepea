import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import {
  createEmseepea,
  defineMappedTool,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  defineTool,
  serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";

const uri = "guide://coffee/getting-started";
const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "resources-prompts-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("resource and prompt registrations fail invalid startup state", () => {
  assert.throws(() => defineResource({
    name: "guide",
    uri: "relative",
    handler: () => ({ contents: [] }),
  }), /absolute canonical URI/);
  assert.throws(() => defineResourceTemplate({
    name: "guide-template",
    uriTemplate: "relative/{topic}",
    handler: () => ({ contents: [] }),
  }), /fixed scheme and authority/);
  assert.throws(() => defineResourceTemplate({
    name: "guide-template",
    uriTemplate: "guide://coffee/static",
    handler: () => ({ contents: [] }),
  }), /fixed scheme and authority/);
  assert.throws(() => defineResourceTemplate({
    name: "guide-template",
    uriTemplate: "guide://coffee/{?topic}",
    handler: () => ({ contents: [] }),
  }), /fixed scheme and authority/);
  assert.throws(() => defineResourceTemplate({
    name: "guide-template",
    uriTemplate: "guide://coffee/prefix-{topic}",
    handler: () => ({ contents: [] }),
  }), /whole path-segment variables/);
  assert.throws(() => defineResourceTemplate({
    name: "guide-template",
    uriTemplate: "guide://coffee/{topic}/{topic}",
    handler: () => ({ contents: [] }),
  }), /unique whole path-segment variables/);
  assert.doesNotThrow(() => defineResourceTemplate({
    name: "sentinel-literal-template",
    uriTemplate: "guide://coffee/emseepea-variable-0/{topic}",
    handler: ({ uri: requestedUri }) => ({ contents: [{ uri: requestedUri, text: "guide" }] }),
  }));

  const resource = (name, resourceUri) => defineResource({
    name,
    uri: resourceUri,
    handler: () => ({ contents: [{ uri: resourceUri, text: "guide" }] }),
  });
  const prompt = definePrompt({
    name: "brew",
    argsSchema: z.object({}),
    handler: () => ({ messages: [] }),
  });

  assert.throws(() => createEmseepea({
    name: "duplicate-resource-name",
    version: "0.0.0",
    resources: [resource("guide", uri), resource("guide", "guide://coffee/other")],
  }), /Duplicate resource name/);
  assert.throws(() => createEmseepea({
    name: "duplicate-resource-uri",
    version: "0.0.0",
    resources: [resource("guide", uri), resource("other", uri)],
  }), /Duplicate resource URI/);
  const template = (name, uriTemplate) => defineResourceTemplate({
    name,
    uriTemplate,
    handler: ({ uri: requestedUri }) => ({ contents: [{ uri: requestedUri, text: "guide" }] }),
  });
  assert.throws(() => createEmseepea({
    name: "duplicate-resource-template-name",
    version: "0.0.0",
    resources: [resource("guide", uri), template("guide", "guide://coffee/{topic}")],
  }), /Duplicate resource name/);
  assert.throws(() => createEmseepea({
    name: "duplicate-resource-template",
    version: "0.0.0",
    resources: [
      template("guide", "guide://coffee/{topic}"),
      template("other", "guide://coffee/{topic}"),
    ],
  }), /Duplicate resource template/);
  assert.throws(() => createEmseepea({
    name: "ambiguous-resource-template",
    version: "0.0.0",
    resources: [
      template("guide", "guide://coffee/{topic}"),
      template("other", "guide://coffee/{method}"),
    ],
  }), /Ambiguous resource template/);
  assert.throws(() => createEmseepea({
    name: "overlapping-resource-template",
    version: "0.0.0",
    resources: [
      template("guide", "guide://coffee/{topic}/fixed"),
      template("other", "guide://coffee/special/{section}"),
    ],
  }), /Ambiguous resource template/);
  assert.throws(() => createEmseepea({
    name: "static-template-overlap",
    version: "0.0.0",
    resources: [resource("guide", uri), template("template", "guide://coffee/{topic}")],
  }), /Ambiguous resource registration/);
  assert.throws(() => createEmseepea({
    name: "duplicate-prompt",
    version: "0.0.0",
    prompts: [prompt, prompt],
  }), /Duplicate prompt name/);
  assert.throws(() => createEmseepea({
    name: "invalid-result-limit",
    version: "0.0.0",
    maxApplicationResultBytes: 0,
  }), /maxApplicationResultBytes must be a positive safe integer/);
});

test("resource and prompt definitions are captured before exposure", async () => {
  const resourceDefinition = {
    name: "captured-resource",
    uri,
    title: "Original resource",
    handler: () => ({ contents: [{ uri, text: "original resource" }] }),
  };
  const promptDefinition = {
    name: "captured-prompt",
    title: "Original prompt",
    argsSchema: z.object({ topic: z.string() }),
    handler: ({ topic }) => ({
      messages: [{ role: "user", content: { type: "text", text: `original ${topic}` } }],
    }),
  };
  const templateDefinition = {
    name: "captured-template",
    uriTemplate: "guide://coffee/topic/{topic}",
    title: "Original template",
    handler: ({ uri: requestedUri, variables }) => ({
      contents: [{ uri: requestedUri, text: `original ${variables.topic}` }],
    }),
  };
  const toolSchema = z.object({ value: z.string() });
  const toolDefinition = {
    name: "captured-tool",
    access: "public",
    title: "Original tool",
    description: "Original direct tool.",
    inputSchema: toolSchema,
    outputSchema: toolSchema,
    handler: ({ value }) => ({ text: `original ${value}`, data: { value } }),
  };
  const mappedDefinition = {
    name: "captured-mapped-tool",
    access: "public",
    title: "Original mapped tool",
    description: "Original mapped tool.",
    inputSchema: toolSchema,
    outputSchema: toolSchema,
    backendInputSchema: z.object({ key: z.string() }),
    backendOutputSchema: z.object({ record: z.string() }),
    mapInput: ({ value }) => ({ key: value }),
    adapter: ({ key }) => ({ record: key }),
    mapOutput: ({ record }) => ({ text: `original ${record}`, data: { value: record } }),
  };
  const app = createEmseepea({
    name: "captured-definitions",
    version: "0.0.0",
    tools: [defineTool(toolDefinition), defineMappedTool(mappedDefinition)],
    resources: [defineResource(resourceDefinition), defineResourceTemplate(templateDefinition)],
    prompts: [definePrompt(promptDefinition)],
  });
  resourceDefinition.name = "mutated-resource";
  resourceDefinition.title = "Mutated resource";
  resourceDefinition.handler = () => ({ contents: [{ uri, text: "mutated resource" }] });
  templateDefinition.name = "mutated-template";
  templateDefinition.uriTemplate = "guide://mutated/{topic}";
  templateDefinition.title = "Mutated template";
  templateDefinition.handler = ({ uri: requestedUri }) => ({
    contents: [{ uri: requestedUri, text: "mutated template" }],
  });
  promptDefinition.name = "mutated-prompt";
  promptDefinition.title = "Mutated prompt";
  promptDefinition.argsSchema = z.object({ changed: z.string() });
  promptDefinition.handler = () => ({ messages: [] });
  toolDefinition.name = "mutated-tool";
  toolDefinition.title = "Mutated tool";
  toolDefinition.inputSchema = z.object({ changed: z.string() });
  toolDefinition.outputSchema = z.object({ changed: z.string() });
  toolDefinition.handler = () => ({ text: "mutated", data: { changed: "mutated" } });
  mappedDefinition.name = "mutated-mapped-tool";
  mappedDefinition.title = "Mutated mapped tool";
  mappedDefinition.backendInputSchema = z.object({ changed: z.string() });
  mappedDefinition.backendOutputSchema = z.object({ changed: z.string() });
  mappedDefinition.mapInput = () => ({ changed: "mutated" });
  mappedDefinition.adapter = () => ({ changed: "mutated" });
  mappedDefinition.mapOutput = () => ({ text: "mutated", data: { value: "mutated" } });

  const running = await serveEmseepea(app, { port: 0 });
  try {
    const resources = await rpc(running.url, "resources/list");
    assert.equal(resources.body.result.resources[0].name, "captured-resource");
    assert.equal(resources.body.result.resources[0].title, "Original resource");
    const read = await rpc(running.url, "resources/read", { uri });
    assert.equal(read.body.result.contents[0].text, "original resource");
    const templates = await rpc(running.url, "resources/templates/list");
    assert.deepEqual(templates.body.result.resourceTemplates, [{
      name: "captured-template",
      uriTemplate: "guide://coffee/topic/{topic}",
      title: "Original template",
    }]);
    const templateRead = await rpc(running.url, "resources/read", {
      uri: "guide://coffee/topic/espresso",
    });
    assert.equal(templateRead.body.result.contents[0].text, "original espresso");

    const prompts = await rpc(running.url, "prompts/list");
    assert.equal(prompts.body.result.prompts[0].name, "captured-prompt");
    assert.equal(prompts.body.result.prompts[0].title, "Original prompt");
    const rendered = await rpc(running.url, "prompts/get", {
      name: "captured-prompt",
      arguments: { topic: "definition" },
    });
    assert.equal(rendered.body.result.messages[0].content.text, "original definition");

    const tools = await rpc(running.url, "tools/list");
    assert.deepEqual(tools.body.result.tools.map(({ name, title }) => ({ name, title })), [
      { name: "captured-tool", title: "Original tool" },
      { name: "captured-mapped-tool", title: "Original mapped tool" },
    ]);
    const direct = await rpc(running.url, "tools/call", {
      name: "captured-tool",
      arguments: { value: "direct" },
    });
    assert.equal(direct.body.result.content[0].text, "original direct");
    const mapped = await rpc(running.url, "tools/call", {
      name: "captured-mapped-tool",
      arguments: { value: "mapped" },
    });
    assert.equal(mapped.body.result.content[0].text, "original mapped");
  } finally {
    await running.close();
  }
});

test("disabled resource and prompt capabilities are absent and rejected", async () => {
  const running = await serveEmseepea(createEmseepea({ name: "empty", version: "0.0.0" }), {
    port: 0,
  });
  try {
    const discover = await rpc(running.url, "server/discover");
    assert.equal(discover.body.result.capabilities.resources, undefined);
    assert.equal(discover.body.result.capabilities.prompts, undefined);
    for (const method of [
      "resources/list",
      "resources/templates/list",
      "resources/read",
      "prompts/list",
      "prompts/get",
    ]) {
      const result = await rpc(running.url, method);
      assert.equal(result.response.status, 404);
      assert.equal(result.body.error.code, -32601);
    }
  } finally {
    await running.close();
  }
});

test("public resources and prompts stay checked and identity-free", async () => {
  let verifierCalls = 0;
  let resourceCalls = 0;
  let promptCalls = 0;
  let slowPromptCalls = 0;
  let resourceMode = "valid";
  let resourceCancelled = false;

  const guide = defineResource({
    name: "getting-started",
    uri,
    title: "Coffee getting started",
    description: "A synthetic coffee guide.",
    mimeType: "text/markdown",
    async handler({ signal, deadlineMs }) {
      resourceCalls += 1;
      assert.ok(deadlineMs > Date.now() - 1_000);
      if (resourceMode === "secret") throw new Error("resource-secret-sentinel");
      if (resourceMode === "slow") {
        try {
          await delay(200, undefined, { signal });
        } catch (error) {
          resourceCancelled = signal.aborted;
          throw error;
        }
      }
      if (resourceMode === "wrong-uri") {
        return { contents: [{ uri: "guide://private/secret", text: "must-not-leak" }] };
      }
      if (resourceMode === "oversized") {
        return { contents: [{ uri, text: "x".repeat(1_000) }] };
      }
      return { contents: [{ uri, mimeType: "text/markdown", text: "# Brew safely" }] };
    },
  });
  const brew = definePrompt({
    name: "brew-guide",
    title: "Brew guide",
    description: "Create a synthetic brewing prompt.",
    argsSchema: z.object({ topic: z.string().min(1) }),
    handler({ topic }, { deadlineMs }) {
      promptCalls += 1;
      assert.ok(deadlineMs > Date.now() - 1_000);
      if (topic === "secret") throw new Error("prompt-secret-sentinel");
      if (topic === "invalid-result") return { messages: [{ role: "invalid" }] };
      if (topic === "oversized") {
        return { messages: [{ role: "user", content: { type: "text", text: "x".repeat(1_000) } }] };
      }
      return {
        description: `Guide for ${topic}`,
        messages: [{ role: "user", content: { type: "text", text: `Explain ${topic}.` } }],
      };
    },
  });
  const slowPrompt = definePrompt({
    name: "slow-prompt-schema",
    description: "Exercise asynchronous prompt argument validation.",
    argsSchema: z.object({ topic: z.string() }).refine(async () => {
      await delay(200);
      return true;
    }),
    handler: () => {
      slowPromptCalls += 1;
      return { messages: [] };
    },
  });
  const app = createEmseepea({
    name: "resources-prompts",
    version: "0.0.0",
    resources: [guide],
    prompts: [brew, slowPrompt],
    operationTimeoutMs: 40,
    maxApplicationResultBytes: 512,
    oauth: {
      verifier: {
        async verifyAccessToken() {
          verifierCalls += 1;
          throw new Error("public operations must not verify bearer tokens");
        },
      },
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
  });
  const running = await serveEmseepea(app, { port: 0 });

  try {
    const discover = await rpc(running.url, "server/discover", {}, "irrelevant");
    assert.deepEqual(discover.body.result.capabilities.resources, {
      subscribe: false,
      listChanged: false,
    });
    assert.deepEqual(discover.body.result.capabilities.prompts, { listChanged: false });

    const templates = await rpc(running.url, "resources/templates/list", {}, "irrelevant");
    assert.equal(templates.response.status, 404);
    assert.equal(templates.body.error.code, -32601);

    const resources = await rpc(running.url, "resources/list", {}, "irrelevant");
    assert.equal(resources.body.result.ttlMs, 0);
    assert.equal(resources.body.result.cacheScope, "private");
    assert.deepEqual(resources.body.result.resources, [{
      name: "getting-started",
      uri,
      title: "Coffee getting started",
      description: "A synthetic coffee guide.",
      mimeType: "text/markdown",
    }]);

    const read = await rpc(running.url, "resources/read", { uri }, "irrelevant");
    assert.equal(read.body.result.contents[0].text, "# Brew safely");
    assert.equal(resourceCalls, 1);

    const unknown = await rpc(
      running.url,
      "resources/read",
      { uri: "guide://coffee/unknown" },
      "irrelevant",
    );
    assert.equal(unknown.response.status, 200);
    assert.equal(unknown.body.error.code, -32602);
    assert.equal(resourceCalls, 1);

    const prompts = await rpc(running.url, "prompts/list", {}, "irrelevant");
    assert.deepEqual(prompts.body.result.prompts, [
      {
        name: "brew-guide",
        title: "Brew guide",
        description: "Create a synthetic brewing prompt.",
        arguments: [{ name: "topic", required: true }],
      },
      {
        name: "slow-prompt-schema",
        description: "Exercise asynchronous prompt argument validation.",
        arguments: [{ name: "topic", required: true }],
      },
    ]);

    const rendered = await rpc(
      running.url,
      "prompts/get",
      { name: "brew-guide", arguments: { topic: "pour-over" } },
      "irrelevant",
    );
    assert.equal(rendered.body.result.messages[0].content.text, "Explain pour-over.");
    assert.equal(promptCalls, 1);
    assert.equal(verifierCalls, 0);

    const invalidArgs = await rpc(
      running.url,
      "prompts/get",
      { name: "brew-guide", arguments: { topic: "" } },
      "irrelevant",
    );
    assertGenericError(invalidArgs, "Prompt rendering failed");
    assert.equal(promptCalls, 1);

    const slowStarted = Date.now();
    const slow = await rpc(
      running.url,
      "prompts/get",
      { name: "slow-prompt-schema", arguments: { topic: "slow" } },
    );
    assertGenericError(slow, "Prompt rendering failed");
    assert.ok(Date.now() - slowStarted < 150, "prompt validation exceeded the request deadline");
    assert.equal(slowPromptCalls, 0);

    const promptSecret = await rpc(
      running.url,
      "prompts/get",
      { name: "brew-guide", arguments: { topic: "secret" } },
    );
    assertGenericError(promptSecret, "Prompt rendering failed");
    assert.doesNotMatch(JSON.stringify(promptSecret.body), /prompt-secret-sentinel/);
    const invalidPromptResult = await rpc(
      running.url,
      "prompts/get",
      { name: "brew-guide", arguments: { topic: "invalid-result" } },
    );
    assertGenericError(invalidPromptResult, "Prompt rendering failed");
    assert.doesNotMatch(JSON.stringify(invalidPromptResult.body), /invalid-result/);
    const oversizedPrompt = await rpc(
      running.url,
      "prompts/get",
      { name: "brew-guide", arguments: { topic: "oversized" } },
    );
    assertGenericError(oversizedPrompt, "Prompt rendering failed");

    resourceMode = "secret";
    const resourceSecret = await rpc(running.url, "resources/read", { uri });
    assertGenericError(resourceSecret, "Resource read failed");
    assert.doesNotMatch(JSON.stringify(resourceSecret.body), /resource-secret-sentinel/);
    resourceMode = "wrong-uri";
    const wrongUri = await rpc(running.url, "resources/read", { uri });
    assertGenericError(wrongUri, "Resource read failed");
    assert.doesNotMatch(JSON.stringify(wrongUri.body), /must-not-leak|private\/secret/);
    resourceMode = "oversized";
    const oversizedResource = await rpc(running.url, "resources/read", { uri });
    assertGenericError(oversizedResource, "Resource read failed");
    resourceMode = "slow";
    const timedOut = await rpc(running.url, "resources/read", { uri });
    assertGenericError(timedOut, "Resource read failed");
    assert.equal(resourceCancelled, true);
    assert.doesNotMatch(JSON.stringify(timedOut.body), /AbortError|stack|slow/i);

    await delay(220);
    assert.equal(slowPromptCalls, 0);
    assert.equal(verifierCalls, 0);

    resourceMode = "valid";
    const client = new Client(
      { name: "resources-prompts-independent-client", version: "0.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await client.connect(new StreamableHTTPClientTransport(running.url));
    try {
      assert.deepEqual((await client.listResources()).resources.map(({ name }) => name), [
        "getting-started",
      ]);
      assert.equal((await client.readResource({ uri })).contents[0].text, "# Brew safely");
      assert.deepEqual((await client.listPrompts()).prompts.map(({ name }) => name), [
        "brew-guide",
        "slow-prompt-schema",
      ]);
      assert.equal((await client.getPrompt({
        name: "brew-guide",
        arguments: { topic: "espresso" },
      })).messages[0].content.text, "Explain espresso.");
    } finally {
      await client.close();
    }
  } finally {
    await running.close();
  }
});

test("public resource templates stay checked and identity-free", async () => {
  let verifierCalls = 0;
  let handlerCalls = 0;
  let slowCancelled = false;
  const template = defineResourceTemplate({
    name: "topic-guide",
    uriTemplate: "guide://coffee/{topic}",
    title: "Coffee topic guide",
    description: "A synthetic guide selected by topic.",
    mimeType: "text/markdown",
    async handler({ uri: requestedUri, variables }, { signal, deadlineMs }) {
      handlerCalls += 1;
      assert.ok(deadlineMs > Date.now() - 1_000);
      const topic = variables.topic;
      assert.equal(typeof topic, "string");
      if (topic === "secret") throw new Error("template-secret-sentinel");
      if (topic === "wrong-uri") {
        return { contents: [{ uri: "guide://private/secret", text: "must-not-leak" }] };
      }
      if (topic === "oversized") {
        return { contents: [{ uri: requestedUri, text: "x".repeat(1_000) }] };
      }
      if (topic === "slow") {
        try {
          await delay(200, undefined, { signal });
        } catch (error) {
          slowCancelled = signal.aborted;
          throw error;
        }
      }
      return {
        contents: [{ uri: requestedUri, mimeType: "text/markdown", text: `# ${topic}` }],
      };
    },
  });
  const app = createEmseepea({
    name: "resource-templates",
    version: "0.0.0",
    resources: [template],
    operationTimeoutMs: 40,
    maxApplicationResultBytes: 512,
    oauth: {
      verifier: {
        async verifyAccessToken() {
          verifierCalls += 1;
          throw new Error("public operations must not verify bearer tokens");
        },
      },
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
  });
  const running = await serveEmseepea(app, { port: 0 });

  try {
    const discover = await rpc(running.url, "server/discover", {}, "irrelevant");
    assert.deepEqual(discover.body.result.capabilities.resources, {
      subscribe: false,
      listChanged: false,
    });

    const catalogue = await rpc(
      running.url,
      "resources/templates/list",
      {},
      "irrelevant",
    );
    assert.equal(catalogue.body.result.ttlMs, 0);
    assert.equal(catalogue.body.result.cacheScope, "private");
    assert.deepEqual(catalogue.body.result.resourceTemplates, [{
      name: "topic-guide",
      uriTemplate: "guide://coffee/{topic}",
      title: "Coffee topic guide",
      description: "A synthetic guide selected by topic.",
      mimeType: "text/markdown",
    }]);
    assert.deepEqual((await rpc(running.url, "resources/list")).body.result.resources, []);

    const read = await rpc(
      running.url,
      "resources/read",
      { uri: "guide://coffee/pour-over" },
      "irrelevant",
    );
    assert.equal(read.body.result.contents[0].text, "# pour-over");
    assert.equal(handlerCalls, 1);
    assert.equal(verifierCalls, 0);

    for (const unknownUri of ["guide://tea/pour-over", "not-a-resource-uri"]) {
      const unknown = await rpc(running.url, "resources/read", { uri: unknownUri }, "irrelevant");
      assert.equal(unknown.response.status, 200);
      assert.equal(unknown.body.error.code, -32602);
      assert.equal(handlerCalls, 1);
    }

    const secret = await rpc(running.url, "resources/read", { uri: "guide://coffee/secret" });
    assertGenericError(secret, "Resource read failed");
    assert.doesNotMatch(JSON.stringify(secret.body), /template-secret-sentinel/);
    const wrongUri = await rpc(
      running.url,
      "resources/read",
      { uri: "guide://coffee/wrong-uri" },
    );
    assertGenericError(wrongUri, "Resource read failed");
    assert.doesNotMatch(JSON.stringify(wrongUri.body), /private\/secret|must-not-leak/);
    const oversized = await rpc(
      running.url,
      "resources/read",
      { uri: "guide://coffee/oversized" },
    );
    assertGenericError(oversized, "Resource read failed");
    const slow = await rpc(running.url, "resources/read", { uri: "guide://coffee/slow" });
    assertGenericError(slow, "Resource read failed");
    assert.equal(slowCancelled, true);

    const client = new Client(
      { name: "resource-template-independent-client", version: "0.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await client.connect(new StreamableHTTPClientTransport(running.url));
    try {
      assert.deepEqual(
        (await client.listResourceTemplates()).resourceTemplates.map(({ name }) => name),
        ["topic-guide"],
      );
      assert.equal(
        (await client.readResource({ uri: "guide://coffee/espresso" })).contents[0].text,
        "# espresso",
      );
    } finally {
      await client.close();
    }
    assert.equal(verifierCalls, 0);
  } finally {
    await running.close();
  }
});

test("disconnect cancels cooperating resource and prompt handlers", async () => {
  let startResource;
  const resourceStarted = new Promise((resolve) => { startResource = resolve; });
  let cancelResource;
  const resourceCancelled = new Promise((resolve) => { cancelResource = resolve; });
  let startPrompt;
  const promptStarted = new Promise((resolve) => { startPrompt = resolve; });
  let cancelPrompt;
  const promptCancelled = new Promise((resolve) => { cancelPrompt = resolve; });
  let startTemplate;
  const templateStarted = new Promise((resolve) => { startTemplate = resolve; });
  let cancelTemplate;
  const templateCancelled = new Promise((resolve) => { cancelTemplate = resolve; });
  let resourceCompleted = false;
  let promptCompleted = false;
  let templateCompleted = false;

  const app = createEmseepea({
    name: "resource-prompt-disconnect",
    version: "0.0.0",
    operationTimeoutMs: 1_000,
    resources: [
      defineResource({
        name: "disconnect-resource",
        uri,
        async handler({ signal }) {
          startResource();
          signal.addEventListener("abort", cancelResource, { once: true });
          await delay(5_000, undefined, { signal });
          resourceCompleted = true;
          return { contents: [{ uri, text: "done" }] };
        },
      }),
      defineResourceTemplate({
        name: "disconnect-template",
        uriTemplate: "guide://disconnect/{topic}",
        async handler({ uri: requestedUri }, { signal }) {
          startTemplate();
          signal.addEventListener("abort", cancelTemplate, { once: true });
          await delay(5_000, undefined, { signal });
          templateCompleted = true;
          return { contents: [{ uri: requestedUri, text: "done" }] };
        },
      }),
    ],
    prompts: [definePrompt({
      name: "disconnect-prompt",
      argsSchema: z.object({}),
      async handler(_args, { signal }) {
        startPrompt();
        signal.addEventListener("abort", cancelPrompt, { once: true });
        await delay(5_000, undefined, { signal });
        promptCompleted = true;
        return { messages: [] };
      },
    })],
  });
  const running = await serveEmseepea(app, { port: 0 });

  try {
    const resourceController = new AbortController();
    const read = rpc(running.url, "resources/read", { uri }, undefined, resourceController.signal);
    await resourceStarted;
    resourceController.abort();
    await assert.rejects(read, /abort/i);
    await Promise.race([
      resourceCancelled,
      delay(200).then(() => assert.fail("resource handler did not observe cancellation")),
    ]);

    const promptController = new AbortController();
    const get = rpc(
      running.url,
      "prompts/get",
      { name: "disconnect-prompt", arguments: {} },
      undefined,
      promptController.signal,
    );
    await promptStarted;
    promptController.abort();
    await assert.rejects(get, /abort/i);
    await Promise.race([
      promptCancelled,
      delay(200).then(() => assert.fail("prompt handler did not observe cancellation")),
    ]);

    const templateController = new AbortController();
    const templateRead = rpc(
      running.url,
      "resources/read",
      { uri: "guide://disconnect/topic" },
      undefined,
      templateController.signal,
    );
    await templateStarted;
    templateController.abort();
    await assert.rejects(templateRead, /abort/i);
    await Promise.race([
      templateCancelled,
      delay(200).then(() => assert.fail("resource-template handler did not observe cancellation")),
    ]);
    assert.equal(resourceCompleted, false);
    assert.equal(promptCompleted, false);
    assert.equal(templateCompleted, false);
  } finally {
    await running.close();
  }
});

function assertGenericError(result, message) {
  assert.equal(result.response.status, 200);
  assert.equal(result.body.error.code, -32603);
  assert.equal(result.body.error.message, message);
  assert.equal(result.body.result, undefined);
}

async function rpc(url, method, params = {}, token, signal) {
  const headers = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": method,
  };
  if (method === "prompts/get") headers["Mcp-Name"] = params.name;
  if (method === "resources/read") headers["Mcp-Name"] = params.uri;
  if (method === "tools/call") headers["Mcp-Name"] = params.name;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: { ...params, _meta: requestMeta },
    }),
  });
  return { response, body: await response.json() };
}
