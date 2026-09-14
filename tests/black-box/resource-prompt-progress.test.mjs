import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import {
  createEmseepea,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";

const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "resource-prompt-progress-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("resources and prompts expose bounded progress only for the current request", async () => {
  const withoutProgress = [];
  let retainedReport;
  const report = async (context, name) => {
    if (!context.reportProgress) {
      withoutProgress.push(name);
      return;
    }
    await context.reportProgress({ progress: 1, total: 2, message: name });
  };
  const resource = defineResource({
    access: "public",
    name: "progress-resource",
    uri: "progress://static/resource",
    handler(context) {
      if (context.reportProgress) {
        void context.reportProgress({ progress: 1, total: 2, message: "resource" });
      } else {
        withoutProgress.push("resource");
      }
      return { contents: [{ uri: "progress://static/resource", text: "resource" }] };
    },
  });
  const template = defineResourceTemplate({
    access: "public",
    name: "progress-template",
    uriTemplate: "progress://resource/{name}",
    async handler({ uri }, context) {
      await report(context, "template");
      return { contents: [{ uri, text: "template" }] };
    },
  });
  const prompt = definePrompt({
    access: "public",
    name: "progress-prompt",
    argsSchema: z.object({ overflow: z.enum(["yes", "no"]) }),
    async handler({ overflow }, context) {
      retainedReport = context.reportProgress;
      await report(context, "prompt");
      if (overflow === "yes") {
        await context.reportProgress?.({ progress: 2, total: 2, message: "overflow" });
      }
      return { messages: [{ role: "user", content: { type: "text", text: "prompt" } }] };
    },
  });
  const running = await serveEmseepea(createEmseepea({
    name: "resource-prompt-progress",
    version: "0.0.0",
    resources: [resource, template],
    prompts: [prompt],
    maxProgressEvents: 1,
    maxProgressEventBytes: 256,
  }), { port: 0 });

  try {
    const client = new Client(
      { name: "resource-prompt-progress-client", version: "0.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    await client.connect(new StreamableHTTPClientTransport(running.url));
    try {
      await client.readResource({ uri: "progress://static/resource" });
      await client.readResource({ uri: "progress://resource/coffee" });
      await client.getPrompt({ name: "progress-prompt", arguments: { overflow: "no" } });
      assert.deepEqual(withoutProgress, ["resource", "template", "prompt"]);

      for (const [name, call] of [
        ["resource", (options) => client.readResource({ uri: "progress://static/resource" }, options)],
        ["template", (options) => client.readResource({ uri: "progress://resource/coffee" }, options)],
        ["prompt", (options) => client.getPrompt({
          name: "progress-prompt",
          arguments: { overflow: "no" },
        }, options)],
      ]) {
        const updates = [];
        await call({ onprogress: (update) => updates.push(update) });
        assert.deepEqual(updates.map(({ progress, total, message }) => ({ progress, total, message })), [
          { progress: 1, total: 2, message: name },
        ]);
      }

      await assert.rejects(
        client.getPrompt(
          { name: "progress-prompt", arguments: { overflow: "yes" } },
          { onprogress() {} },
        ),
        /Prompt rendering failed/,
      );
      await assert.rejects(retainedReport({ progress: 2, total: 2 }), /no longer available/);
    } finally {
      await client.close();
    }

    for (const [method, params, token, message] of [
      ["resources/read", { uri: "progress://static/resource" }, "resource-token", "resource"],
      ["resources/read", { uri: "progress://resource/coffee" }, "template-token", "template"],
      ["prompts/get", {
        name: "progress-prompt",
        arguments: { overflow: "no" },
      }, "prompt-token-one", "prompt"],
      ["prompts/get", {
        name: "progress-prompt",
        arguments: { overflow: "no" },
      }, "prompt-token-two", "prompt"],
    ]) {
      const streamed = await rpc(running.url, method, params, token);
      assert.match(streamed.response.headers.get("content-type"), /^text\/event-stream/);
      assert.equal(streamed.messages.length, 2);
      assert.equal(streamed.messages[0].method, "notifications/progress");
      assert.deepEqual(streamed.messages[0].params, {
        progressToken: token,
        progress: 1,
        total: 2,
        message,
      });
      assert.equal(streamed.messages[1].result.resultType, "complete");
    }
  } finally {
    await running.close();
  }
});

test("authorization finishes before protected resource or prompt progress begins", async () => {
  let calls = 0;
  const resource = defineResource({
    access: "protected",
    requiredScopes: ["progress:read"],
    name: "protected-progress-resource",
    uri: "progress://protected/resource",
    async handler({ reportProgress }) {
      calls += 1;
      await reportProgress?.({ progress: 1, total: 1 });
      return { contents: [{ uri: "progress://protected/resource", text: "protected" }] };
    },
  });
  const prompt = definePrompt({
    access: "protected",
    requiredScopes: ["progress:read"],
    name: "protected-progress-prompt",
    argsSchema: z.object({}),
    async handler(_args, { reportProgress }) {
      calls += 1;
      await reportProgress?.({ progress: 1, total: 1 });
      return { messages: [] };
    },
  });
  const running = await serveEmseepea(createEmseepea({
    name: "protected-resource-prompt-progress",
    version: "0.0.0",
    resources: [resource],
    prompts: [prompt],
    authentication: {
      verifier: {
        async verifyAccessToken() {
          throw new OAuthError(OAuthErrorCode.InvalidToken, "invalid");
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
  }), { port: 0 });

  try {
    for (const [method, params] of [
      ["resources/read", { uri: "progress://protected/resource" }],
      ["prompts/get", { name: "protected-progress-prompt", arguments: {} }],
    ]) {
      const denied = await rpc(running.url, method, params, "progress-token", "invalid");
      assert.equal(denied.response.status, 401);
      assert.deepEqual(denied.messages, []);
    }
    assert.equal(calls, 0);
  } finally {
    await running.close();
  }
});

async function rpc(url, method, params, progressToken, bearerToken) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      "Mcp-Name": method === "resources/read" ? params.uri : params.name,
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: { ...params, _meta: { ...meta, progressToken } },
    }),
  });
  const messages = (await response.text())
    .split("\n\n")
    .filter((frame) => frame.startsWith("event: message\n"))
    .map((frame) => JSON.parse(frame.slice(frame.indexOf("data: ") + 6)));
  return { response, messages };
}
