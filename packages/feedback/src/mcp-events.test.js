import assert from "node:assert/strict";
import test from "node:test";
import { createMcpEventRuntime } from "../../framework/dist/events.js";
import {
  createFeedbackReplyEventsOptions,
  createFeedbackSubmittedEventsOptions,
  feedbackSubmittedEventName,
} from "../dist/mcp-events.js";
import { defineFeedbackCollections } from "../dist/index.js";

test("feedback reply events require exact-thread authorization", async () => {
  const checked = [];
  const options = createFeedbackReplyEventsOptions({
    ownerKey: () => "owner-a",
    canReadThread: (ownerKey, threadId) => {
      checked.push([ownerKey, threadId]);
      return ownerKey === "owner-a" && threadId === "thread-a";
    },
    health: () => true,
    store: {},
  });
  const request = { name: "feedback.reply.ready", arguments: { threadId: "thread-a" } };
  assert.equal(await options.authorize({ ...request, ownerKey: "owner-a", phase: "subscribe" }), true);
  assert.equal(await options.authorize({ ...request, ownerKey: "owner-b", phase: "delivery" }), false);
  assert.deepEqual(checked, [["owner-a", "thread-a"], ["owner-b", "thread-a"]]);
});

test("revoking exact-thread access cancels a queued team-reply delivery", async () => {
  const due = [];
  const sent = [];
  let allowed = true;
  const subscription = {
    id: "sub-a", ownerKey: "owner-a", name: "feedback.reply.ready",
    arguments: { threadId: "thread-a" },
    url: "https://callback.example.com/events", secret: "unused",
    expiresAt: Date.now() + 60_000,
  };
  const runtime = createMcpEventRuntime(createFeedbackReplyEventsOptions({
    ownerKey: () => "owner-a",
    canReadThread: () => allowed,
    health: () => true,
    store: {
      async get() { return subscription; }, async put() {}, async delete() {},
      async list() { return [subscription]; },
      async enqueue(row) { due.push(row); },
      async claimDue() { return due.map((row) => ({ ...row, leaseId: "lease-a" })); },
      async complete(id) { const index = due.findIndex((row) => row.id === id); due.splice(index, 1); },
      async reschedule() {},
    },
  }), async (...args) => { sent.push(args); return { status: 204, body: Buffer.alloc(0) }; });

  await runtime.publish("feedback.reply.ready", {
    scope: "owner-a", threadId: "thread-a", messageId: "message-a", sourceEventId: "event-a",
  });
  assert.equal(due.length, 1);
  allowed = false;
  await runtime.drain();
  assert.equal(due.length, 0);
  assert.equal(sent.length, 0);
});

test("feedback submitted subscriptions are canonical, bounded, and authorized per collection and phase", async () => {
  const checked = [];
  const definition = defineFeedbackCollections({
    collections: ["customer", "internal"],
    monitors: [
      { collection: "customer", access: "protected", requiredScopes: ["feedback:monitor"] },
      { collection: "internal", access: "protected", requiredScopes: ["feedback:monitor"] },
    ],
  });
  const options = createFeedbackSubmittedEventsOptions({
    definition,
    ownerKey: () => "operator-a",
    canMonitorCollection: ({ ownerKey, collection, phase }) => {
      checked.push([ownerKey, collection, phase]);
      return ownerKey === "operator-a" && collection !== "customer";
    },
    health: () => true,
    store: {},
  });
  assert.ok(options);
  const event = options.definitions[0];
  assert.equal(event.name, feedbackSubmittedEventName);
  assert.deepEqual(event.inputSchema.parse({ collections: ["internal", "customer"] }), {
    collections: ["customer", "internal"],
  });
  assert.throws(() => event.inputSchema.parse({ collections: [] }));
  assert.throws(() => event.inputSchema.parse({ collections: ["internal", "internal"] }));
  assert.throws(() => event.inputSchema.parse({ collections: ["unknown"] }));
  assert.equal(await options.authorize({
    ownerKey: "operator-a", name: feedbackSubmittedEventName,
    arguments: {}, phase: "list",
  }), true);
  assert.equal(await options.authorize({
    ownerKey: "operator-a", name: feedbackSubmittedEventName,
    arguments: { collections: ["internal"] }, phase: "subscribe",
  }), true);
  assert.equal(await options.authorize({
    ownerKey: "operator-a", name: feedbackSubmittedEventName,
    arguments: { collections: ["internal", "customer"] }, phase: "refresh",
  }), false);
  assert.equal(await options.authorize({
    ownerKey: "operator-a", name: feedbackSubmittedEventName,
    arguments: { collections: ["customer"] }, phase: "delivery",
  }), false);
  const listedWire = await event.listWire("operator-a", {
    name: event.name,
    description: event.description,
    delivery: ["webhook"],
    inputSchema: {},
    payloadSchema: {},
  });
  assert.deepEqual(listedWire.inputSchema.properties.collections.items.enum, ["internal"]);
  assert.ok(checked.some((entry) => entry[2] === "refresh"));
  assert.ok(checked.some((entry) => entry[2] === "delivery"));
});

test("submission-only topology does not create an MCP Events capability", () => {
  const definition = defineFeedbackCollections({
    collections: ["customer"],
    submissions: [{ collection: "customer", access: "public" }],
  });
  assert.equal(createFeedbackSubmittedEventsOptions({
    definition,
    ownerKey: () => "customer",
    canMonitorCollection: () => false,
    health: () => true,
    store: {},
  }), undefined);
});
