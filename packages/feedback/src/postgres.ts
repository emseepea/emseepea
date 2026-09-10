import { randomUUID } from "node:crypto";
import { z } from "zod";
import { feedbackConversationSchema } from "./index.js";
import type {
  FeedbackAdapterContext,
  FeedbackBackendEvent,
  FeedbackConversationBackend,
  FeedbackSubmissionBackend,
} from "./index.js";
import { beforeDeadline } from "./deadline.js";

interface QueryResult<Row> {
  readonly rows: readonly Row[];
  readonly rowCount: number | null;
}

export interface PostgresFeedbackClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
  release(): void;
}

export interface PostgresFeedbackPool {
  connect(): Promise<PostgresFeedbackClient>;
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export const postgresFeedbackSchema = `
CREATE TABLE IF NOT EXISTS emseepea_feedback_threads (
  scope text NOT NULL,
  id text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (scope, id)
);
CREATE TABLE IF NOT EXISTS emseepea_feedback_messages (
  scope text NOT NULL,
  thread_id text NOT NULL,
  id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  author text NOT NULL CHECK (author IN ('user', 'team', 'system')),
  kind text NOT NULL CHECK (kind IN ('comment', 'question', 'status')),
  body text NOT NULL,
  created_at timestamptz NOT NULL,
  offered_to_client_at timestamptz,
  PRIMARY KEY (scope, id),
  UNIQUE (scope, thread_id, sequence),
  FOREIGN KEY (scope, thread_id) REFERENCES emseepea_feedback_threads(scope, id)
);
CREATE INDEX IF NOT EXISTS emseepea_feedback_threads_page
  ON emseepea_feedback_threads(scope, updated_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS emseepea_feedback_submissions (
  scope text NOT NULL,
  id text NOT NULL,
  observation text NOT NULL,
  detail text NOT NULL,
  context jsonb,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (scope, id)
);
CREATE TABLE IF NOT EXISTS emseepea_feedback_outbox (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  scope text NOT NULL,
  thread_id text NOT NULL,
  message_id text,
  author text,
  dispatched_at timestamptz
);`;

export async function migratePostgresFeedback(pool: PostgresFeedbackPool): Promise<void> {
  await pool.query(postgresFeedbackSchema);
}

export interface PostgresFeedbackOptions {
  readonly pool: PostgresFeedbackPool;
  readonly outbox?: boolean;
}

export function createPostgresFeedbackSubmissionBackend<Context = undefined>(
  options: PostgresFeedbackOptions,
): FeedbackSubmissionBackend<Context> {
  return {
    submit: (command, context) => transaction(options.pool, async (client) => {
      const id = randomUUID();
      const result = await client.query<{ recorded_at: Date | string }>(`
        INSERT INTO emseepea_feedback_submissions
          (scope, id, observation, detail, context, recorded_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, clock_timestamp())
        RETURNING recorded_at
      `, [context.scope, id, command.observation, command.detail, JSON.stringify(command.context)]);
      const recordedAt = iso(result.rows[0]?.recorded_at);
      const events = [event("feedback.message.added", id, id, "user", recordedAt)];
      if (options.outbox) await writeOutbox(client, context.scope, events);
      return { id, recordedAt, events };
    }, context),
  };
}

export function createPostgresFeedbackBackend(
  options: PostgresFeedbackOptions,
): FeedbackConversationBackend {
  return {
    createThread: (command, context) => transaction(options.pool, async (client) => {
      const threadId = randomUUID();
      const messageId = randomUUID();
      const inserted = await client.query<ThreadRow>(`
        INSERT INTO emseepea_feedback_threads
          (scope, id, subject, status, created_at, updated_at)
        VALUES ($1, $2, $3, 'open', clock_timestamp(), clock_timestamp())
        RETURNING *
      `, [context.scope, threadId, command.subject]);
      const message = await insertMessage(
        client,
        context.scope,
        threadId,
        messageId,
        1,
        "user",
        "comment",
        command.message,
      );
      const thread = threadRow.parse(inserted.rows[0]);
      const events = [
        event("feedback.thread.created", threadId, undefined, "user", iso(thread.created_at)),
        event("feedback.message.added", threadId, messageId, "user", iso(message.created_at)),
      ];
      if (options.outbox) await writeOutbox(client, context.scope, events);
      return { conversation: conversation(thread, [message]), events };
    }, context),

    appendMessage: (command, context) => transaction(options.pool, async (client) => {
      const thread = await lockThread(client, context.scope, command.threadId);
      const sequenceResult = await client.query<{ sequence: number }>(`
        SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
        FROM emseepea_feedback_messages
        WHERE scope = $1 AND thread_id = $2
      `, [context.scope, command.threadId]);
      const sequence = z.coerce.number().int().positive().parse(sequenceResult.rows[0]?.sequence);
      const message = await insertMessage(
        client,
        context.scope,
        command.threadId,
        randomUUID(),
        sequence,
        "user",
        "comment",
        command.message,
      );
      await client.query(`
        UPDATE emseepea_feedback_threads SET updated_at = $3
        WHERE scope = $1 AND id = $2
      `, [context.scope, command.threadId, message.created_at]);
      const mapped = messageValue(message);
      const events = [event(
        "feedback.message.added",
        command.threadId,
        mapped.id,
        "user",
        mapped.createdAt,
      )];
      if (options.outbox) await writeOutbox(client, context.scope, events);
      void thread;
      return { message: mapped, events };
    }, context),

    listThreads: ({ cursor, limit }, context) => transaction(options.pool, async (client) => {
      const position = decodeCursor(cursor);
      const values: unknown[] = [context.scope, limit + 1];
      const condition = position
        ? "AND (updated_at, id) < ($3::timestamptz, $4)"
        : "";
      if (position) values.push(position.updatedAt, position.id);
      const result = await client.query<ThreadRow>(`
        SELECT * FROM emseepea_feedback_threads
        WHERE scope = $1 ${condition}
        ORDER BY updated_at DESC, id DESC
        LIMIT $2
      `, values);
      const rows = result.rows.map((row) => threadRow.parse(row));
      const visible = rows.slice(0, limit);
      const last = visible.at(-1);
      return {
        page: {
          threads: visible.map(threadValue),
          nextCursor: rows.length > limit && last
            ? encodeCursor(iso(last.updated_at), last.id)
            : undefined,
        },
      };
    }, context),

    async getThread(query, context) {
      const base = await transaction(options.pool, async (client) => {
        const thread = await lockThread(client, context.scope, query.threadId);
        const messages = await client.query<MessageRow>(`
          SELECT * FROM emseepea_feedback_messages
          WHERE scope = $1 AND thread_id = $2
          ORDER BY sequence
          LIMIT 200
        `, [context.scope, query.threadId]);
        return conversation(thread, messages.rows.map((row) => messageRow.parse(row)));
      }, context);
      feedbackConversationSchema.parse(base);
      try {
        const offered = await transaction(options.pool, async (client) => {
          const result = await client.query<MessageRow>(`
            UPDATE emseepea_feedback_messages
            SET offered_to_client_at = clock_timestamp()
            WHERE scope = $1 AND thread_id = $2
              AND author = 'team' AND offered_to_client_at IS NULL
            RETURNING *
          `, [context.scope, query.threadId]);
          const rows = result.rows.map((row) => messageRow.parse(row));
          const events = rows.map((message) => event(
            "feedback.message.offered-to-client",
            query.threadId,
            message.id,
            "team",
            iso(message.offered_to_client_at),
          ));
          if (options.outbox) await writeOutbox(client, context.scope, events);
          return { rows, events };
        }, context);
        const receipts = new Map(offered.rows.map((message) => [message.id, iso(message.offered_to_client_at)]));
        return {
          conversation: {
            ...base,
            messages: base.messages.map((message) => receipts.has(message.id)
              ? { ...message, offeredToClientAt: receipts.get(message.id) }
              : message),
          },
          events: offered.events,
        };
      } catch {
        return { conversation: base, events: [] };
      }
    },
  };
}

export async function appendPostgresTeamReply(
  options: PostgresFeedbackOptions,
  command: Readonly<{
    scope: string;
    threadId: string;
    message: string;
    status?: string;
  }>,
  context: Readonly<{ signal: AbortSignal; deadlineMs: number }>,
): Promise<void> {
  const scope = z.string().min(1).max(240).parse(command.scope);
  const messageBody = z.string().min(1).max(4_000).parse(command.message);
  await transaction(options.pool, async (client) => {
    await lockThread(client, scope, command.threadId);
    const next = await client.query<{ sequence: number }>(`
      SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
      FROM emseepea_feedback_messages
      WHERE scope = $1 AND thread_id = $2
    `, [scope, command.threadId]);
    const message = await insertMessage(
      client,
      scope,
      command.threadId,
      randomUUID(),
      z.coerce.number().int().positive().parse(next.rows[0]?.sequence),
      "team",
      "comment",
      messageBody,
    );
    const status = command.status === undefined
      ? undefined
      : z.string().min(1).max(80).parse(command.status);
    await client.query(`
      UPDATE emseepea_feedback_threads
      SET updated_at = $3, status = COALESCE($4, status)
      WHERE scope = $1 AND id = $2
    `, [scope, command.threadId, message.created_at, status]);
    if (options.outbox) {
      const events = [event(
        "feedback.message.added",
        command.threadId,
        message.id,
        "team",
        iso(message.created_at),
      )];
      if (status) events.push(event(
        "feedback.status.changed",
        command.threadId,
        undefined,
        "team",
        iso(message.created_at),
      ));
      await writeOutbox(client, scope, events);
    }
  }, { ...context, scope });
}

const threadRow = z.object({
  id: z.string(),
  subject: z.string(),
  status: z.string(),
  created_at: z.union([z.date(), z.string()]),
  updated_at: z.union([z.date(), z.string()]),
});
type ThreadRow = z.input<typeof threadRow> & Record<string, unknown>;
const messageRow = z.object({
  id: z.string(),
  thread_id: z.string(),
  sequence: z.coerce.number().int().positive(),
  author: z.enum(["user", "team", "system"]),
  kind: z.enum(["comment", "question", "status"]),
  body: z.string(),
  created_at: z.union([z.date(), z.string()]),
  offered_to_client_at: z.union([z.date(), z.string()]).nullable(),
});
type MessageRow = z.input<typeof messageRow> & Record<string, unknown>;

async function transaction<T>(
  pool: PostgresFeedbackPool,
  work: (client: PostgresFeedbackClient) => Promise<T>,
  context: FeedbackAdapterContext,
): Promise<T> {
  context.signal.throwIfAborted();
  let abandoned = false;
  const pendingClient = pool.connect();
  pendingClient.then((client) => {
    if (abandoned) client.release();
  }).catch(() => undefined);
  let client: PostgresFeedbackClient;
  try {
    client = await beforeDeadline(pendingClient, context);
  } catch (error) {
    abandoned = true;
    throw error;
  }
  try {
    await client.query("BEGIN");
    const remainingMs = Math.max(1, context.deadlineMs - Date.now());
    await client.query("SELECT set_config('statement_timeout', $1, true)", [String(remainingMs)]);
    context.signal.throwIfAborted();
    const result = await work(client);
    context.signal.throwIfAborted();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function lockThread(client: PostgresFeedbackClient, scope: string, id: string) {
  const result = await client.query<ThreadRow>(`
    SELECT * FROM emseepea_feedback_threads
    WHERE scope = $1 AND id = $2
    FOR UPDATE
  `, [scope, id]);
  if (result.rows.length !== 1) throw new Error("Feedback thread not found");
  return threadRow.parse(result.rows[0]);
}

async function insertMessage(
  client: PostgresFeedbackClient,
  scope: string,
  threadId: string,
  id: string,
  sequence: number,
  author: "user" | "team" | "system",
  kind: "comment" | "question" | "status",
  value: string,
) {
  const result = await client.query<MessageRow>(`
    INSERT INTO emseepea_feedback_messages
      (scope, thread_id, id, sequence, author, kind, body, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, clock_timestamp())
    RETURNING *
  `, [scope, threadId, id, sequence, author, kind, value]);
  return messageRow.parse(result.rows[0]);
}

async function writeOutbox(
  client: PostgresFeedbackClient,
  scope: string,
  events: readonly FeedbackBackendEvent[],
): Promise<void> {
  if (events.length === 0) return;
  await client.query(`
    INSERT INTO emseepea_feedback_outbox
      (event_id, event_type, occurred_at, scope, thread_id, message_id, author)
    SELECT id, type, "occurredAt"::timestamptz, $2, "threadId", "messageId", author
    FROM jsonb_to_recordset($1::jsonb)
      AS event(id text, type text, "occurredAt" text, "threadId" text, "messageId" text, author text)
    ON CONFLICT (event_id) DO NOTHING
  `, [JSON.stringify(events), scope]);
}

function conversation(thread: z.output<typeof threadRow>, messages: readonly z.output<typeof messageRow>[]) {
  return {
    ...threadValue(thread),
    messages: messages.map(messageValue),
  };
}

function threadValue(thread: z.output<typeof threadRow>) {
  return {
    id: thread.id,
    subject: thread.subject,
    status: thread.status,
    createdAt: iso(thread.created_at),
    updatedAt: iso(thread.updated_at),
  };
}

function messageValue(message: z.output<typeof messageRow>) {
  return {
    id: message.id,
    threadId: message.thread_id,
    sequence: message.sequence,
    author: message.author,
    kind: message.kind,
    body: message.body,
    createdAt: iso(message.created_at),
    offeredToClientAt: message.offered_to_client_at
      ? iso(message.offered_to_client_at)
      : undefined,
  };
}

function iso(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) throw new Error("PostgreSQL feedback timestamp missing");
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("PostgreSQL feedback timestamp invalid");
  return date.toISOString();
}

function event(
  type: FeedbackBackendEvent["type"],
  threadId: string,
  messageId: string | undefined,
  author: FeedbackBackendEvent["author"],
  occurredAt: string,
): FeedbackBackendEvent {
  return {
    id: messageId ? `${type}:${messageId}` : `${type}:${threadId}:${occurredAt}`,
    type,
    occurredAt,
    threadId,
    messageId,
    author,
  };
}

function encodeCursor(updatedAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ updatedAt, id })).toString("base64url");
}

function decodeCursor(cursor: string | undefined): { updatedAt: string; id: string } | undefined {
  if (cursor === undefined) return undefined;
  try {
    return z.strictObject({ updatedAt: z.iso.datetime(), id: z.string().min(1).max(240) })
      .parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  } catch {
    throw new Error("Invalid PostgreSQL feedback cursor");
  }
}
