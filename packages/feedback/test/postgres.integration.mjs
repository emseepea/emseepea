import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createEmseepea, defineResource, notifyResourceUpdated, serveEmseepea } from "@emseepea/server";
import { readMessages } from "../../../tests/fixtures/proxy-progress.mjs";
import {
  appendPostgresTeamReply,
  createPostgresFeedbackBackend,
  createPostgresFeedbackSubmissionBackend,
  createPostgresFeedbackUpdateConsumer,
  migratePostgresFeedback,
} from "../dist/postgres.js";

test("PostgreSQL stores scoped conversations, unique offer receipts, and outbox events", async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  t.after(() => pool.end());
  await migratePostgresFeedback(pool);
  const options = { pool, outbox: true };
  const backend = createPostgresFeedbackBackend(options);
  const context = {
    scope: "client-a",
    signal: new AbortController().signal,
    deadlineMs: Date.now() + 10_000,
  };

  const created = await backend.createThread({
    subject: "Search was difficult",
    message: "It took three attempts to find the filters.",
  }, context);
  const threadId = created.conversation.id;
  await Promise.all([
    backend.appendMessage({ threadId, message: "The labels were unclear." }, context),
    backend.appendMessage({ threadId, message: "The filter moved after refresh." }, context),
  ]);
  await appendPostgresTeamReply(options, {
    scope: context.scope,
    threadId,
    message: "We moved the filter and clarified its label.",
    status: "waiting_on_user",
  }, context);

  await pool.query("DROP TABLE emseepea_feedback_outbox");
  const failedReceipt = await backend.getThread({ threadId }, context);
  assert.match(failedReceipt.conversation.messages[3].body, /moved the filter/);
  assert.equal(failedReceipt.conversation.messages[3].offeredToClientAt, undefined);
  assert.deepEqual(failedReceipt.events, []);
  await migratePostgresFeedback(pool);

  const first = await backend.getThread({ threadId }, context);
  assert.equal(first.conversation.status, "waiting_on_user");
  assert.deepEqual(first.conversation.messages.map(({ sequence }) => sequence), [1, 2, 3, 4]);
  assert.equal(first.conversation.messages[3].author, "team");
  assert.ok(first.conversation.messages[3].offeredToClientAt);
  assert.deepEqual(first.events.map(({ type }) => type), ["feedback.message.offered-to-client"]);

  const second = await backend.getThread({ threadId }, context);
  assert.deepEqual(second.events, []);
  const outbox = await pool.query(`
    SELECT event_id FROM emseepea_feedback_outbox
    WHERE event_type = 'feedback.message.offered-to-client'
  `);
  assert.equal(outbox.rowCount, 1);
  await assert.rejects(
    () => backend.getThread({ threadId }, { ...context, scope: "client-b" }),
    /not found/,
  );
});

test("every scoped consumer receives late commits, retries, and all batches independently of dispatch", { timeout: 10_000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let writer;
  t.after(async () => {
    if (writer) {
      await writer.query("ROLLBACK");
      writer.release();
    }
    await pool.end();
  });
  await migratePostgresFeedback(pool);
  const scope = randomUUID();
  const otherScope = randomUUID();
  const options = { pool, scope, batchSize: 2 };
  const first = createPostgresFeedbackUpdateConsumer({ ...options, consumerId: "serving-a" });
  const second = createPostgresFeedbackUpdateConsumer({ ...options, consumerId: "serving-b" });
  const foreign = createPostgresFeedbackUpdateConsumer({ ...options, scope: otherScope, consumerId: "serving-a" });
  writer = await pool.connect();
  const insert = (client, id, eventScope = scope) => client.query(`
    INSERT INTO emseepea_feedback_outbox
      (event_id, event_type, occurred_at, scope, thread_id, author)
    VALUES ($1, 'feedback.message.added', clock_timestamp(), $2, $1, 'team')
    RETURNING occurred_at
  `, [id, eventScope]);
  const a = randomUUID();
  const b = randomUUID();
  const otherEvent = randomUUID();
  await insert(pool, otherEvent, otherScope);
  await writer.query("BEGIN");
  const insertedA = await insert(writer, a);
  const insertedB = await insert(pool, b);
  assert.ok(insertedA.rows[0].occurred_at <= insertedB.rows[0].occurred_at);
  const receivedFirst = [];
  const receivedSecond = [];
  assert.equal(await first.consume((event) => receivedFirst.push(event.id)), 1);
  assert.equal(await second.consume((event) => receivedSecond.push(event.id)), 1);
  assert.deepEqual(receivedFirst, [b]);
  assert.deepEqual(receivedSecond, [b]);
  await writer.query("COMMIT");
  assert.equal(await first.consume((event) => receivedFirst.push(event.id)), 1);
  assert.equal(await second.consume((event) => receivedSecond.push(event.id)), 1);
  assert.deepEqual(receivedFirst, [b, a]);
  assert.deepEqual(receivedSecond, [b, a]);

  const pending = Array.from({ length: 5 }, () => randomUUID());
  for (const id of pending) await insert(pool, id);
  await pool.query("UPDATE emseepea_feedback_outbox SET dispatched_at = clock_timestamp() WHERE scope = $1", [scope]);
  await assert.rejects(first.consume(() => { throw new Error("notification failed"); }), /notification failed/);
  const attempts = [];
  let failAcknowledgement = true;
  const flaky = createPostgresFeedbackUpdateConsumer({
    ...options,
    consumerId: "serving-a",
    pool: {
      query: (text, values) => {
        if (failAcknowledgement && text.includes("INSERT INTO emseepea_feedback_update_receipts")) {
          failAcknowledgement = false;
          throw new Error("connection lost while acknowledging");
        }
        return pool.query(text, values);
      },
    },
  });
  await assert.rejects(flaky.consume((event) => attempts.push(event.id)), /connection lost/);
  // Reconnect/restart with a new pool and the same stable identity.
  const reconnectedPool = new Pool({ connectionString: process.env.DATABASE_URL });
  t.after(() => reconnectedPool.end());
  const restarted = createPostgresFeedbackUpdateConsumer({ ...options, pool: reconnectedPool, consumerId: "serving-a" });
  const batchCounts = [];
  for (;;) {
    const count = await restarted.consume((event) => {
      assert.equal(event.scope, scope);
      assert.equal(event.author, "team");
      assert.equal(Object.hasOwn(event, "body"), false);
      attempts.push(event.id);
    });
    batchCounts.push(count);
    if (count === 0) break;
  }
  assert.deepEqual(batchCounts, [2, 2, 1, 0]);
  assert.equal(attempts[0], attempts[1]);
  assert.deepEqual(new Set(attempts), new Set(pending));
  while (await second.consume((event) => receivedSecond.push(event.id))) { /* drain */ }
  assert.deepEqual(new Set(receivedSecond), new Set([b, a, ...pending]));
  assert.equal(await foreign.consume((event) => {
    assert.equal(event.scope, otherScope);
    assert.equal(event.id, otherEvent);
  }), 1);
  await first.forget();
  assert.equal(await first.consume(() => undefined), 2);
  assert.equal(await second.consume(() => assert.fail("another consumer was reset")), 0);
  const partial = [randomUUID(), randomUUID()];
  for (const id of partial) await insert(pool, id);
  let delivered = 0;
  await assert.rejects(second.consume(() => {
    if (++delivered === 2) throw new Error("second notification failed");
  }), /second notification failed/);
  const retried = [];
  assert.equal(await second.consume((event) => retried.push(event.id)), 1);
  assert.deepEqual(retried, [partial[1]]);
  await pool.query(`
    INSERT INTO emseepea_feedback_outbox
      (event_id, event_type, occurred_at, scope, thread_id)
    VALUES ($1, 'feedback.message.offered-to-client', clock_timestamp(), $2, $1)
  `, [randomUUID(), scope]);
  assert.equal(await second.consume(() => assert.fail("offer receipts must not trigger update hints")), 0);
});

test("a separate worker's team reply wakes resource subscriptions on both serving instances", { timeout: 10_000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  t.after(() => pool.end());
  await migratePostgresFeedback(pool);
  const scope = randomUUID();
  const context = { scope, signal: new AbortController().signal, deadlineMs: Date.now() + 10_000 };
  const backend = createPostgresFeedbackBackend({ pool, outbox: true });
  const created = await backend.createThread({ subject: "Question", message: "Help" }, context);
  const threadId = created.conversation.id;
  const uri = `feedback://${scope}/${threadId}`;
  const consumers = [];
  const notifications = [];
  const apps = [];
  for (const consumerId of ["instance-a", "instance-b"]) {
    const servingPool = new Pool({ connectionString: process.env.DATABASE_URL });
    t.after(() => servingPool.end());
    const consumer = createPostgresFeedbackUpdateConsumer({ pool: servingPool, scope, consumerId });
    await consumer.consume(() => undefined); // Establish progress before the reply exists.
    consumers.push(consumer);
    const app = createEmseepea({
      name: consumerId, version: "0.0.0", resourceSubscriptions: {},
      resources: [defineResource({
        name: "feedback", uri, access: "public",
        handler: () => ({ contents: [{ uri, text: "Read current feedback" }] }),
      })],
    });
    apps.push(app);
    const running = await serveEmseepea(app, { port: 0 });
    t.after(() => running.close());
    const controller = new AbortController();
    const response = await fetch(running.url, {
      method: "POST", signal: controller.signal,
      headers: {
        Accept: "application/json, text/event-stream", "Content-Type": "application/json",
        "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "subscriptions/listen",
      },
      body: JSON.stringify({
        jsonrpc: "2.0", id: randomUUID(), method: "subscriptions/listen",
        params: { notifications: { resourceSubscriptions: [uri] }, _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "feedback-test", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        } },
      }),
    });
    assert.equal(response.status, 200);
    const acknowledged = Promise.withResolvers();
    const updated = Promise.withResolvers();
    notifications.push(updated.promise);
    const messages = readMessages(response, (message) => {
      if (message.method === "notifications/subscriptions/acknowledged") acknowledged.resolve();
      if (message.method === "notifications/resources/updated") updated.resolve(message.params.uri);
    });
    t.after(async () => { controller.abort(); await Promise.allSettled([messages]); });
    await Promise.race([acknowledged.promise, messages.then(() => assert.fail("missing subscription acknowledgement"))]);
  }
  await appendPostgresTeamReply({ pool, outbox: true }, { scope, threadId, message: "Worker reply" }, context);
  for (const [index, consumer] of consumers.entries()) {
    assert.equal(await consumer.consume((event) => {
      assert.equal(event.scope, scope);
      assert.equal(event.threadId, threadId);
      assert.equal(event.author, "team");
      notifyResourceUpdated(apps[index], uri);
    }), 1);
  }
  assert.deepEqual(await Promise.all(notifications), [uri, uri]);
});

test("PostgreSQL stores detailed one-way feedback", async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  t.after(() => pool.end());
  await migratePostgresFeedback(pool);
  const backend = createPostgresFeedbackSubmissionBackend({ pool });
  const result = await backend.submit({
    observation: "unexpected_good_result",
    detail: "The answer worked on the first attempt.",
    context: { feature: "pea search" },
  }, {
    scope: "client-a",
    signal: new AbortController().signal,
    deadlineMs: Date.now() + 10_000,
  });
  const stored = await pool.query(`
    SELECT observation, detail, context FROM emseepea_feedback_submissions
    WHERE id = $1
  `, [result.id]);
  assert.deepEqual(stored.rows[0], {
    observation: "unexpected_good_result",
    detail: "The answer worked on the first attempt.",
    context: { feature: "pea search" },
  });
});
