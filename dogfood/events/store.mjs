import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

// A single-file store for the one-process ChatGPT smoke test. SQLite keeps
// subscriptions and queued deliveries across a process restart.
export function openStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, name TEXT NOT NULL, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS deliveries (id TEXT PRIMARY KEY, body TEXT NOT NULL, lease_id TEXT, lease_until INTEGER);
    CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS feedback_threads (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      body TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feedback_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      owner_key TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      body TEXT NOT NULL,
      UNIQUE (thread_id, sequence)
    );
  `);
  const subscription = {
    async get(id) {
      const row = db.prepare("SELECT body FROM subscriptions WHERE id = ?").get(id);
      return row ? JSON.parse(row.body) : null;
    },
    async put(value) {
      db.prepare("INSERT INTO subscriptions (id, name, body) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, body=excluded.body")
        .run(value.id, value.name, JSON.stringify(value));
    },
    async delete(id) { db.prepare("DELETE FROM subscriptions WHERE id = ?").run(id); },
    async list(name) {
      return db.prepare("SELECT body FROM subscriptions WHERE name = ?").all(name).map((row) => JSON.parse(row.body));
    },
    async enqueue(value) {
      db.prepare("INSERT OR IGNORE INTO deliveries (id, body) VALUES (?, ?)").run(value.id, JSON.stringify(value));
    },
    async claimDue(limit, now, leaseMs) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const rows = db.prepare("SELECT id, body FROM deliveries WHERE lease_id IS NULL OR lease_until <= ?").all(now)
          .map((row) => ({ id: row.id, ...JSON.parse(row.body) }))
          .filter((row) => row.nextAttemptAt <= now).slice(0, limit);
        const claimed = rows.map((row) => ({ ...row, leaseId: randomUUID() }));
        const update = db.prepare("UPDATE deliveries SET lease_id = ?, lease_until = ? WHERE id = ?");
        for (const row of claimed) update.run(row.leaseId, now + leaseMs, row.id);
        db.exec("COMMIT");
        return claimed;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    async complete(id, leaseId) {
      db.prepare("DELETE FROM deliveries WHERE id = ? AND lease_id = ?").run(id, leaseId);
    },
    async reschedule(value) {
      const { leaseId, ...next } = value;
      db.prepare("UPDATE deliveries SET body = ?, lease_id = NULL, lease_until = NULL WHERE id = ? AND lease_id = ?")
        .run(JSON.stringify(next), value.id, leaseId);
    },
  };
  return {
    subscription,
    healthy() { return db.prepare("SELECT 1 AS ok").get().ok === 1; },
    addNote(text) {
      const note = { id: randomUUID(), text, createdAt: new Date().toISOString() };
      db.prepare("INSERT INTO notes (id, body) VALUES (?, ?)").run(note.id, JSON.stringify(note));
      return note;
    },
    getNote(id) {
      const row = db.prepare("SELECT body FROM notes WHERE id = ?").get(id);
      return row ? JSON.parse(row.body) : null;
    },
    feedback: {
      async createThread(command, context) {
        const now = new Date().toISOString();
        const thread = {
          id: randomUUID(), subject: command.subject, status: "open",
          createdAt: now, updatedAt: now,
        };
        const message = {
          id: randomUUID(), threadId: thread.id, sequence: 1, author: "user",
          kind: "comment", body: command.message, createdAt: now,
        };
        db.exec("BEGIN IMMEDIATE");
        try {
          db.prepare("INSERT INTO feedback_threads (id, owner_key, body) VALUES (?, ?, ?)")
            .run(thread.id, context.scope, JSON.stringify(thread));
          db.prepare("INSERT INTO feedback_messages (id, thread_id, owner_key, sequence, body) VALUES (?, ?, ?, ?, ?)")
            .run(message.id, thread.id, context.scope, message.sequence, JSON.stringify(message));
          db.exec("COMMIT");
        } catch (error) { db.exec("ROLLBACK"); throw error; }
        return { conversation: { ...thread, messages: [message] } };
      },
      async appendMessage(command, context) {
        const message = appendMessage(context.scope, command.threadId, "user", command.message);
        return { message };
      },
      async listThreads(query, context) {
        const rows = db.prepare("SELECT body FROM feedback_threads WHERE owner_key = ? ORDER BY rowid DESC LIMIT ?")
          .all(context.scope, query.limit);
        return { page: { threads: rows.map((row) => JSON.parse(row.body)) } };
      },
      async getThread(query, context) {
        const thread = getThread(context.scope, query.threadId);
        if (!thread) throw new Error("Feedback thread not found");
        const rows = db.prepare("SELECT id, body FROM feedback_messages WHERE owner_key = ? AND thread_id = ? ORDER BY sequence")
          .all(context.scope, query.threadId);
        const offeredAt = new Date().toISOString();
        const messages = rows.map((row) => {
          const message = JSON.parse(row.body);
          if (message.author !== "team" || message.offeredToClientAt) return message;
          const offered = { ...message, offeredToClientAt: offeredAt };
          db.prepare("UPDATE feedback_messages SET body = ? WHERE id = ? AND owner_key = ?")
            .run(JSON.stringify(offered), row.id, context.scope);
          return offered;
        });
        return { conversation: { ...thread, messages } };
      },
    },
    canReadFeedbackThread(ownerKey, threadId) {
      return getThread(ownerKey, threadId) !== null;
    },
    feedbackOwnerForThread(threadId) {
      const row = db.prepare("SELECT owner_key FROM feedback_threads WHERE id = ?").get(threadId);
      return row?.owner_key ?? null;
    },
    appendTeamReply(ownerKey, threadId, text) {
      const message = appendMessage(ownerKey, threadId, "team", text);
      return {
        message,
        event: {
          id: randomUUID(), type: "feedback.message.added",
          occurredAt: message.createdAt, scope: ownerKey, threadId,
          messageId: message.id, author: "team",
        },
      };
    },
    close() { db.close(); },
  };

  function getThread(ownerKey, threadId) {
    const row = db.prepare("SELECT body FROM feedback_threads WHERE id = ? AND owner_key = ?")
      .get(threadId, ownerKey);
    return row ? JSON.parse(row.body) : null;
  }

  function appendMessage(ownerKey, threadId, author, text) {
    const thread = getThread(ownerKey, threadId);
    if (!thread) throw new Error("Feedback thread not found");
    const now = new Date().toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      const sequence = db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM feedback_messages WHERE thread_id = ? AND owner_key = ?")
        .get(threadId, ownerKey).next;
      const message = {
        id: randomUUID(), threadId, sequence, author, kind: "comment", body: text, createdAt: now,
      };
      const updatedThread = { ...thread, updatedAt: now };
      db.prepare("INSERT INTO feedback_messages (id, thread_id, owner_key, sequence, body) VALUES (?, ?, ?, ?, ?)")
        .run(message.id, threadId, ownerKey, sequence, JSON.stringify(message));
      db.prepare("UPDATE feedback_threads SET body = ? WHERE id = ? AND owner_key = ?")
        .run(JSON.stringify(updatedThread), threadId, ownerKey);
      db.exec("COMMIT");
      return message;
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
}
