import { publishMcpEvent, type McpEventsOptions } from "@emseepea/server";
import { z } from "zod";
import {
  type FeedbackAdapterContext,
  feedbackEventSchema,
  feedbackSubmissionRecordedEventSchema,
} from "./index.js";
import type {
  FeedbackCollection,
  FeedbackCollectionsDefinition,
} from "./collections.js";

export const feedbackReplyEventName = "feedback.reply.ready";
export const feedbackSubmittedEventName = "feedback.submitted";

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

export type FeedbackMonitorAuthorizationPhase = "list" | "subscribe" | "refresh" | "delivery";

export interface FeedbackSubmittedEventsOptions {
  readonly definition: FeedbackCollectionsDefinition;
  /** Return the same stable scope used by feedback submission adapters. */
  readonly ownerKey: McpEventsOptions["ownerKey"];
  readonly canMonitorCollection: (request: Readonly<{
    ownerKey: string;
    collection: FeedbackCollection;
    phase: FeedbackMonitorAuthorizationPhase;
  }>) => boolean | Promise<boolean>;
  readonly health: McpEventsOptions["health"];
  readonly store: McpEventsOptions["store"];
  readonly callbackTimeoutMs?: number;
}

const maximumMonitoredCollections = 32;
const submittedReference = z.strictObject({
  collection: identifier.describe("Feedback collection containing the recorded submission."),
  submissionId: identifier.describe("Stable identifier within the feedback collection."),
  sourceEventId: identifier.describe("Identifier of the durable feedback submission event."),
});

export function createFeedbackSubmittedEventsOptions(
  options: FeedbackSubmittedEventsOptions,
): McpEventsOptions | undefined {
  const collections = options.definition.monitors.map(({ collection }) => collection);
  if (collections.length === 0) return undefined;
  if (collections.length > maximumMonitoredCollections) {
    throw new TypeError(
      `Configure no more than ${maximumMonitoredCollections} monitored feedback collections.`,
    );
  }
  if (typeof options.canMonitorCollection !== "function") {
    throw new TypeError(
      "Provide canMonitorCollection to authorize feedback submission monitoring.",
    );
  }
  const collectionSchema = z.enum(collections as [FeedbackCollection, ...FeedbackCollection[]])
    .describe("Feedback collection containing the recorded submission.");
  const subscriptionArguments = submittedSubscriptionArgumentsSchema(collectionSchema, collections.length);
  const payload = submittedReference.extend({ collection: collectionSchema });
  const authorizedCollections = async (
    ownerKey: string,
    phase: FeedbackMonitorAuthorizationPhase,
  ): Promise<FeedbackCollection[]> => {
    const allowed: FeedbackCollection[] = [];
    for (const collection of collections) {
      if (await options.canMonitorCollection({ ownerKey, collection, phase })) {
        allowed.push(collection);
      }
    }
    return allowed.sort();
  };
  return {
    definitions: [{
      name: feedbackSubmittedEventName,
      description:
        "Feedback was recorded in a subscribed collection. Read the exact record with get-feedback-submission before acting on its contents.",
      inputSchema: subscriptionArguments,
      payloadSchema: payload,
      async listWire(ownerKey, wire) {
        const visible = await authorizedCollections(ownerKey, "list");
        if (visible.length === 0) return undefined;
        const visibleCollectionSchema = z.enum(visible as [FeedbackCollection, ...FeedbackCollection[]])
          .describe("Feedback collection containing the recorded submission.");
        return Object.freeze({
          ...wire,
          inputSchema: jsonObjectSchema(
            submittedSubscriptionArgumentsSchema(visibleCollectionSchema, visible.length),
          ),
          payloadSchema: jsonObjectSchema(submittedReference.extend({ collection: visibleCollectionSchema })),
        });
      },
      matches: (arguments_, data) =>
        Array.isArray(arguments_.collections) && arguments_.collections.includes(data.collection),
    }],
    ownerKey: options.ownerKey,
    async authorize({ ownerKey, name, arguments: arguments_, phase }) {
      if (name !== feedbackSubmittedEventName) return false;
      if (phase === "list") return (await authorizedCollections(ownerKey, phase)).length > 0;
      const parsed = subscriptionArguments.safeParse(arguments_);
      if (!parsed.success) return false;
      for (const collection of parsed.data.collections) {
        if (!await options.canMonitorCollection({ ownerKey, collection, phase })) return false;
      }
      return true;
    },
    health: options.health,
    store: options.store,
    ...(options.callbackTimeoutMs === undefined ? {} : { callbackTimeoutMs: options.callbackTimeoutMs }),
  };
}

function submittedSubscriptionArgumentsSchema(
  collectionSchema: z.ZodType<FeedbackCollection>,
  maximum: number,
) {
  return z.strictObject({
    collections: z.array(collectionSchema)
      .describe("One or more authorized feedback collections to monitor.")
      .min(1)
      .max(maximum)
      .superRefine((selected, context) => {
        if (new Set(selected).size !== selected.length) {
          context.addIssue({ code: "custom", message: "List each collection once, then try again." });
        }
      })
      .overwrite((selected) => [...selected].sort()),
  });
}

function jsonObjectSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema);
  if (!json || typeof json !== "object" || Array.isArray(json) || json.type !== "object") {
    throw new TypeError("feedback submitted event schemas must describe objects");
  }
  return json;
}

/**
 * Publish a body-free submission reference from a validated durable-record event.
 * context.scope selects the event owner and must equal the stable key returned by ownerKey.
 */
export async function publishFeedbackSubmittedEvent(
  app: Parameters<typeof publishMcpEvent>[0],
  event: unknown,
  context: Pick<FeedbackAdapterContext, "scope">,
): Promise<boolean> {
  const checked = feedbackSubmissionRecordedEventSchema.parse(event);
  await publishMcpEvent(app, feedbackSubmittedEventName, submittedReference.parse({
    collection: checked.record.collection,
    submissionId: checked.record.submissionId,
    sourceEventId: checked.id,
  }), { ownerKey: context.scope });
  return true;
}
