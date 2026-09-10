import {
  defineTool,
  type EmseepeaTool,
  type Principal,
  type ToolContext,
} from "@emseepea/server";
import { z } from "zod";
import { beforeDeadline, deadlineSignal } from "./deadline.js";

const identifier = z.string().min(1).max(240);
const timestamp = z.iso.datetime({ offset: true });
const body = z.string().min(1).max(4_000);

export const feedbackObservationSchema = z.enum([
  "error",
  "friction",
  "annoyance",
  "unnecessary_difficulty",
  "confusion",
  "repetition",
  "unexpected_good_result",
  "unexpected_bad_result",
  "capability_mismatch",
  "suggestion",
  "notable_success",
]).describe("The single notable observation being recorded.");

export const feedbackMessageSchema = z.strictObject({
  id: identifier.describe("Stable message identifier."),
  threadId: identifier.describe("Stable identifier of the containing feedback thread."),
  sequence: z.number().int().positive().describe("Stable one-based position in the thread."),
  author: z.enum(["user", "team", "system"]).describe("Who authored the message."),
  kind: z.enum(["comment", "question", "status"]).describe("Purpose of the message."),
  body: body.describe("Message text that is safe to present in the feedback conversation."),
  createdAt: timestamp.describe("When the message was created."),
  offeredToClientAt: timestamp.optional().describe(
    "When this team message was first included in a tool result. This does not prove human attention or comprehension.",
  ),
});

export const feedbackThreadSchema = z.strictObject({
  id: identifier.describe("Stable feedback thread identifier."),
  subject: z.string().min(1).max(200).describe("Short description of the feedback topic."),
  status: z.string().min(1).max(80).describe("Current backend or support-system status."),
  createdAt: timestamp.describe("When the thread was created."),
  updatedAt: timestamp.describe("When the thread last changed."),
});

export const feedbackConversationSchema = feedbackThreadSchema.extend({
  messages: z.array(feedbackMessageSchema).max(200).describe(
    "Messages in stable sequence order. Private support notes are excluded.",
  ),
});

export type FeedbackObservation = z.output<typeof feedbackObservationSchema>;
export type FeedbackMessage = z.output<typeof feedbackMessageSchema>;
export type FeedbackThread = z.output<typeof feedbackThreadSchema>;
export type FeedbackConversation = z.output<typeof feedbackConversationSchema>;

export interface FeedbackAdapterContext {
  readonly scope: string;
  readonly signal: AbortSignal;
  readonly deadlineMs: number;
}

const feedbackEventTypeSchema = z.enum([
  "feedback.thread.created",
  "feedback.message.added",
  "feedback.status.changed",
  "feedback.message.offered-to-client",
]);
export const feedbackEventSchema = z.strictObject({
  id: identifier,
  type: feedbackEventTypeSchema,
  occurredAt: timestamp,
  scope: identifier,
  threadId: identifier,
  messageId: identifier.optional(),
  author: z.enum(["user", "team", "system"]).optional(),
});

export type FeedbackEvent = z.output<typeof feedbackEventSchema>;
export type FeedbackEventHook = (
  event: Readonly<FeedbackEvent>,
  context: Readonly<{ signal: AbortSignal; deadlineMs: number }>,
) => void | Promise<void>;

export interface FeedbackSubmissionBackend<Context = undefined> {
  submit(
    command: Readonly<{
      observation: FeedbackObservation;
      detail: string;
      context: Context;
    }>,
    context: FeedbackAdapterContext,
  ): FeedbackSubmissionResult | Promise<FeedbackSubmissionResult>;
}

const backendEventSchema = feedbackEventSchema.omit({ scope: true });
const backendEventsSchema = z.array(backendEventSchema).max(100).optional();
export type FeedbackBackendEvent = z.input<typeof backendEventSchema>;

const submissionResultSchema = z.strictObject({
  id: identifier.describe("Stable feedback submission identifier."),
  recordedAt: timestamp.describe("When the feedback was durably recorded."),
  events: backendEventsSchema,
});
export type FeedbackSubmissionResult = z.input<typeof submissionResultSchema>;

export interface FeedbackSubmissionOptions<ContextSchema extends z.ZodType = z.ZodUndefined> {
  readonly access: "public" | "protected";
  readonly requiredScopes?: readonly string[];
  readonly scope?: string | ((principal: Principal | undefined) => string);
  readonly contextSchema?: ContextSchema;
  readonly backend: FeedbackSubmissionBackend<z.output<ContextSchema>>;
  readonly hooks?: readonly FeedbackEventHook[];
}

export function defineFeedbackSubmission<ContextSchema extends z.ZodType = z.ZodUndefined>(
  options: FeedbackSubmissionOptions<ContextSchema>,
): EmseepeaTool {
  const inputSchema = z.strictObject({
    observation: feedbackObservationSchema,
    detail: body.describe(
      "What happened, what helped or failed, what was harder than it should have been, or what was surprising.",
    ),
    ...(options.contextSchema ? {
      context: options.contextSchema.optional().describe(
        "Application-declared structured context. Do not include chat history, credentials, raw tool data, or personal information.",
      ),
    } : {}),
  });
  const outputSchema = submissionResultSchema.omit({ events: true });
  const common = {
    name: "submit-feedback",
    title: "Record Detailed Feedback",
    description:
      "Record one notable observation about an error, friction, annoyance, unnecessary difficulty, confusion, repetition, surprise, capability mismatch, suggestion, or notable success. " +
      "Use this without asking a separate permission question, then answer the user's original request and briefly tell them what was recorded. Do not let feedback displace the requested answer. Do not record normal uneventful operation, expected empty results, session opening or closing, a duplicate observation, or anything after the user objects. Never include surrounding conversation, credentials, or raw tool payloads.",
    annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema,
    outputSchema,
  } as const;
  const execute = async (
    input: z.output<typeof inputSchema>,
    toolContext: ToolContext<"public"> | ToolContext<"protected">,
  ) => {
      const adapterContext = createAdapterContext(options.scope, toolContext);
      const result = await submissionResultSchema.parseAsync(await options.backend.submit({
        observation: input.observation,
        detail: input.detail,
        context: ("context" in input ? input.context : undefined) as z.output<ContextSchema>,
      }, adapterContext));
      await dispatchHooks(options.hooks, result.events ?? [], adapterContext);
      return { data: { id: result.id, recordedAt: result.recordedAt } };
  };
  if (options.access === "public") {
    if (options.requiredScopes !== undefined) {
      throw new Error("Public feedback submissions cannot declare requiredScopes");
    }
    return defineTool({ ...common, access: "public", handler: execute });
  }
  if (!options.requiredScopes?.length) {
    throw new Error("Protected feedback submissions require at least one scope");
  }
  return defineTool({
    ...common,
    access: "protected",
    requiredScopes: options.requiredScopes,
    handler: execute,
  });
}

const createThreadCommandSchema = z.strictObject({
  subject: z.string().min(1).max(200).describe("Short description of the feedback topic."),
  message: body.describe("Detailed first message for the support team."),
});
const appendMessageCommandSchema = z.strictObject({
  threadId: identifier.describe("Exact feedback thread identifier returned by this server."),
  message: body.describe("New user message to append to the existing support conversation."),
});
const listThreadsQuerySchema = z.strictObject({
  cursor: z.string().min(1).max(1_000).optional().describe("Opaque cursor from the previous page."),
  limit: z.number().int().min(1).max(50).default(20).describe("Maximum threads to return."),
});
const getThreadQuerySchema = z.strictObject({
  threadId: identifier.describe("Exact feedback thread identifier returned by this server."),
});
const threadPageSchema = z.strictObject({
  threads: z.array(feedbackThreadSchema).max(50).describe("Feedback threads visible in this scope."),
  nextCursor: z.string().min(1).max(1_000).optional().describe("Cursor for the next page, when more threads exist."),
});

const createThreadResultSchema = z.strictObject({
  conversation: feedbackConversationSchema,
  events: backendEventsSchema,
});
const appendMessageResultSchema = z.strictObject({
  message: feedbackMessageSchema,
  events: backendEventsSchema,
});
const listThreadsResultSchema = z.strictObject({
  page: threadPageSchema,
});
const getThreadResultSchema = z.strictObject({
  conversation: feedbackConversationSchema,
  events: backendEventsSchema,
});

export type CreateFeedbackThreadCommand = z.output<typeof createThreadCommandSchema>;
export type AppendFeedbackMessageCommand = z.output<typeof appendMessageCommandSchema>;
export type ListFeedbackThreadsQuery = z.output<typeof listThreadsQuerySchema>;
export type GetFeedbackThreadQuery = z.output<typeof getThreadQuerySchema>;
export type CreateFeedbackThreadResult = z.input<typeof createThreadResultSchema>;
export type AppendFeedbackMessageResult = z.input<typeof appendMessageResultSchema>;
export type ListFeedbackThreadsResult = z.input<typeof listThreadsResultSchema>;
export type GetFeedbackThreadResult = z.input<typeof getThreadResultSchema>;

export interface FeedbackConversationBackend {
  createThread(
    command: CreateFeedbackThreadCommand,
    context: FeedbackAdapterContext,
  ): CreateFeedbackThreadResult | Promise<CreateFeedbackThreadResult>;
  appendMessage(
    command: AppendFeedbackMessageCommand,
    context: FeedbackAdapterContext,
  ): AppendFeedbackMessageResult | Promise<AppendFeedbackMessageResult>;
  listThreads(
    query: ListFeedbackThreadsQuery,
    context: FeedbackAdapterContext,
  ): ListFeedbackThreadsResult | Promise<ListFeedbackThreadsResult>;
  getThread(
    query: GetFeedbackThreadQuery,
    context: FeedbackAdapterContext,
  ): GetFeedbackThreadResult | Promise<GetFeedbackThreadResult>;
}

export interface FeedbackConversationOptions {
  readonly requiredScopes: readonly string[];
  readonly scope?: (principal: Principal | undefined) => string;
  readonly backend: FeedbackConversationBackend;
  readonly hooks?: readonly FeedbackEventHook[];
}

export function defineFeedbackConversation(options: FeedbackConversationOptions): readonly EmseepeaTool[] {
  const access = { access: "protected" as const, requiredScopes: options.requiredScopes };
  const contextFor = (context: ToolContext<"protected">) => createAdapterContext(
    options.scope ?? ((principal) => principal?.clientId ?? ""),
    context,
  );

  const createThread = defineTool({
    name: "create-feedback-thread",
    ...access,
    title: "Start Feedback Conversation",
    description:
      "Start a durable support conversation for detailed feedback. Use one thread for one observation and openly tell the user it was created. Do not include unrelated chat history, credentials, or raw tool payloads.",
    annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: createThreadCommandSchema,
    outputSchema: feedbackConversationSchema,
    async handler(input, toolContext: ToolContext<"protected">) {
      const context = contextFor(toolContext);
      const result = await createThreadResultSchema.parseAsync(
        await options.backend.createThread(input, context),
      );
      await dispatchHooks(options.hooks, result.events ?? [], context);
      return { data: result.conversation };
    },
  });

  const appendMessage = defineTool({
    name: "reply-to-feedback-thread",
    ...access,
    title: "Reply to Feedback Conversation",
    description:
      "Append the user's new message to the exact existing feedback thread. Do not repeat an earlier message or invent a thread identifier.",
    annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: appendMessageCommandSchema,
    outputSchema: feedbackMessageSchema,
    async handler(input, toolContext: ToolContext<"protected">) {
      const context = contextFor(toolContext);
      const result = await appendMessageResultSchema.parseAsync(
        await options.backend.appendMessage(input, context),
      );
      await dispatchHooks(options.hooks, result.events ?? [], context);
      return { data: result.message };
    },
  });

  const listThreads = defineTool({
    name: "list-feedback-threads",
    ...access,
    title: "List Feedback Conversations",
    description: "List feedback conversations for this authenticated client scope.",
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: listThreadsQuerySchema,
    outputSchema: threadPageSchema,
    async handler(input, toolContext: ToolContext<"protected">) {
      const context = contextFor(toolContext);
      const result = await listThreadsResultSchema.parseAsync(
        await options.backend.listThreads(input, context),
      );
      return { data: result.page };
    },
  });

  const getThread = defineTool({
    name: "get-feedback-thread",
    ...access,
    title: "Read Feedback Conversation",
    description:
      "Read one feedback conversation and present the meaning of any new team reply to the user. Reading may record that a team reply was offered to this AI client. It does not prove the user saw or understood it.",
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: getThreadQuerySchema,
    outputSchema: feedbackConversationSchema,
    async handler(input, toolContext: ToolContext<"protected">) {
      const context = contextFor(toolContext);
      const result = await getThreadResultSchema.parseAsync(
        await options.backend.getThread(input, context),
      );
      await dispatchHooks(options.hooks, result.events ?? [], context);
      return { data: result.conversation };
    },
  });

  return Object.freeze([createThread, appendMessage, listThreads, getThread]);
}

function createAdapterContext(
  scopeOption: string | ((principal: Principal | undefined) => string) | undefined,
  context: Readonly<{
    signal: AbortSignal;
    deadlineMs: number;
    principal: Principal | undefined;
  }>,
): FeedbackAdapterContext {
  const scope = typeof scopeOption === "function"
    ? scopeOption(context.principal)
    : scopeOption ?? context.principal?.clientId ?? "public";
  const checkedScope = identifier.parse(scope);
  return Object.freeze({
    scope: checkedScope,
    signal: context.signal,
    deadlineMs: context.deadlineMs,
  });
}

async function dispatchHooks(
  hooks: readonly FeedbackEventHook[] | undefined,
  events: readonly z.output<typeof backendEventSchema>[],
  context: FeedbackAdapterContext,
): Promise<void> {
  if (!hooks?.length || events.length === 0) return;
  const hookDeadlineMs = context.deadlineMs - 25;
  for (const uncheckedEvent of events) {
    if (context.signal.aborted || Date.now() >= hookDeadlineMs) return;
    const event = Object.freeze(feedbackEventSchema.parse({
      ...uncheckedEvent,
      scope: context.scope,
    }));
    for (const hook of hooks) {
      if (context.signal.aborted || Date.now() >= hookDeadlineMs) return;
      try {
        const hookContext = {
          signal: context.signal,
          deadlineMs: hookDeadlineMs,
        };
        const signal = deadlineSignal(hookContext);
        await beforeDeadline(Promise.resolve(hook(event, Object.freeze({
          signal,
          deadlineMs: hookContext.deadlineMs,
        }))), hookContext);
      } catch {
        // Feedback is already durable. Best-effort hooks cannot change the MCP result.
      }
    }
  }
}
