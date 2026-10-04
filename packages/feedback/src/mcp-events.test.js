import assert from "node:assert/strict";
import test from "node:test";
import { createMcpEventRuntime } from "../../framework/dist/events.js";
import { createFeedbackReplyEventsOptions } from "../dist/mcp-events.js";

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
