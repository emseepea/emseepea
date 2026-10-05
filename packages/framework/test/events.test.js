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

test("existing subscriptions use an independently authorized refresh phase", async () => {
  const rows = new Map();
  const phases = [];
  let allowed = true;
  let challenges = 0;
  let writes = 0;
  const secret = `whsec_${Buffer.alloc(32, 5).toString("base64")}`;
  const runtime = createMcpEventRuntime({
    definitions: [{
      name: "feedback.submitted", description: "Feedback was recorded.",
      inputSchema: z.object({ collections: z.array(z.string()).min(1) }),
      payloadSchema: z.object({ collection: z.string(), submissionId: z.string() }),
      matches: (arguments_, data) => arguments_.collections.includes(data.collection),
    }],
    ownerKey: () => "owner-a",
    authorize: ({ phase }) => { phases.push(phase); return allowed; },
    health: () => true,
    store: {
      async get(id) { return rows.get(id) ?? null; },
      async put(row) { writes += 1; rows.set(row.id, structuredClone(row)); },
      async delete(id) { rows.delete(id); },
      async list() { return [...rows.values()]; },
      async enqueue() {}, async claimDue() { return []; }, async complete() {}, async reschedule() {},
    },
  }, async (_url, body) => {
    challenges += 1;
    return {
      status: 200,
      body: Buffer.from(JSON.stringify({ challenge: JSON.parse(body.toString()).challenge })),
    };
  });
  const params = {
    name: "feedback.submitted",
    arguments: { collections: ["internal"] },
    delivery: { mode: "webhook", url: "https://callback.example.com/events", secret },
  };
  await runtime.subscribe("owner-a", params);
  await runtime.subscribe("owner-a", params);
  assert.deepEqual(phases, ["subscribe", "refresh"]);
  assert.equal(challenges, 1);
  assert.equal(writes, 2);

  allowed = false;
  await assert.rejects(() => runtime.subscribe("owner-a", params), /invalid event subscription/i);
  assert.deepEqual(phases, ["subscribe", "refresh", "refresh"]);
  assert.equal(challenges, 1);
  assert.equal(writes, 2);
});

test("owner-targeted events never enter another authorized owner's queue", async () => {
  const subscriptions = ["scope-a", "scope-b"].map((ownerKey) => ({
    id: `sub-${ownerKey}`, ownerKey, name: "feedback.submitted",
    arguments: { collections: ["internal"] },
    url: "https://callback.example.com/events", secret: "unused",
    expiresAt: Date.now() + 60_000,
  }));
  const queued = [];
  const runtime = createMcpEventRuntime({
    definitions: [{
      name: "feedback.submitted", description: "Feedback was recorded.",
      inputSchema: z.object({ collections: z.array(z.string()).min(1) }),
      payloadSchema: z.object({ collection: z.string(), submissionId: z.string() }),
      matches: (arguments_, data) => arguments_.collections.includes(data.collection),
    }],
    ownerKey: () => "unused", authorize: () => true, health: () => true,
    store: {
      async get() { return null; }, async put() {}, async delete() {},
      async list() { return subscriptions; },
      async enqueue(delivery) { queued.push(delivery); },
      async claimDue() { return []; }, async complete() {}, async reschedule() {},
    },
  });

  await runtime.publish("feedback.submitted", {
    collection: "internal", submissionId: "submission-1",
  }, { ownerKey: "scope-a" });
  assert.equal(queued.length, 1);
  assert.deepEqual(queued.map((delivery) => delivery.subscriptionId), ["sub-scope-a"]);
  assert.doesNotMatch(queued[0].body, /scope-a|ownerKey/);
  await assert.rejects(() => runtime.publish("feedback.submitted", {
    collection: "internal", submissionId: "submission-2",
  }, { ownerKey: "" }), /Set audience\.ownerKey to a stable, non-empty key of at most 256 bytes\./);
  assert.equal(queued.length, 1);
});

test("event catalogue projections remain behind list authorization and preserve the checked wire", async () => {
  let authorized = false;
  let projected = 0;
  const runtime = createMcpEventRuntime({
    definitions: [{
      name: "feedback.submitted", description: "Feedback was recorded.",
      inputSchema: z.object({ collections: z.array(z.string()).min(1) }),
      payloadSchema: z.object({ collection: z.string(), submissionId: z.string() }),
      listWire(_ownerKey, wire) {
        projected += 1;
        return { ...wire, name: "feedback.changed" };
      },
      matches: () => true,
    }],
    ownerKey: () => "owner-a",
    authorize: ({ phase }) => phase === "list" && authorized,
    health: () => true,
    store: {
      async get() { return null; }, async put() {}, async delete() {}, async list() { return []; },
      async enqueue() {}, async claimDue() { return []; }, async complete() {}, async reschedule() {},
    },
  });
  assert.deepEqual(await runtime.list("owner-a"), []);
  assert.equal(projected, 0);
  authorized = true;
  await assert.rejects(
    () => runtime.list("owner-a"),
    /Return an event catalogue projection that preserves the checked event name, description, delivery mode, and object schemas\./,
  );
  assert.equal(projected, 1);
});
