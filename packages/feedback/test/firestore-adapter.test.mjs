import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepea } from "@emseepea/server";
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";
import { definePagedFeedbackConversation } from "../dist/index.js";
import {
  appendFirestoreTeamReply,
  createFirestoreFeedbackBackend,
  createFirestoreFeedbackSubmissionBackend,
  createPagedFirestoreFeedbackBackend,
} from "../dist/firestore.js";

const context = {
  scope: "client-a",
  signal: new AbortController().signal,
  deadlineMs: Date.now() + 10_000,
};

test("Firestore keeps scoped append-only conversations and transactional offer receipts", async () => {
  const database = new FakeFirestore();
  const options = { database, outbox: true };
  const backend = createFirestoreFeedbackBackend(options);

  const created = await backend.createThread({
    subject: "The filters were hard to find",
    message: "It took three attempts.",
  }, context);
  const threadId = created.conversation.id;
  await appendFirestoreTeamReply(options, {
    scope: context.scope,
    threadId,
    message: "We moved the filters above the results.",
    status: "waiting_on_user",
  }, context);

  database.failNextUpdate = true;
  const failedReceipt = await backend.getThread({ threadId }, context);
  assert.match(failedReceipt.conversation.messages[1].body, /moved the filters/);
  assert.equal(failedReceipt.conversation.messages[1].offeredToClientAt, undefined);
  assert.deepEqual(failedReceipt.events, []);

  const read = await backend.getThread({ threadId }, context);
  assert.equal(read.conversation.status, "waiting_on_user");
  assert.deepEqual(read.conversation.messages.map(({ author }) => author), ["user", "team"]);
  assert.ok(read.conversation.messages[1].offeredToClientAt);
  assert.deepEqual(read.events.map(({ type }) => type), ["feedback.message.offered-to-client"]);

  const reread = await backend.getThread({ threadId }, context);
  assert.deepEqual(reread.events, []);
  const otherScope = { ...context, scope: "client-b" };
  await assert.rejects(() => backend.getThread({ threadId }, otherScope), /not found/);
});

test("Firestore stores detailed one-way submissions without surrounding conversation", async () => {
  const database = new FakeFirestore();
  const backend = createFirestoreFeedbackSubmissionBackend({ database });
  const result = await backend.submit({
    observation: "notable_success",
    detail: "The answer worked on the first attempt.",
    context: { feature: "pea search" },
  }, context);

  assert.ok(result.id);
  const stored = [...database.values.values()].find((value) => value.observation === "notable_success");
  assert.deepEqual(stored.context, { feature: "pea search" });
  assert.equal("conversation" in stored, false);
});

test("Firestore concurrent reads share one atomic offer receipt", async () => {
  const database = new FakeFirestore();
  const options = { database, outbox: true };
  const backend = createFirestoreFeedbackBackend(options);
  const created = await backend.createThread({ subject: "Pea support", message: "Please help." }, context);
  await appendFirestoreTeamReply(options, {
    scope: context.scope,
    threadId: created.conversation.id,
    message: "Here is the answer.",
  }, context);
  await appendFirestoreTeamReply(options, {
    scope: context.scope,
    threadId: created.conversation.id,
    message: "Here is another detail.",
  }, context);

  const reads = await Promise.all([
    backend.getThread({ threadId: created.conversation.id }, context),
    backend.getThread({ threadId: created.conversation.id }, context),
  ]);

  const firstTimestamps = reads[0].conversation.messages.slice(1).map(({ offeredToClientAt }) => offeredToClientAt);
  const secondTimestamps = reads[1].conversation.messages.slice(1).map(({ offeredToClientAt }) => offeredToClientAt);
  assert.equal(firstTimestamps.every(Boolean), true);
  assert.deepEqual(firstTimestamps, secondTimestamps);
  assert.equal(reads.flatMap(({ events }) => events).length, 2);
  assert.equal([...database.values.values()].filter(
    ({ type }) => type === "feedback.message.offered-to-client",
  ).length, 2);
});

test("paged Firestore feedback returns exact messages through sequence 201 and records only page offers", async () => {
  const database = new FakeFirestore();
  const options = { database, outbox: true, maxResultBytes: 50_000 };
  const backend = createPagedFirestoreFeedbackBackend(options);
  const created = await backend.createThread({ subject: "Follow-up", message: "Original report." }, context);
  const threadId = created.conversation.id;
  const message = "\u0000".repeat(3_999) + "字";
  await appendFirestoreTeamReply(options, { scope: context.scope, threadId, message }, context);
  await appendFirestoreTeamReply(options, { scope: context.scope, threadId, message }, context);
  await appendFirestoreTeamReply(options, { scope: context.scope, threadId, message }, context);
  for (let sequence = 5; sequence < 201; sequence++) {
    await backend.appendMessage({ threadId, message: "More context." }, context);
  }
  await appendFirestoreTeamReply(options, { scope: context.scope, threadId, message }, context);
  const other = await backend.createThread({ subject: "Another thread", message: "Separate report." }, context);

  database.failNextUpdate = true;
  const failedReceipt = await backend.getThreadPage({ threadId }, context);
  assert.equal(failedReceipt.conversation.messages[1].body, message);
  assert.equal(failedReceipt.conversation.messages[1].offeredToClientAt, undefined);
  assert.deepEqual(failedReceipt.events, []);

  const first = await backend.getThreadPage({ threadId }, context);
  assert.deepEqual(first.conversation.messages.map(({ sequence }) => sequence), [1, 2, 3]);
  const cursor = first.conversation.nextCursor;
  assert.ok(cursor);
  assert.doesNotMatch(Buffer.from(cursor, "base64url").toString(), /client-a/);
  await assert.rejects(() => backend.getThreadPage({ threadId: other.conversation.id, cursor }, context), /cursor/);
  await assert.rejects(() => backend.getThreadPage({ threadId, cursor }, { ...context, scope: "client-b" }), /cursor/);
  const offers = () => [...database.values.values()].filter((entry) => entry.threadId === threadId && entry.offeredToClientAt);
  assert.deepEqual(offers().map(({ sequence }) => sequence), [2, 3]);

  const messages = [...first.conversation.messages];
  let nextCursor = cursor;
  while (nextCursor) {
    const page = (await backend.getThreadPage({ threadId, cursor: nextCursor }, context)).conversation;
    messages.push(...page.messages);
    nextCursor = page.nextCursor;
  }
  assert.deepEqual(messages.map(({ sequence }) => sequence), Array.from({ length: 201 }, (_, index) => index + 1));
  assert.equal(messages[0].body, "Original report.");
  assert.equal(messages.at(-1).body, message);
  assert.deepEqual(offers().map(({ sequence }) => sequence), [2, 3, 4, 201]);
});

test("paged Firestore feedback caps an explicit 50-thread list by bytes and keeps its cursor", async () => {
  const database = new FakeFirestore();
  const backend = createPagedFirestoreFeedbackBackend({ database, maxResultBytes: 50_000 });
  const subject = "\u0000".repeat(199) + "字";
  for (let index = 0; index < 50; index++) {
    await backend.createThread({ subject, message: "Original report." }, context);
  }
  const first = (await backend.listThreads({ limit: 50 }, context)).page;
  assert.ok(first.threads.length < 50 && first.nextCursor);
  const second = (await backend.listThreads({ limit: 50, cursor: first.nextCursor }, context)).page;
  const all = [...first.threads, ...second.threads];
  assert.equal(all.length, 50);
  assert.equal(new Set(all.map(({ id }) => id)).size, 50);
  assert.ok(all.every((thread) => thread.subject === subject));
  assert.equal(second.nextCursor, undefined);
});

test("paged Firestore feedback leaves offers untouched when the first message cannot fit", async () => {
  const database = new FakeFirestore();
  assert.throws(() => createPagedFirestoreFeedbackBackend({ database, maxResultBytes: 29_999 }), /result budget/);
  const options = { database, maxResultBytes: 30_000 };
  const backend = createPagedFirestoreFeedbackBackend(options);
  const { conversation } = await backend.createThread({ subject: "Support", message: "Original report." }, context);
  await appendFirestoreTeamReply(options, { scope: context.scope, threadId: conversation.id, message: "A reply." }, context);
  const team = [...database.values.values()].find(({ author }) => author === "team");
  team.createdAt = `2026-09-10T00:00:00.${"1".repeat(31_000)}Z`;
  const initial = await backend.getThreadPage({ threadId: conversation.id }, context);
  assert.equal(initial.conversation.messages.length, 1);
  await assert.rejects(() => backend.getThreadPage({
    threadId: conversation.id, cursor: initial.conversation.nextCursor,
  }, context), /result budget/);
  assert.equal([...database.values.values()].find(({ author }) => author === "team").offeredToClientAt, undefined);
});

test("a paged offer cannot predate a reply appended before the page snapshot", async (t) => {
  const now = Date.now();
  t.mock.timers.enable({ apis: ["Date"], now });
  const database = new FakeFirestore();
  const options = { database, maxResultBytes: 50_000 };
  const backend = createPagedFirestoreFeedbackBackend(options);
  const { conversation } = await backend.createThread({ subject: "Support", message: "Original report." }, context);
  const threadId = conversation.id;
  const runTransaction = database.runTransaction.bind(database);
  database.runTransaction = async (work) => {
    database.runTransaction = runTransaction;
    t.mock.timers.setTime(now + 100);
    await appendFirestoreTeamReply(options, { scope: context.scope, threadId, message: "A later reply." }, context);
    return runTransaction(work);
  };
  const { messages } = (await backend.getThreadPage({ threadId }, context)).conversation;
  assert.equal(messages[1].createdAt, new Date(now + 100).toISOString());
  assert.equal(messages[1].offeredToClientAt, messages[1].createdAt);
});

test("native paged tools carry exact full-length messages without duplicating structured data in text", async (t) => {
  const database = new FakeFirestore();
  const options = { database, maxResultBytes: 50_000 };
  const backend = createPagedFirestoreFeedbackBackend(options);
  const body = "\u0000".repeat(3_999) + "字";
  const { conversation } = await backend.createThread({ subject: "Feedback", message: "Original report." }, context);
  const threadId = conversation.id;
  for (let index = 0; index < 3; index++) {
    await appendFirestoreTeamReply(options, { scope: context.scope, threadId, message: body }, context);
  }
  const running = await startEmseepea(t, createEmseepea({
    name: "paged-feedback-test",
    version: "0.0.0",
    maxApplicationResultBytes: options.maxResultBytes,
    authentication: insecureTestAuthentication(["feedback"]),
    tools: definePagedFeedbackConversation({
      requiredScopes: ["feedback"], backend, scope: () => context.scope,
    }),
  }));
  const client = await running.connect("test-token");
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(({ name }) => name), ["reply-to-feedback-thread", "list-feedback-threads", "get-feedback-thread"]);
  const first = await client.callTool({ name: "get-feedback-thread", arguments: { threadId } });
  assert.equal(first.isError, false);
  assert.deepEqual(first.structuredContent.messages.map(({ body: text }) => text), ["Original report.", body, body]);
  assert.match(first.content[0].text, /next page/);
  const next = await client.callTool({
    name: "get-feedback-thread",
    arguments: { threadId, cursor: first.structuredContent.nextCursor },
  });
  assert.equal(next.isError, false);
  assert.equal(next.structuredContent.messages[0].body, body);
  assert.equal(next.structuredContent.nextCursor, undefined);
  const reply = await client.callTool({ name: "reply-to-feedback-thread", arguments: { threadId, message: body } });
  assert.equal(reply.isError, false);
  assert.equal(reply.structuredContent.body, body);
  assert.equal(reply.content[0].text, "Feedback reply saved.");
});

function compareOrder(left, right) {
  return typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right));
}

class FakeFirestore {
  values = new Map();
  failNextUpdate = false;
  transactionTail = Promise.resolve();

  collection(path) {
    return new FakeCollection(this, path);
  }

  runTransaction(work) {
    const result = this.transactionTail.then(() => work(new FakeTransaction(this)));
    this.transactionTail = result.catch(() => undefined);
    return result;
  }
}

class FakeReference {
  constructor(database, path) {
    this.database = database;
    this.path = path;
    this.id = path.split("/").at(-1);
  }

  collection(path) {
    return new FakeCollection(this.database, `${this.path}/${path}`);
  }
}

class FakeCollection {
  constructor(database, path, order, start, maximum) {
    this.database = database;
    this.path = path;
    this.order = order;
    this.start = start;
    this.maximum = maximum;
  }

  doc(id = `auto-${this.database.values.size + 1}`) {
    return new FakeReference(this.database, `${this.path}/${id}`);
  }

  orderBy(field, direction = "asc") {
    return new FakeCollection(this.database, this.path, { field, direction }, this.start, this.maximum);
  }

  startAfter(value) {
    return new FakeCollection(this.database, this.path, this.order, value, this.maximum);
  }

  limit(value) {
    return new FakeCollection(this.database, this.path, this.order, this.start, value);
  }
}

class FakeTransaction {
  constructor(database) {
    this.database = database;
  }

  async get(target) {
    if (this.wrote) throw new Error("Firestore transaction read after write");
    if (target instanceof FakeReference) {
      return snapshot(target.id, this.database.values.get(target.path));
    }
    const prefix = `${target.path}/`;
    const depth = target.path.split("/").length + 1;
    let values = [...this.database.values]
      .filter(([path]) => path.startsWith(prefix) && path.split("/").length === depth)
      .map(([path, value]) => snapshot(path.split("/").at(-1), value));
    if (target.order) {
      const direction = target.order.direction === "desc" ? -1 : 1;
      values.sort((left, right) => direction * compareOrder(left.data()[target.order.field], right.data()[target.order.field]));
      if (target.start !== undefined) {
        values = values.filter((item) => direction * compareOrder(item.data()[target.order.field], target.start) > 0);
      }
    }
    return { docs: values.slice(0, target.maximum) };
  }

  set(reference, data) {
    this.wrote = true;
    this.database.values.set(reference.path, structuredClone(data));
  }

  update(reference, data) {
    this.wrote = true;
    if (this.database.failNextUpdate) {
      this.database.failNextUpdate = false;
      throw new Error("simulated receipt failure");
    }
    const current = this.database.values.get(reference.path);
    if (!current) throw new Error("missing document");
    this.database.values.set(reference.path, { ...current, ...structuredClone(data) });
  }
}

function snapshot(id, value) {
  return {
    id,
    exists: value !== undefined,
    data: () => value === undefined ? undefined : structuredClone(value),
  };
}
