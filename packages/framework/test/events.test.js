import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { createMcpEventRuntime } from "../dist/events.js";

test("owner-scoped event matching isolates identical thread IDs", async () => {
  const subscriptions = ["scope-a", "scope-b"].map((ownerKey) => ({
    id: `sub-${ownerKey}`, ownerKey, name: "feedback.reply.ready",
    arguments: { threadId: "same-thread" },
    url: "https://callback.example.com/events", secret: "unused",
    expiresAt: Date.now() + 60_000,
  }));
  const queued = [];
  const runtime = createMcpEventRuntime({
    definitions: [{
      name: "feedback.reply.ready", description: "A team reply is ready.",
      inputSchema: z.object({ threadId: z.string() }),
      payloadSchema: z.object({ scope: z.string(), threadId: z.string() }),
      matches: (arguments_, data, ownerKey) =>
        arguments_.threadId === data.threadId && ownerKey === data.scope,
    }],
    ownerKey: () => "unused", authorize: () => true, health: () => true,
    store: {
      async get() { return null; }, async put() {}, async delete() {},
      async list() { return subscriptions; },
      async enqueue(delivery) { queued.push(delivery); },
      async claimDue() { return []; }, async complete() {}, async reschedule() {},
    },
  });

  await runtime.publish("feedback.reply.ready", {
    scope: "scope-a", threadId: "same-thread",
  });
  assert.deepEqual(queued.map((delivery) => delivery.subscriptionId), ["sub-scope-a"]);
});
