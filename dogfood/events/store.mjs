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
    close() { db.close(); },
  };
}
