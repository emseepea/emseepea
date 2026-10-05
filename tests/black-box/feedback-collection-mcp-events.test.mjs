import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createEmseepea, serveEmseepea } from "@emseepea/server";
import {
  createFeedbackSubmittedEventsOptions,
  publishFeedbackSubmittedEvent,
} from "@emseepea/feedback/mcp-events";
import {
  createInMemoryFeedbackCollectionBackend,
  defineFeedbackCollections,
  defineFeedbackCollectionSubmissions,
} from "@emseepea/feedback";

const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "feedback-collections-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("feedback.submitted publishes body-free references only to authorized collection subscriptions", async () => {
  const queued = [];
  const allowed = new Set(["operator-a:internal", "operator-a:customer", "operator-b:internal"]);
  const subscriptions = [{
    id: "sub-both", ownerKey: "operator-a", name: "feedback.submitted",
    arguments: { collections: ["customer", "internal"] },
    url: "https://callback.example.com/events", secret: "unused",
    expiresAt: Date.now() + 60_000,
  }, {
    id: "sub-other-owner", ownerKey: "operator-b", name: "feedback.submitted",
    arguments: { collections: ["internal"] },
    url: "https://other.example.com/events", secret: "unused",
    expiresAt: Date.now() + 60_000,
  }];
  const definition = defineFeedbackCollections({
    collections: ["customer", "internal"],
    submissions: [{
      collection: "internal", access: "protected", requiredScopes: ["feedback:submit"],
    }],
    monitors: [
      { collection: "customer", access: "protected", requiredScopes: ["feedback:monitor"] },
      { collection: "internal", access: "protected", requiredScopes: ["feedback:monitor"] },
    ],
  });
  const events = createFeedbackSubmittedEventsOptions({
    definition,
    ownerKey: (auth) => auth.clientId,
    canMonitorCollection: ({ ownerKey, collection }) => allowed.has(`${ownerKey}:${collection}`),
    health: () => true,
    store: {
      async get() { return null; }, async put() {}, async delete() {},
      async list(name) { return subscriptions.filter((row) => row.name === name); },
      async enqueue(row) { queued.push(row); }, async claimDue() { return []; },
      async complete() {}, async reschedule() {},
    },
  });
  const ids = ["submission-1", "submission-2", "submission-3"];
  const durable = createInMemoryFeedbackCollectionBackend({
    sourceSystem: "support",
    createSubmissionId: () => ids.shift(),
    now: () => "2026-10-05T04:00:00.000Z",
  });
  const order = [];
  let failPersistence = false;
  const backend = {
    ...durable,
    recordSubmission(command, context) {
      order.push("persist");
      if (failPersistence) throw new Error("storage unavailable");
      return durable.recordSubmission(command, context);
    },
  };
  let app;
  const tools = defineFeedbackCollectionSubmissions({
    definition,
    scope: (principal) => principal?.clientId ?? "public",
    backend,
    hooks: [async (event, context) => {
      order.push("publish");
      await publishFeedbackSubmittedEvent(app, event, context);
    }],
  });
  app = createEmseepea({
    name: "feedback-collection-events", version: "0.0.0",
    authentication: authentication(), events, tools,
  });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const listed = await rpc(running.url, "events/list", {}, "operator-a");
    assert.deepEqual(listed.body.result.events.map(({ name }) => name), ["feedback.submitted"]);
    assert.deepEqual(
      listed.body.result.events[0].inputSchema.properties.collections.items.enum,
      ["customer", "internal"],
    );
    const internalOnly = await rpc(running.url, "events/list", {}, "operator-b");
    assert.deepEqual(
      internalOnly.body.result.events[0].inputSchema.properties.collections.items.enum,
      ["internal"],
    );

    const submitted = await rpc(running.url, "tools/call", {
      name: "submit-internal-feedback",
      arguments: {
        observation: "friction",
        detail: "The internal workflow required repeated steps.",
      },
    }, "operator-a");
    assert.equal(submitted.body.error, undefined, JSON.stringify(submitted.body.error));
    assert.equal(submitted.body.result.isError, false);
    assert.deepEqual(order, ["persist", "publish"]);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].subscriptionId, "sub-both");
    const published = JSON.parse(queued[0].body);
    assert.equal(published.name, "feedback.submitted");
    assert.deepEqual(published.data, {
      collection: "internal",
      submissionId: "submission-1",
      sourceEventId: published.data.sourceEventId,
    });
    assert.match(published.data.sourceEventId, /^feedback\.submission\.recorded:[a-f0-9]{64}$/);
    assert.doesNotMatch(queued[0].body, /workflow|required repeated|detail|observation|context|sourceSystem/);

    allowed.delete("operator-a:internal");
    await rpc(running.url, "tools/call", {
      name: "submit-internal-feedback",
      arguments: { observation: "suggestion", detail: "Show the next action beside the result." },
    }, "operator-a");
    assert.equal(queued.length, 1);

    failPersistence = true;
    const failed = await rpc(running.url, "tools/call", {
      name: "submit-internal-feedback",
      arguments: { observation: "error", detail: "This write must fail before publication." },
    }, "operator-a");
    assert.equal(failed.body.result.isError, true);
    assert.equal(queued.length, 1);
    assert.deepEqual(order, ["persist", "publish", "persist", "publish", "persist"]);
  } finally {
    await running.close();
  }
});

test("customer submission-only server does not advertise MCP Events", async () => {
  const definition = defineFeedbackCollections({
    collections: ["customer"],
    submissions: [{ collection: "customer", access: "public" }],
  });
  const events = createFeedbackSubmittedEventsOptions({
    definition,
    ownerKey: (auth) => auth.clientId,
    canMonitorCollection: () => false,
    health: () => true,
    store: {},
  });
  assert.equal(events, undefined);
  const running = await serveEmseepea(createEmseepea({
    name: "customer-submission-only", version: "0.0.0", authentication: authentication(), events,
  }), { port: 0 });
  try {
    const discovery = await rpc(running.url, "server/discover");
    assert.equal(discovery.body.result.capabilities.events, undefined);
    const missing = await rpc(running.url, "events/list", {}, "customer-a");
    assert.equal(missing.body.error.code, -32601);
  } finally {
    await running.close();
  }
});

function authentication() {
  return {
    verifier: { async verifyAccessToken(token) { return {
      token, clientId: token, scopes: ["feedback:monitor", "feedback:submit"],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
      resource: new URL("https://api.example/mcp"),
    }; } },
    metadata: { resourceServerUrl: new URL("https://api.example/mcp"), oauthMetadata: {
      issuer: "https://auth.example", authorization_endpoint: "https://auth.example/authorize",
      token_endpoint: "https://auth.example/token", response_types_supported: ["code"],
    } },
  };
}

async function rpc(url, method, params = {}, token) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(method === "tools/call" && typeof params.name === "string"
        ? { "Mcp-Name": params.name }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: randomUUID(), method,
      params: { ...params, _meta: requestMeta },
    }),
  });
  return { response, body: await response.json() };
}
