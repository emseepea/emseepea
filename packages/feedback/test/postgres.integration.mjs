import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import {
  appendPostgresTeamReply,
  createPostgresFeedbackBackend,
  createPostgresFeedbackSubmissionBackend,
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
