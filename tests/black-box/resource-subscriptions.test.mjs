import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import test from "node:test";
import {
  createEmseepea,
  defineResource,
  defineResourceTemplate,
  notifyResourceUpdated,
  serveEmseepea,
} from "@emseepea/server";
import { readMessages } from "../fixtures/proxy-progress.mjs";

const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "resource-subscriptions-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("resource subscriptions cover static and concrete template URIs", { timeout: 10_000 }, async () => {
  const events = [];
  const app = createEmseepea({
    name: "resource-subscriptions",
    version: "0.0.0",
    resources: [
      resource("guide", "guide://coffee/getting-started", false),
      defineResourceTemplate({
        access: "public",
        name: "invoice",
        uriTemplate: "invoice://records/{invoiceId}",
        handler: ({ uri }) => ({ contents: [{ uri, text: "invoice" }] }),
      }),
    ],
    resourceSubscriptions: {},
    observability: [{ id: "test", emit: (event) => events.push(event) }],
  });
  const running = await serveEmseepea(app, { port: 0 });
  const streams = [];
  try {
    const discovery = await rpc(running.url, "server/discover");
    assert.deepEqual(discovery.body.result.capabilities.resources, {
      subscribe: true,
      listChanged: false,
    });

    const guide = await openSubscription(running.url, "guide://coffee/getting-started");
    const invoice = await openSubscription(running.url, "invoice://records/123");
    streams.push(guide, invoice);
    notifyResourceUpdated(app, "invoice://records/456");
    notifyResourceUpdated(app, "guide://coffee/getting-started");
    notifyResourceUpdated(app, "invoice://records/123");
    assert.throws(() => notifyResourceUpdated(app, "unknown://resource"), /registered resource/);

    await running.close();
    assert.deepEqual(methods(await guide.messages), [
      "notifications/subscriptions/acknowledged",
      "notifications/resources/updated",
      "complete",
    ]);
    const invoiceMessages = await invoice.messages;
    assert.deepEqual(methods(invoiceMessages), [
      "notifications/subscriptions/acknowledged",
      "notifications/resources/updated",
      "complete",
    ]);
    assert.equal(invoiceMessages[1].params.uri, "invoice://records/123");
    const subscriptionEvents = events.filter(({ method }) => method === "subscriptions/listen");
    assert.equal(subscriptionEvents.length, 2);
    assert.ok(subscriptionEvents.every((event) => event.capability && event.outcome === "finished"));
    assert.deepEqual(Object.keys(subscriptionEvents[0]).sort(), [
      "capability", "durationMs", "httpMethod", "method", "outcome", "statusCode", "type",
    ]);
    assert.doesNotMatch(JSON.stringify(subscriptionEvents), /guide:\/\/|invoice:\/\/|subscription-client/);
  } finally {
    await Promise.allSettled(streams.map(({ cancel }) => cancel()));
    await running.close();
  }
});

test("resource subscriptions reject unsupported filters and isolate overflow", { timeout: 10_000 }, async () => {
  const events = [];
  const app = createEmseepea({
    name: "bounded-resource-subscriptions",
    version: "0.0.0",
    resources: [
      resource("guide", "guide://coffee/getting-started"),
      resource("peer", "guide://coffee/peer"),
    ],
    resourceSubscriptions: { maxActive: 2, maxEvents: 1, maxEventBytes: 512, maxUriBytes: 64 },
    observability: [{ id: "test", emit: (event) => events.push(event) }],
  });
  const running = await serveEmseepea(app, { port: 0 });
  let active;
  try {
    const unsupported = await rpc(running.url, "subscriptions/listen", {
      notifications: {
        resourceSubscriptions: ["guide://coffee/getting-started"],
        toolsListChanged: true,
      },
    });
    assert.equal(unsupported.response.status, 400);
    assert.equal(unsupported.body.error.code, -32602);

    const unknown = await rpc(running.url, "subscriptions/listen", {
      notifications: { resourceSubscriptions: ["guide://coffee/unknown"] },
    });
    assert.equal(unknown.response.status, 200);
    assert.equal(unknown.body.error.message, "Capability not found");

    active = await openSubscription(running.url, "guide://coffee/getting-started");
    const peer = await openSubscription(running.url, "guide://coffee/peer");
    const refused = await rpc(running.url, "subscriptions/listen", {
      notifications: { resourceSubscriptions: ["guide://coffee/getting-started"] },
    });
    assert.equal(refused.response.status, 503);

    notifyResourceUpdated(app, "guide://coffee/getting-started");
    notifyResourceUpdated(app, "guide://coffee/getting-started");
    await assert.rejects(active.messages, (error) => error.cause?.code === "UND_ERR_SOCKET");
    assert.ok(events.some((event) => event.method === "subscriptions/listen" &&
      event.capability === "guide" && event.outcome === "disconnected"));

    const reopened = await openSubscription(running.url, "guide://coffee/getting-started");
    notifyResourceUpdated(app, "guide://coffee/peer");
    await running.close();
    assert.deepEqual(methods(await peer.messages), [
      "notifications/subscriptions/acknowledged",
      "notifications/resources/updated",
      "complete",
    ]);
    assert.deepEqual(methods(await reopened.messages), [
      "notifications/subscriptions/acknowledged",
      "complete",
    ]);
  } finally {
    await active?.cancel();
    await running.close();
  }
});

test("resource subscription expiry and disconnect release capacity", { timeout: 10_000 }, async () => {
  const app = createEmseepea({
    name: "resource-subscription-cleanup",
    version: "0.0.0",
    resources: [resource("guide", "guide://coffee/getting-started")],
    resourceSubscriptions: { maxActive: 1, lifetimeMs: 50 },
  });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const expired = await openSubscription(running.url, "guide://coffee/getting-started");
    assert.deepEqual(methods(await expired.messages), [
      "notifications/subscriptions/acknowledged",
      "complete",
    ]);
    await disconnectSubscription(running.url, "guide://coffee/getting-started");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const reopened = await openSubscription(running.url, "guide://coffee/getting-started");
    await running.close();
    assert.deepEqual(methods(await reopened.messages), [
      "notifications/subscriptions/acknowledged",
      "complete",
    ]);
  } finally {
    await running.close();
  }
});

test("an oversized resource update closes only its stream", { timeout: 10_000 }, async () => {
  const app = createEmseepea({
    name: "resource-subscription-event-size",
    version: "0.0.0",
    resources: [resource("guide", "guide://coffee/getting-started")],
    resourceSubscriptions: { maxActive: 2, maxEventBytes: 128 },
  });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const oversized = await openSubscription(running.url, "guide://coffee/getting-started");
    notifyResourceUpdated(app, "guide://coffee/getting-started");
    await assert.rejects(oversized.messages, (error) => error.cause?.code === "UND_ERR_SOCKET");
    const peer = await openSubscription(running.url, "guide://coffee/getting-started");
    await running.close();
    assert.deepEqual(methods(await peer.messages), [
      "notifications/subscriptions/acknowledged",
      "complete",
    ]);
  } finally {
    await running.close();
  }
});

test("protected resource subscriptions authenticate before opening a stream", { timeout: 10_000 }, async () => {
  const resourceServerUrl = new URL("https://api.example/mcp");
  const app = createEmseepea({
    name: "protected-resource-subscriptions",
    version: "0.0.0",
    resources: [defineResourceTemplate({
      access: "protected",
      requiredScopes: ["invoices:read"],
      name: "invoice",
      uriTemplate: "invoice://records/{invoiceId}",
      handler: ({ uri }) => ({ contents: [{ uri, text: "invoice" }] }),
    })],
    resourceSubscriptions: {},
    authentication: {
      discovery: "protected",
      verifier: {
        async verifyAccessToken(token) {
          return {
            token,
            clientId: "subscription-client",
            scopes: token === "permitted" ? ["invoices:read"] : ["other:read"],
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
  });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const denied = await rpc(running.url, "subscriptions/listen", {
      notifications: { resourceSubscriptions: ["invoice://records/123"] },
    });
    assert.equal(denied.response.status, 401);
    const restricted = await rpc(running.url, "subscriptions/listen", {
      notifications: { resourceSubscriptions: ["invoice://records/123"] },
    }, "restricted");
    const unknown = await rpc(running.url, "subscriptions/listen", {
      notifications: { resourceSubscriptions: ["invoice://unknown/123"] },
    }, "restricted");
    assert.equal(restricted.response.status, 200);
    assert.deepEqual(restricted.body.error, unknown.body.error);

    const permitted = await openSubscription(running.url, "invoice://records/123", "permitted");
    notifyResourceUpdated(app, "invoice://records/123");
    await running.close();
    assert.deepEqual(methods(await permitted.messages), [
      "notifications/subscriptions/acknowledged",
      "notifications/resources/updated",
      "complete",
    ]);
  } finally {
    await running.close();
  }
});

function resource(name, uri, discoverable = true) {
  return defineResource({
    access: "public",
    name,
    uri,
    discoverable,
    handler: () => ({ contents: [{ uri, text: name }] }),
  });
}

function methods(messages) {
  return messages.map((message) => message.method ?? message.result.resultType);
}

async function openSubscription(url, uri, token) {
  const controller = new AbortController();
  const response = await fetch(url, request("subscriptions/listen", {
    notifications: { resourceSubscriptions: [uri] },
  }, token, AbortSignal.any([controller.signal])));
  const acknowledged = Promise.withResolvers();
  const messages = readMessages(response, (message) => {
    if (message.method === "notifications/subscriptions/acknowledged") acknowledged.resolve();
  });
  await Promise.race([acknowledged.promise, messages.then(() => assert.fail("missing acknowledgment"))]);
  return {
    messages,
    async cancel() {
      controller.abort();
      await Promise.allSettled([messages]);
    },
  };
}

async function rpc(url, method, params = {}, token) {
  const response = await fetch(url, request(method, params, token));
  return { response, body: await response.json() };
}

function disconnectSubscription(url, uri) {
  return new Promise((resolve, reject) => {
    const options = request("subscriptions/listen", {
      notifications: { resourceSubscriptions: [uri] },
    });
    const outgoing = httpRequest(url, options, (incoming) => {
      assert.equal(incoming.statusCode, 200);
      incoming.once("data", (chunk) => {
        assert.match(chunk.toString(), /notifications\/subscriptions\/acknowledged/);
        incoming.once("close", resolve);
        incoming.destroy();
        outgoing.destroy();
      });
      incoming.once("error", reject);
    });
    outgoing.once("error", reject);
    outgoing.end(options.body);
  });
}

function request(method, params, token, signal) {
  return {
    method: "POST",
    signal,
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: { ...params, _meta: meta },
    }),
  };
}
