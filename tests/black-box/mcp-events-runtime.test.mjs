import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createMcpEventRuntime } from "../../packages/framework/dist/events.js";
import { postCheckedWebhook } from "../../packages/framework/dist/events-webhook.js";
import { z } from "zod";

test("event subscription verifies, stores, filters, signs, delivers and unsubscribes", async () => {
  const subscriptions = new Map();
  const pending = new Map();
  const sent = [];
  const key = Buffer.alloc(32, 7);
  const secret = `whsec_${key.toString("base64")}`;
  let authorized = true;
  let healthy = true;
  const deliveryStatuses = [];
  const store = {
    async get(id) { return subscriptions.get(id) ?? null; },
    async put(row) { subscriptions.set(row.id, structuredClone(row)); },
    async delete(id) { subscriptions.delete(id); },
    async list(name) { return [...subscriptions.values()].filter((row) => row.name === name); },
    async enqueue(row) { pending.set(row.id, structuredClone(row)); },
    async claimDue() { return [...pending.values()].map((row) => ({ ...row, leaseId: "lease-1" })); },
    async complete(id, leaseId) { assert.equal(leaseId, "lease-1"); pending.delete(id); },
    async reschedule(row) { assert.equal(row.leaseId, "lease-1"); pending.set(row.id, structuredClone(row)); },
  };
  const runtime = createMcpEventRuntime({
    definitions: [{
      name: "comment.created", description: "A review comment was added.",
      inputSchema: z.object({ document_id: z.string() }),
      payloadSchema: z.object({ document_id: z.string(), comment_id: z.string() }),
      matches: (args, data) => args.document_id === data.document_id,
    }],
    ownerKey: () => "owner-a", authorize: async () => authorized,
    health: async () => healthy, store,
  }, async (_url, body, headers) => {
    const signature = createHmac("sha256", key)
      .update(`${headers["webhook-id"]}.${headers["webhook-timestamp"]}.`)
      .update(body).digest("base64");
    assert.equal(headers["webhook-signature"], `v1,${signature}`);
    sent.push({ body: JSON.parse(body.toString()), headers });
    const message = JSON.parse(body.toString());
    return message.type === "verification"
      ? { status: 200, body: Buffer.from(JSON.stringify({ challenge: message.challenge })) }
      : { status: deliveryStatuses.shift() ?? 204, body: Buffer.alloc(0) };
  });
  const params = {
    name: "comment.created", arguments: { document_id: "doc-1" },
    delivery: { mode: "webhook", url: "https://callback.example.com/events", secret }, cursor: null,
  };
  await assert.rejects(runtime.subscribe("owner-a", { ...params, ttlMs: -1 }));
  assert.equal(sent.length, 0);
  assert.equal(subscriptions.size, 0);
  await assert.rejects(runtime.subscribe("owner-a", {
    ...params, delivery: { ...params.delivery, url: `https://callback.example.com/${"a".repeat(9000)}` },
  }));
  assert.equal(sent.length, 0);
  const first = await runtime.subscribe("owner-a", params);
  assert.match(first.id, /^sub_[a-f0-9]{64}$/);
  assert.equal(subscriptions.size, 1);
  assert.equal(sent.length, 1);
  const again = await runtime.subscribe("owner-a", params);
  assert.equal(again.id, first.id);
  assert.equal(sent.length, 1);
  await runtime.publish("comment.created", { document_id: "doc-2", comment_id: "other" });
  assert.equal(pending.size, 0);
  await runtime.publish("comment.created", { document_id: "doc-1", comment_id: "matching" });
  assert.equal(pending.size, 1);
  await runtime.drain();
  assert.equal(pending.size, 0);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].body.data.comment_id, "matching");

  deliveryStatuses.push(503, 204);
  await runtime.publish("comment.created", { document_id: "doc-1", comment_id: "retry" });
  await runtime.drain();
  assert.equal(pending.size, 1);
  const retryId = sent.at(-1).body.eventId;
  await runtime.drain();
  assert.equal(pending.size, 0);
  assert.equal(sent.at(-1).body.eventId, retryId);

  healthy = false;
  await assert.rejects(runtime.publish("comment.created", {
    document_id: "doc-1", comment_id: "unhealthy",
  }));
  assert.equal(pending.size, 0);
  healthy = true;

  await runtime.publish("comment.created", { document_id: "doc-1", comment_id: "revoked" });
  authorized = false;
  await runtime.drain();
  assert.equal(sent.length, 4);
  assert.equal(pending.size, 0);

  await runtime.unsubscribe("owner-b", {
    name: params.name, arguments: params.arguments,
    delivery: { mode: "webhook", url: params.delivery.url },
  });
  assert.equal(subscriptions.size, 1);
  await runtime.unsubscribe("owner-a", {
    name: params.name, arguments: params.arguments,
    delivery: { mode: "webhook", url: params.delivery.url },
  });
  assert.equal(subscriptions.size, 0);
});

test("checked webhook transport refuses private destinations before connecting", async () => {
  await assert.rejects(postCheckedWebhook("https://127.0.0.1/callback", Buffer.from("{}"), {}));
  await assert.rejects(postCheckedWebhook("https://[::1]/callback", Buffer.from("{}"), {}));
});

test("hanging adopter callbacks fail closed within their configured deadline", async () => {
  const never = () => new Promise(() => {});
  const store = {
    get: never, put: never, delete: never, list: never,
    enqueue: never, claimDue: never, complete: never, reschedule: never,
  };
  const options = {
    definitions: [{
      name: "comment.created", description: "New comment",
      inputSchema: z.object({ document_id: z.string() }),
      payloadSchema: z.object({ document_id: z.string() }), matches: () => true,
    }],
    ownerKey: () => "owner-a", authorize: never, health: never,
    callbackTimeoutMs: 20, store,
  };
  const runtime = createMcpEventRuntime(options);
  const deadline = (promise) => Promise.race([
    promise, new Promise((_resolve, reject) => setTimeout(() => reject(new Error("hung")), 200)),
  ]);
  assert.equal(await deadline(runtime.ready()), false);

  const queueRuntime = createMcpEventRuntime({ ...options, health: async () => true });
  await assert.rejects(deadline(queueRuntime.list("owner-a")), /Event|deadline|timeout/);
  await assert.rejects(deadline(queueRuntime.drain()), /Event|deadline|timeout/);
});
