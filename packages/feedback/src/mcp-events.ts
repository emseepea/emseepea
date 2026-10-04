import { publishMcpEvent, type McpEventsOptions } from "@emseepea/server";
import { z } from "zod";
import { feedbackEventSchema } from "./index.js";

export const feedbackReplyEventName = "feedback.reply.ready";

const identifier = z.string().min(1).max(240);
const threadArguments = z.strictObject({
  threadId: identifier.describe("Exact feedback thread to watch for a team reply."),
});
const replyReference = z.strictObject({
  scope: identifier,
  threadId: identifier,
  messageId: identifier,
  sourceEventId: identifier,
});

export interface FeedbackReplyEventsOptions {
  /** Use the same stable scope projection as defineFeedbackConversation. */
  readonly ownerKey: McpEventsOptions["ownerKey"];
  /** Check access to this exact thread, including when a delivery is due. */
  readonly canReadThread: (ownerKey: string, threadId: string) => boolean | Promise<boolean>;
  readonly health: McpEventsOptions["health"];
  readonly store: McpEventsOptions["store"];
  readonly callbackTimeoutMs?: number;
}

export function createFeedbackReplyEventsOptions(options: FeedbackReplyEventsOptions): McpEventsOptions {
  if (typeof options?.canReadThread !== "function")
    throw new TypeError("feedback reply events require canReadThread");
  return {
    definitions: [{
      name: feedbackReplyEventName,
      description: "A team reply is ready. Read the exact thread with get-feedback-thread and present the reply to the user.",
      inputSchema: threadArguments,
      payloadSchema: replyReference,
      matches: (arguments_, data, ownerKey) =>
        arguments_.threadId === data.threadId && ownerKey === data.scope,
    }],
    ownerKey: options.ownerKey,
    async authorize({ ownerKey, name, arguments: arguments_, phase }) {
      if (name !== feedbackReplyEventName) return false;
      if (phase === "list") return true;
      const parsed = threadArguments.safeParse(arguments_);
      return parsed.success && await options.canReadThread(ownerKey, parsed.data.threadId);
    },
    health: options.health,
    store: options.store,
    ...(options.callbackTimeoutMs === undefined ? {} : { callbackTimeoutMs: options.callbackTimeoutMs }),
  };
}

/** Publish a durable team reply reference after the feedback backend commits it. */
export async function publishFeedbackTeamReplyEvent(
  app: Parameters<typeof publishMcpEvent>[0],
  event: unknown,
): Promise<boolean> {
  const checked = feedbackEventSchema.safeParse(event);
  if (!checked.success) throw new TypeError("Invalid feedback event");
  if (checked.data.type !== "feedback.message.added" || checked.data.author !== "team") return false;
  if (!checked.data.messageId) throw new TypeError("Team reply event requires messageId");
  await publishMcpEvent(app, feedbackReplyEventName, replyReference.parse({
    scope: checked.data.scope,
    threadId: checked.data.threadId,
    messageId: checked.data.messageId,
    sourceEventId: checked.data.id,
  }));
  return true;
}
