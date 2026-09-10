import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { feedbackConversationSchema } from "./index.js";
import type {
  FeedbackAdapterContext,
  FeedbackBackendEvent,
  FeedbackConversationBackend,
  FeedbackMessage,
  FeedbackSubmissionBackend,
  FeedbackThread,
} from "./index.js";
import { bearerHeaders, providerRequestInit, requestJson } from "./http.js";

const ticketSchema = z.object({
  id: z.number().int().positive(),
  subject: z.string().nullable(),
  description: z.string().nullable(),
  status: z.string().min(1),
  created_at: z.string(),
  updated_at: z.string(),
  tags: z.array(z.string()).default([]),
});
const commentSchema = z.object({
  id: z.number().int().positive(),
  body: z.string(),
  public: z.boolean(),
  created_at: z.string(),
});
const ticketResponseSchema = z.object({ ticket: ticketSchema });
const commentsResponseSchema = z.object({ comments: z.array(commentSchema) });
const searchResponseSchema = z.object({ results: z.array(ticketSchema) });

const USER_MARKER = "[emseepea-feedback:user]";
const RECEIPT_MARKER = "[emseepea-feedback:offered:";

export interface ZendeskFeedbackOptions {
  readonly subdomain?: string;
  readonly baseUrl?: URL;
  readonly token: string | (() => string | Promise<string>);
  readonly requesterId?: (scope: string) => number | Promise<number>;
  readonly tags?: readonly string[];
  readonly fetch?: typeof fetch;
}

export function createZendeskFeedbackBackend(
  options: ZendeskFeedbackOptions,
): FeedbackConversationBackend {
  const fetcher = options.fetch ?? fetch;
  const base = options.baseUrl ?? zendeskUrl(options.subdomain);
  assertProviderUrl(base);

  async function call(
    path: string,
    context: FeedbackAdapterContext,
    init: RequestInit = {},
    expected: readonly number[] = [200],
  ) {
    const token = typeof options.token === "function" ? await options.token() : options.token;
    return requestJson(fetcher, new URL(path, base), providerRequestInit(context, {
      ...init,
      headers: { ...bearerHeaders(token), ...init.headers },
    }), expected);
  }

  return {
    async createThread({ subject, message }, context) {
      const requesterId = await resolveRequesterId(options, context.scope);
      const response = await call("api/v2/tickets.json", context, {
        method: "POST",
        body: JSON.stringify({
          ticket: {
            subject,
            ...(requesterId ? { requester_id: requesterId } : {}),
            comment: {
              body: `${USER_MARKER}\n${message}`,
              public: true,
              ...(requesterId ? { author_id: requesterId } : {}),
            },
            tags: [...(options.tags ?? []), zendeskScopeTag(context.scope)],
          },
        }),
      }, [201]);
      const ticket = ticketResponseSchema.parse(response.value).ticket;
      const conversation = await readConversation(call, ticket, context);
      const initial = conversation.messages[0]!;
      return {
        conversation,
        events: [
          event("feedback.thread.created", conversation.id, undefined, "user", ticket.created_at),
          event("feedback.message.added", conversation.id, initial.id, "user", initial.createdAt),
        ],
      };
    },

    async appendMessage({ threadId, message }, context) {
      const id = ticketId(threadId);
      await scopedTicket(call, id, context);
      const requesterId = await resolveRequesterId(options, context.scope);
      const correlation = randomUUID();
      await call(`api/v2/tickets/${id}.json`, context, {
        method: "PUT",
        body: JSON.stringify({
          ticket: {
            comment: {
              body: `${USER_MARKER}:${correlation}\n${message}`,
              public: true,
              ...(requesterId ? { author_id: requesterId } : {}),
            },
          },
        }),
      });
      const allComments = await ticketComments(call, id, context);
      const comment = allComments.find(({ body }) => body.startsWith(`${USER_MARKER}:${correlation}\n`));
      if (!comment) throw new Error("Zendesk did not return the appended feedback message");
      const visible = allComments.filter((item) => item.public);
      const mapped = zendeskMessage(threadId, comment, visible.findIndex(({ id }) => id === comment.id) + 1);
      return {
        message: mapped,
        events: [event("feedback.message.added", threadId, mapped.id, "user", mapped.createdAt)],
      };
    },

    async listThreads({ cursor, limit }, context) {
      const page = parsePage(cursor);
      const query = encodeURIComponent(`type:ticket tags:${zendeskScopeTag(context.scope)}`);
      const response = await call(
        `api/v2/search.json?query=${query}&per_page=${limit}&page=${page}`,
        context,
      );
      const tickets = searchResponseSchema.parse(response.value).results;
      return {
        page: {
          threads: tickets.map(zendeskThread),
          nextCursor: tickets.length === limit ? String(page + 1) : undefined,
        },
      };
    },

    async getThread({ threadId }, context) {
      const id = ticketId(threadId);
      const ticket = await scopedTicket(call, id, context);
      const before = await ticketComments(call, id, context);
      const existingReceipts = new Map<number, string>();
      for (const comment of before) {
        const receipt = receiptDetails(comment);
        if (receipt) existingReceipts.set(receipt.messageId, comment.created_at);
      }
      const conversation = mapConversation(ticket, before, existingReceipts);
      feedbackConversationSchema.parse(conversation);
      const newReceiptIds = new Set<number>();
      for (const comment of before) {
        if (!comment.public || comment.body.startsWith(USER_MARKER) || existingReceipts.has(comment.id)) continue;
        try {
          await call(`api/v2/tickets/${id}.json`, context, {
            method: "PUT",
            body: JSON.stringify({
              ticket: {
                comment: {
                  body: `${RECEIPT_MARKER}${comment.id}] Offered to the MCP client.`,
                  public: false,
                },
              },
            }),
          });
          newReceiptIds.add(comment.id);
        } catch {
          // The validated support reply is still returned when its receipt fails.
        }
      }
      let after = before;
      if (newReceiptIds.size > 0) {
        try {
          after = await ticketComments(call, id, context);
        } catch {
          return { conversation, events: [] };
        }
      }
      const newlyOffered = new Map<number, string>();
      for (const comment of after) {
        const receipt = receiptDetails(comment);
        if (receipt && newReceiptIds.has(receipt.messageId)) {
          newlyOffered.set(receipt.messageId, comment.created_at);
        }
      }
      const allReceipts = new Map([...existingReceipts, ...newlyOffered]);
      const offeredConversation = mapConversation(ticket, before, allReceipts);
      const events = [...newlyOffered].map(([messageId, offeredAt]) => event(
        "feedback.message.offered-to-client",
        threadId,
        `zendesk-comment-${messageId}`,
        "team",
        offeredAt,
      ));
      return { conversation: offeredConversation, events };
    },
  };
}

export function createZendeskFeedbackSubmissionBackend(
  options: ZendeskFeedbackOptions,
): FeedbackSubmissionBackend {
  const backend = createZendeskFeedbackBackend(options);
  return {
    async submit(command, context) {
      const result = await backend.createThread({
        subject: `Feedback: ${command.observation.replaceAll("_", " ")}`,
        message: command.detail,
      }, context);
      return {
        id: result.conversation.id,
        recordedAt: result.conversation.createdAt,
        events: result.events,
      };
    },
  };
}

type ZendeskCall = (
  path: string,
  context: FeedbackAdapterContext,
  init?: RequestInit,
  expected?: readonly number[],
) => Promise<{ readonly status: number; readonly value: unknown }>;

async function scopedTicket(call: ZendeskCall, id: number, context: FeedbackAdapterContext) {
  const response = await call(`api/v2/tickets/${id}.json`, context);
  const ticket = ticketResponseSchema.parse(response.value).ticket;
  if (!ticket.tags.includes(zendeskScopeTag(context.scope))) throw new Error("Feedback thread not found");
  return ticket;
}

async function ticketComments(call: ZendeskCall, id: number, context: FeedbackAdapterContext) {
  const response = await call(
    `api/v2/tickets/${id}/comments.json?sort_order=asc&per_page=100&page=1`,
    context,
  );
  const values = commentsResponseSchema.parse(response.value).comments;
  if (values.length === 100) {
    const overflow = await call(
      `api/v2/tickets/${id}/comments.json?sort_order=asc&per_page=1&page=101`,
      context,
    );
    if (commentsResponseSchema.parse(overflow.value).comments.length > 0) {
      throw new Error("Zendesk feedback thread exceeded the 100-comment limit");
    }
  }
  return values;
}

async function readConversation(
  call: ZendeskCall,
  ticket: z.output<typeof ticketSchema>,
  context: FeedbackAdapterContext,
) {
  const comments = await ticketComments(call, ticket.id, context);
  return mapConversation(ticket, comments, new Map());
}

function mapConversation(
  ticket: z.output<typeof ticketSchema>,
  comments: readonly z.output<typeof commentSchema>[],
  receipts: ReadonlyMap<number, string>,
) {
  const threadId = `zendesk-ticket-${ticket.id}`;
  const visible = comments.filter((item) => item.public);
  return {
    ...zendeskThread(ticket),
    messages: visible.map((comment, index) => ({
      ...zendeskMessage(threadId, comment, index + 1),
      offeredToClientAt: receipts.get(comment.id),
    })),
  };
}

function zendeskThread(ticket: z.output<typeof ticketSchema>): FeedbackThread {
  return {
    id: `zendesk-ticket-${ticket.id}`,
    subject: ticket.subject ?? "Feedback",
    status: ticket.status,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
  };
}

function zendeskMessage(
  threadId: string,
  comment: z.output<typeof commentSchema>,
  sequence: number,
): FeedbackMessage {
  const user = comment.body.startsWith(USER_MARKER);
  return {
    id: `zendesk-comment-${comment.id}`,
    threadId,
    sequence,
    author: user ? "user" : "team",
    kind: "comment",
    body: stripMarker(comment.body),
    createdAt: comment.created_at,
  };
}

function receiptDetails(comment: z.output<typeof commentSchema>) {
  if (comment.public) return undefined;
  const match = /^\[emseepea-feedback:offered:(\d+)\]/.exec(comment.body);
  return match ? { messageId: Number.parseInt(match[1]!, 10) } : undefined;
}

function stripMarker(value: string): string {
  return value.replace(/^\[emseepea-feedback:user\](?::[^\n]+)?\n?/, "").trim();
}

function ticketId(threadId: string): number {
  const match = /^zendesk-ticket-(\d+)$/.exec(threadId);
  if (!match) throw new Error("Invalid Zendesk feedback thread identifier");
  return Number.parseInt(match[1]!, 10);
}

function zendeskScopeTag(scope: string): string {
  return `emseepea_${createHash("sha256").update(scope).digest("hex").slice(0, 24)}`;
}

function zendeskUrl(subdomain: string | undefined): URL {
  if (!subdomain || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(subdomain)) {
    throw new Error("A valid Zendesk subdomain is required");
  }
  return new URL(`https://${subdomain}.zendesk.com/`);
}

async function resolveRequesterId(options: ZendeskFeedbackOptions, scope: string) {
  if (!options.requesterId) return undefined;
  return z.number().int().positive().parse(await options.requesterId(scope));
}

function assertProviderUrl(value: URL): void {
  if (value.protocol !== "https:" || value.username || value.password || value.hash) {
    throw new Error("Zendesk API URL must be HTTPS without credentials or a fragment");
  }
}

function parsePage(cursor: string | undefined): number {
  if (cursor === undefined) return 1;
  const page = Number.parseInt(cursor, 10);
  if (!Number.isSafeInteger(page) || page < 1 || String(page) !== cursor) {
    throw new Error("Invalid Zendesk feedback cursor");
  }
  return page;
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
