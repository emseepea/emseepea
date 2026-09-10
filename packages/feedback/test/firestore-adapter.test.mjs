import assert from "node:assert/strict";
import test from "node:test";
import {
  appendFirestoreTeamReply,
  createFirestoreFeedbackBackend,
  createFirestoreFeedbackSubmissionBackend,
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
      values.sort((left, right) => direction * String(left.data()[target.order.field])
        .localeCompare(String(right.data()[target.order.field])));
      if (target.start !== undefined) {
        values = values.filter((item) => direction * String(item.data()[target.order.field])
          .localeCompare(String(target.start)) > 0);
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
