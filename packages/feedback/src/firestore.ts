import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { feedbackConversationSchema } from "./index.js";
import type {
  FeedbackAdapterContext,
  FeedbackBackendEvent,
  FeedbackConversationBackend,
  FeedbackSubmissionBackend,
} from "./index.js";
import { beforeDeadline, deadlineSignal } from "./deadline.js";

interface FirestoreDocumentSnapshot {
  readonly id: string;
  readonly exists: boolean;
  data(): unknown;
}

interface FirestoreQuerySnapshot {
  readonly docs: readonly FirestoreDocumentSnapshot[];
}

interface FirestoreQuery {
  orderBy(field: string, direction?: "asc" | "desc"): FirestoreQuery;
  startAfter(value: unknown): FirestoreQuery;
  limit(value: number): FirestoreQuery;
}

interface FirestoreDocumentReference {
  readonly id: string;
  collection(path: string): FirestoreCollectionReference;
}

interface FirestoreCollectionReference extends FirestoreQuery {
  doc(id?: string): FirestoreDocumentReference;
}

interface FirestoreTransaction {
  get(reference: FirestoreDocumentReference | FirestoreQuery): Promise<FirestoreDocumentSnapshot | FirestoreQuerySnapshot>;
  set(reference: FirestoreDocumentReference, data: Readonly<Record<string, unknown>>): void;
  update(reference: FirestoreDocumentReference, data: Readonly<Record<string, unknown>>): void;
}

export interface FirestoreFeedbackDatabase {
  collection(path: string): FirestoreCollectionReference;
  runTransaction<T>(work: (transaction: FirestoreTransaction) => Promise<T>): Promise<T>;
}

export interface FirestoreFeedbackOptions {
  readonly database: FirestoreFeedbackDatabase;
  readonly rootCollection?: string;
  readonly outbox?: boolean;
}

export function createFirestoreFeedbackSubmissionBackend<Context = undefined>(
  options: FirestoreFeedbackOptions,
): FeedbackSubmissionBackend<Context> {
  return {
    async submit(command, context) {
      context.signal.throwIfAborted();
      const id = randomUUID();
      const recordedAt = new Date().toISOString();
      const events = [event("feedback.message.added", id, id, "user", recordedAt)];
      await runTransaction(options, context, async (transaction) => {
        context.signal.throwIfAborted();
        transaction.set(scopeRoot(options, context.scope).collection("submissions").doc(id), {
          observation: command.observation,
          detail: command.detail,
          context: JSON.parse(JSON.stringify(command.context ?? null)),
          recordedAt,
        });
        if (options.outbox) writeOutbox(transaction, options, context.scope, events);
      });
      return { id, recordedAt, events };
    },
  };
}

export function createFirestoreFeedbackBackend(
  options: FirestoreFeedbackOptions,
): FeedbackConversationBackend {
  return {
    async createThread(command, context) {
      const threadId = randomUUID();
      const messageId = randomUUID();
      const now = new Date().toISOString();
      const thread = {
        id: threadId,
        subject: command.subject,
        status: "open",
        createdAt: now,
        updatedAt: now,
        pageKey: pageKey(now, threadId),
        latestSequence: 1,
      };
      const message = {
        id: messageId,
        threadId,
        sequence: 1,
        author: "user" as const,
        kind: "comment" as const,
        body: command.message,
        createdAt: now,
      };
      const events = [
        event("feedback.thread.created", threadId, undefined, "user", now),
        event("feedback.message.added", threadId, messageId, "user", now),
      ];
      await runTransaction(options, context, async (transaction) => {
        context.signal.throwIfAborted();
        const reference = threads(options, context.scope).doc(threadId);
        transaction.set(reference, thread);
        transaction.set(reference.collection("messages").doc(messageId), message);
        if (options.outbox) writeOutbox(transaction, options, context.scope, events);
      });
      return { conversation: { ...publicThread(thread), messages: [message] }, events };
    },

    async appendMessage(command, context) {
      return runTransaction(options, context, async (transaction) => {
        context.signal.throwIfAborted();
        const reference = threads(options, context.scope).doc(command.threadId);
        const snapshot = document(await transaction.get(reference));
        if (!snapshot.exists) throw new Error("Feedback thread not found");
        const thread = threadDocument.parse(snapshot.data());
        const now = new Date().toISOString();
        const message = {
          id: randomUUID(),
          threadId: command.threadId,
          sequence: thread.latestSequence + 1,
          author: "user" as const,
          kind: "comment" as const,
          body: command.message,
          createdAt: now,
        };
        transaction.set(reference.collection("messages").doc(message.id), message);
        transaction.update(reference, {
          updatedAt: now,
          pageKey: pageKey(now, command.threadId),
          latestSequence: message.sequence,
        });
        const events = [event(
          "feedback.message.added",
          command.threadId,
          message.id,
          "user",
          now,
        )];
        if (options.outbox) writeOutbox(transaction, options, context.scope, events);
        return { message, events };
      });
    },

    async listThreads({ cursor, limit }, context) {
      context.signal.throwIfAborted();
      let query = threads(options, context.scope).orderBy("pageKey", "desc");
      if (cursor) query = query.startAfter(decodeCursor(cursor));
      query = query.limit(limit + 1);
      const snapshot = querySnapshot(await runTransaction(options, context,
        (transaction) => transaction.get(query),
      ));
      const rows = snapshot.docs.slice(0, limit + 1).map((item) => threadDocument.parse(item.data()));
      const visible = rows.slice(0, limit);
      const last = visible.at(-1);
      return {
        page: {
          threads: visible.map(publicThread),
          nextCursor: rows.length > limit && last ? encodeCursor(last.pageKey) : undefined,
        },
      };
    },

    async getThread(query, context) {
      const conversation = await runTransaction(options, context, async (transaction) => {
        context.signal.throwIfAborted();
        const reference = threads(options, context.scope).doc(query.threadId);
        const threadSnapshot = document(await transaction.get(reference));
        if (!threadSnapshot.exists) throw new Error("Feedback thread not found");
        const thread = threadDocument.parse(threadSnapshot.data());
        const messagesSnapshot = querySnapshot(await transaction.get(
          reference.collection("messages").orderBy("sequence", "asc").limit(200),
        ));
        const messages = messagesSnapshot.docs.map((item) => messageDocument.parse(item.data()));
        return { ...publicThread(thread), messages };
      });
      feedbackConversationSchema.parse(conversation);
      const pending = conversation.messages.filter(
        (message) => message.author === "team" && !message.offeredToClientAt,
      );
      if (pending.length === 0) return { conversation, events: [] };
      try {
        const receipt = await runTransaction(options, context, async (transaction) => {
          const reference = threads(options, context.scope).doc(query.threadId);
          const timestamps = new Map<string, string>();
          const unclaimed: typeof pending = [];
          for (const message of pending) {
            const messageReference = reference.collection("messages").doc(message.id);
            const snapshot = document(await transaction.get(messageReference));
            if (!snapshot.exists) throw new Error("Feedback message not found");
            const current = messageDocument.parse(snapshot.data());
            if (current.offeredToClientAt) {
              timestamps.set(message.id, current.offeredToClientAt);
              continue;
            }
            unclaimed.push(message);
          }
          const offeredAt = new Date().toISOString();
          const events: FeedbackBackendEvent[] = [];
          for (const message of unclaimed) {
            const messageReference = reference.collection("messages").doc(message.id);
            transaction.update(messageReference, { offeredToClientAt: offeredAt });
            timestamps.set(message.id, offeredAt);
            events.push(event(
              "feedback.message.offered-to-client",
              query.threadId,
              message.id,
              "team",
              offeredAt,
            ));
          }
          if (options.outbox) writeOutbox(transaction, options, context.scope, events);
          return { timestamps, events };
        });
        return {
          conversation: {
            ...conversation,
            messages: conversation.messages.map((message) => receipt.timestamps.has(message.id)
              ? { ...message, offeredToClientAt: receipt.timestamps.get(message.id) }
              : message),
          },
          events: receipt.events,
        };
      } catch {
        return { conversation, events: [] };
      }
    },
  };
}

export async function appendFirestoreTeamReply(
  options: FirestoreFeedbackOptions,
  command: Readonly<{
    scope: string;
    threadId: string;
    message: string;
    status?: string;
  }>,
  context: Readonly<{ signal: AbortSignal; deadlineMs: number }>,
): Promise<void> {
  const scope = z.string().min(1).max(240).parse(command.scope);
  const body = z.string().min(1).max(4_000).parse(command.message);
  await runTransaction(options, { ...context, scope }, async (transaction) => {
    context.signal.throwIfAborted();
    const reference = threads(options, scope).doc(command.threadId);
    const snapshot = document(await transaction.get(reference));
    if (!snapshot.exists) throw new Error("Feedback thread not found");
    const thread = threadDocument.parse(snapshot.data());
    const now = new Date().toISOString();
    const message = {
      id: randomUUID(),
      threadId: command.threadId,
      sequence: thread.latestSequence + 1,
      author: "team" as const,
      kind: "comment" as const,
      body,
      createdAt: now,
    };
    transaction.set(reference.collection("messages").doc(message.id), message);
    transaction.update(reference, {
      status: command.status ?? thread.status,
      updatedAt: now,
      pageKey: pageKey(now, command.threadId),
      latestSequence: message.sequence,
    });
    const events = [event(
      "feedback.message.added",
      command.threadId,
      message.id,
      "team",
      now,
    )];
    if (command.status && command.status !== thread.status) {
      events.push(event("feedback.status.changed", command.threadId, undefined, "team", now));
    }
    if (options.outbox) writeOutbox(transaction, options, scope, events);
  });
}

async function runTransaction<T>(
  options: FirestoreFeedbackOptions,
  context: FeedbackAdapterContext,
  work: (transaction: FirestoreTransaction) => Promise<T>,
): Promise<T> {
  return beforeDeadline(options.database.runTransaction(async (transaction) => {
    deadlineSignal(context);
    const result = await work(transaction);
    deadlineSignal(context);
    return result;
  }), context);
}

const threadDocument = z.object({
  id: z.string(),
  subject: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pageKey: z.string(),
  latestSequence: z.number().int().positive(),
});
const messageDocument = z.object({
  id: z.string(),
  threadId: z.string(),
  sequence: z.number().int().positive(),
  author: z.enum(["user", "team", "system"]),
  kind: z.enum(["comment", "question", "status"]),
  body: z.string(),
  createdAt: z.string(),
  offeredToClientAt: z.string().optional(),
});

function scopeRoot(options: FirestoreFeedbackOptions, scope: string) {
  return options.database.collection(options.rootCollection ?? "emseepeaFeedbackScopes").doc(scopeHash(scope));
}

function threads(options: FirestoreFeedbackOptions, scope: string) {
  return scopeRoot(options, scope).collection("threads");
}

function publicThread(thread: z.output<typeof threadDocument>) {
  return {
    id: thread.id,
    subject: thread.subject,
    status: thread.status,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function writeOutbox(
  transaction: FirestoreTransaction,
  options: FirestoreFeedbackOptions,
  scope: string,
  events: readonly FeedbackBackendEvent[],
): void {
  const outbox = scopeRoot(options, scope).collection("outbox");
  for (const item of events) {
    transaction.set(outbox.doc(scopeHash(item.id)), Object.fromEntries(
      Object.entries({ ...item, scope }).filter(([, value]) => value !== undefined),
    ));
  }
}

function document(value: FirestoreDocumentSnapshot | FirestoreQuerySnapshot): FirestoreDocumentSnapshot {
  if ("docs" in value) throw new Error("Firestore returned a query snapshot for a document");
  return value;
}

function querySnapshot(value: FirestoreDocumentSnapshot | FirestoreQuerySnapshot): FirestoreQuerySnapshot {
  if (!("docs" in value)) throw new Error("Firestore returned a document snapshot for a query");
  return value;
}

function scopeHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function pageKey(updatedAt: string, id: string): string {
  return `${updatedAt}|${id}`;
}

function encodeCursor(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decodeCursor(value: string): string {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    if (!/^\d{4}-\d{2}-\d{2}T.+\|.+$/.test(decoded)) throw new Error();
    return decoded;
  } catch {
    throw new Error("Invalid Firestore feedback cursor");
  }
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
