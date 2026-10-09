import { createHash, randomUUID } from "node:crypto";
import {
  defineTool,
  type EmseepeaTool,
  type Principal,
  type ToolContext,
} from "@emseepea/server";
import { z } from "zod";
import { beforeDeadline, deadlineSignal } from "./deadline.js";
import {
  feedbackCollectionSchema,
  type FeedbackCollection,
  type FeedbackCollectionsDefinition,
} from "./collections.js";

export * from "./collections.js";

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

// Every result schema in this file is open. A client validating a result against
// a captured copy of one of these must tolerate a field added later, so none of
// them publishes a closed contract, and a tool's published schema is just the
// schema itself rather than a second copy kept in step with it.
//
// One thing an adapter returns is still checked strictly: a conversation
// backend's wrapper — `createThreadResultSchema` and its siblings — rejects an
// unexpected key at its top level.
//
// Everywhere else an unexpected key no longer fails the call: nested inside what
// an adapter returns and at the top level of what a submission backend returns
// it is dropped, and inside an event the whole event is skipped. It is never
// sent to a client either way.
export const feedbackMessageSchema = z.object({
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

export const feedbackThreadSchema = z.object({
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

export interface FeedbackToolAnnotationOverrides {
  readonly readOnlyHint?: boolean;
  readonly destructiveHint?: boolean;
  readonly idempotentHint?: boolean;
  readonly openWorldHint?: boolean;
}

export interface FeedbackConversationAnnotationOverrides {
  readonly create?: FeedbackToolAnnotationOverrides;
  readonly reply?: FeedbackToolAnnotationOverrides;
  readonly list?: FeedbackToolAnnotationOverrides;
  readonly get?: FeedbackToolAnnotationOverrides;
}

interface FeedbackToolAnnotations {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
}

const feedbackToolAnnotationOverridesSchema = z.strictObject({
  readOnlyHint: z.boolean().optional(),
  destructiveHint: z.boolean().optional(),
  idempotentHint: z.boolean().optional(),
  openWorldHint: z.boolean().optional(),
});

const feedbackConversationAnnotationOverridesSchema = z.strictObject({
  create: feedbackToolAnnotationOverridesSchema.optional(),
  reply: feedbackToolAnnotationOverridesSchema.optional(),
  list: feedbackToolAnnotationOverridesSchema.optional(),
  get: feedbackToolAnnotationOverridesSchema.optional(),
});

export interface FeedbackAdapterContext {
  readonly scope: string;
  readonly signal: AbortSignal;
  readonly deadlineMs: number;
}

export const feedbackSubmissionSourceReferenceSchema = z.strictObject({
  system: identifier.describe("Stable name of the authoritative source system."),
  id: identifier.describe("Stable non-secret record identifier in the source system."),
});

export const feedbackSubmissionRecordSchema = z.object({
  collection: feedbackCollectionSchema,
  submissionId: identifier.describe("Stable identifier within the feedback collection."),
  scope: identifier.describe("Authorization scope associated with the submission."),
  observation: feedbackObservationSchema,
  detail: body,
  context: z.unknown().optional(),
  recordedAt: timestamp,
  source: feedbackSubmissionSourceReferenceSchema,
});

export const feedbackSubmissionReferenceSchema = z.strictObject({
  collection: feedbackCollectionSchema,
  submissionId: identifier.describe("Stable identifier within the feedback collection."),
});

export const feedbackSubmissionRecordedEventSchema = z.strictObject({
  id: identifier,
  type: z.literal("feedback.submission.recorded"),
  occurredAt: timestamp,
  record: feedbackSubmissionReferenceSchema,
  source: feedbackSubmissionSourceReferenceSchema,
});

export const getFeedbackSubmissionQuerySchema = feedbackSubmissionReferenceSchema;
export const listFeedbackSubmissionsQuerySchema = z.strictObject({
  collection: feedbackCollectionSchema,
  cursor: z.string().min(1).max(1_000).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export const feedbackSubmissionPageSchema = z.object({
  submissions: z.array(feedbackSubmissionRecordSchema).max(50),
  nextCursor: z.string().min(1).max(1_000).optional(),
});

export type FeedbackSubmissionSourceReference = z.output<
  typeof feedbackSubmissionSourceReferenceSchema
>;
export type FeedbackSubmissionRecord = z.output<typeof feedbackSubmissionRecordSchema>;
export type FeedbackSubmissionReference = z.output<typeof feedbackSubmissionReferenceSchema>;
export type FeedbackSubmissionRecordedEvent = z.output<
  typeof feedbackSubmissionRecordedEventSchema
>;
export type GetFeedbackSubmissionQuery = z.output<typeof getFeedbackSubmissionQuerySchema>;
export type ListFeedbackSubmissionsQuery = z.output<typeof listFeedbackSubmissionsQuerySchema>;
export type FeedbackSubmissionPage = z.output<typeof feedbackSubmissionPageSchema>;

export interface FeedbackCollectionBackend {
  getSubmission(
    query: GetFeedbackSubmissionQuery,
    context: FeedbackAdapterContext,
  ): FeedbackSubmissionRecord | undefined | Promise<FeedbackSubmissionRecord | undefined>;
  listSubmissions(
    query: ListFeedbackSubmissionsQuery,
    context: FeedbackAdapterContext,
  ): FeedbackSubmissionPage | Promise<FeedbackSubmissionPage>;
}

export interface FeedbackCollectionSubmissionBackend<Context = undefined>
  extends FeedbackCollectionBackend {
  recordSubmission(
    command: Readonly<{
      collection: FeedbackCollection;
      observation: FeedbackObservation;
      detail: string;
      context: Context;
    }>,
    context: FeedbackAdapterContext,
  ): FeedbackSubmissionRecord | Promise<FeedbackSubmissionRecord>;
}

export type FeedbackSubmissionRecordedHook = (
  event: Readonly<FeedbackSubmissionRecordedEvent>,
  context: FeedbackAdapterContext,
) => void | Promise<void>;

export interface InMemoryFeedbackCollectionOptions {
  readonly sourceSystem?: string;
  readonly initialRecords?: readonly unknown[];
  readonly createSubmissionId?: () => string;
  readonly now?: () => string;
}

export function createInMemoryFeedbackCollectionBackend<Context = undefined>(
  options: InMemoryFeedbackCollectionOptions = {},
): FeedbackCollectionSubmissionBackend<Context> {
  const sourceSystem = identifier.parse(options.sourceSystem ?? "in-memory-feedback");
  const preservedRecords: unknown[] = [];
  const namedRecords = new Map<string, FeedbackSubmissionRecord>();
  for (const initial of options.initialRecords ?? []) {
    const copied = cloneValue(initial);
    preservedRecords.push(copied);
    const checked = feedbackSubmissionRecordSchema.safeParse(copied);
    if (!checked.success) continue;
    const record = freezeSubmissionRecord(checked.data);
    const key = submissionKey(record.collection, record.submissionId);
    if (namedRecords.has(key)) {
      throw new Error(
        "Initial feedback records contain a duplicate collection and submission identifier. " +
        "Remove the duplicate record before starting the backend.",
      );
    }
    namedRecords.set(key, record);
  }

  const backend: FeedbackCollectionSubmissionBackend<Context> = {
    recordSubmission(command, context) {
      context.signal.throwIfAborted();
      const submissionId = identifier.parse((options.createSubmissionId ?? randomUUID)());
      const record = freezeSubmissionRecord(feedbackSubmissionRecordSchema.parse({
        collection: command.collection,
        submissionId,
        scope: context.scope,
        observation: command.observation,
        detail: command.detail,
        context: cloneValue(command.context),
        recordedAt: (options.now ?? (() => new Date().toISOString()))(),
        source: { system: sourceSystem, id: submissionId },
      }));
      const key = submissionKey(record.collection, record.submissionId);
      if (namedRecords.has(key)) {
        throw new Error(
          "Feedback could not be recorded because its identifier already exists in this collection. " +
          "Configure the backend to generate unique submission identifiers, then try again.",
        );
      }
      namedRecords.set(key, record);
      preservedRecords.push(record);
      return record;
    },

    getSubmission(query, context) {
      context.signal.throwIfAborted();
      const checked = getFeedbackSubmissionQuerySchema.parse(query);
      const record = namedRecords.get(submissionKey(checked.collection, checked.submissionId));
      return record?.scope === context.scope ? record : undefined;
    },

    listSubmissions(query, context) {
      context.signal.throwIfAborted();
      const checked = listFeedbackSubmissionsQuerySchema.parse(query);
      const records = [...namedRecords.values()]
        .filter(({ collection, scope }) => collection === checked.collection && scope === context.scope)
        .sort(compareSubmissionRecords);
      const start = checked.cursor === undefined
        ? 0
        : submissionCursorStart(checked.cursor, checked.collection, context.scope, records);
      const submissions = records.slice(start, start + checked.limit);
      const last = submissions.at(-1);
      return Object.freeze({
        submissions,
        nextCursor: start + submissions.length < records.length && last
          ? encodeSubmissionCursor(last)
          : undefined,
      });
    },
  };
  return Object.freeze(backend);
}

export interface FeedbackCollectionSubmissionOptions<ContextSchema extends z.ZodType = z.ZodUndefined> {
  readonly definition: FeedbackCollectionsDefinition;
  readonly scope?: string | ((principal: Principal | undefined) => string);
  readonly contextSchema?: ContextSchema;
  readonly backend: FeedbackCollectionSubmissionBackend<z.output<ContextSchema>>;
  readonly hooks?: readonly FeedbackSubmissionRecordedHook[];
}

export function defineFeedbackCollectionSubmissions<ContextSchema extends z.ZodType = z.ZodUndefined>(
  options: FeedbackCollectionSubmissionOptions<ContextSchema>,
): readonly EmseepeaTool[] {
  const tools = options.definition.submissions.map((submission) => {
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
    const outputSchema = z.object({
      collection: z.literal(submission.collection).describe("The deployment-configured feedback collection."),
      submissionId: identifier.describe("Stable identifier within the feedback collection."),
      recordedAt: timestamp.describe("When the feedback was durably recorded."),
      nextAction: z.literal(submissionNextAction).describe(
        "What the AI should do after the feedback was durably recorded.",
      ),
    });
    const label = collectionLabel(submission.collection);
    const common = {
      name: submission.toolName,
      title: `Record ${label} Feedback`,
      description:
        `Record one feedback observation in the ${label.toLowerCase()} collection configured for this deployment. ` +
        submissionBehaviorGuidance,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema,
      outputSchema,
    } as const;
    const execute = async (
      input: z.output<typeof inputSchema>,
      toolContext: ToolContext<"public"> | ToolContext<"protected">,
    ) => {
      const adapterContext = createAdapterContext(options.scope, toolContext);
      const record = freezeSubmissionRecord(await feedbackSubmissionRecordSchema.parseAsync(
        await options.backend.recordSubmission({
          collection: submission.collection,
          observation: input.observation,
          detail: input.detail,
          context: ("context" in input ? input.context : undefined) as z.output<ContextSchema>,
        }, adapterContext),
      ));
      if (record.collection !== submission.collection || record.scope !== adapterContext.scope) {
        throw new Error(
          "Feedback could not be recorded because the backend returned a different collection or authorization scope. " +
          "Correct the backend configuration, then try again.",
        );
      }
      await dispatchSubmissionRecordedHooks(options.hooks, record, adapterContext);
      return {
        data: {
          collection: record.collection,
          submissionId: record.submissionId,
          recordedAt: record.recordedAt,
          nextAction: submissionNextAction,
        } as const,
      };
    };
    if (submission.access === "public") {
      return defineTool({ ...common, access: "public", handler: execute });
    }
    return defineTool({
      ...common,
      access: "protected",
      requiredScopes: submission.requiredScopes,
      handler: execute,
    });
  });
  return Object.freeze(tools);
}

export interface FeedbackCollectionOperatorOptions<ContextSchema extends z.ZodType = z.ZodNever> {
  readonly definition: FeedbackCollectionsDefinition;
  readonly scope?: string | ((principal: Principal | undefined) => string);
  readonly contextSchema?: ContextSchema;
  readonly backend: FeedbackCollectionBackend;
}

const operatorReadError =
  "Feedback submissions could not be read. Check that you can access the collection. " +
  "If you requested one submission, check its identifier, then try again.";
const maximumOperatorResultBytes = 262_144;

export function defineFeedbackCollectionOperators<ContextSchema extends z.ZodType = z.ZodNever>(
  options: FeedbackCollectionOperatorOptions<ContextSchema>,
): readonly EmseepeaTool[] {
  if (options.definition.operators.length === 0) return Object.freeze([]);
  const collections = options.definition.operators.map(({ collection }) => collection);
  const collectionSchema = z.enum(collections as [FeedbackCollection, ...FeedbackCollection[]])
    .describe("Configured feedback collection to read.");
  const roles = new Map(options.definition.operators.map((role) => [role.collection, role]));
  const requiredScopes = operatorToolScopes(options.definition.operators);
  const contextSchema = options.contextSchema;
  const safeRecordSchema = z.object({
    collection: collectionSchema,
    submissionId: identifier.describe("Stable identifier within the feedback collection."),
    observation: feedbackObservationSchema,
    detail: body,
    ...(contextSchema ? {
      context: contextSchema.optional().describe("Validated application context recorded with the feedback."),
    } : {}),
    recordedAt: timestamp,
  });
  const listInputSchema = z.strictObject({
    collection: collectionSchema,
    cursor: z.string().min(1).max(1_000).optional().describe("Opaque cursor from the previous page."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum submissions to return."),
  });
  const getInputSchema = z.strictObject({
    collection: collectionSchema,
    submissionId: identifier.describe("Exact submission identifier returned for this collection."),
  });
  const pageSchema = z.object({
    submissions: z.array(safeRecordSchema).max(50),
    nextCursor: z.string().min(1).max(1_000).optional(),
  });
  const access = { access: "protected" as const, requiredScopes };

  const authorize = (collection: FeedbackCollection, principal: Principal | undefined) => {
    const role = roles.get(collection);
    if (!role || !principal ||
        !role.requiredScopes.every((scope) => principal.permissions.includes(scope))) {
      throw new Error(operatorReadError);
    }
  };
  const adapterContext = (toolContext: ToolContext<"protected">) =>
    createAdapterContext(options.scope, toolContext);
  const safeRecord = (value: unknown, collection: FeedbackCollection, scope: string) => {
    const checked = feedbackSubmissionRecordSchema.safeParse(value);
    if (!checked.success || checked.data.collection !== collection || checked.data.scope !== scope) {
      throw new Error(operatorReadError);
    }
    const safe = {
      collection: checked.data.collection,
      submissionId: checked.data.submissionId,
      observation: checked.data.observation,
      detail: checked.data.detail,
      ...(contextSchema && checked.data.context !== undefined
        ? { context: checked.data.context as z.output<ContextSchema> }
        : {}),
      recordedAt: checked.data.recordedAt,
    };
    const parsed = safeRecordSchema.safeParse(safe);
    if (!parsed.success) throw new Error(operatorReadError);
    return Object.freeze(parsed.data);
  };
  const bounded = <Value>(value: Value): Value => {
    try {
      if (Buffer.byteLength(JSON.stringify(value), "utf8") > maximumOperatorResultBytes) {
        throw new Error(operatorReadError);
      }
      return value;
    } catch (error) {
      if (error instanceof Error && error.message === operatorReadError) throw error;
      throw new Error(operatorReadError);
    }
  };

  const list = defineTool({
    name: "list-feedback-submissions",
    ...access,
    title: "List Feedback Submissions",
    description: "List feedback submissions from one configured collection.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: listInputSchema,
    outputSchema: pageSchema,
    async handler(input, toolContext: ToolContext<"protected">) {
      authorize(input.collection, toolContext.principal);
      const context = adapterContext(toolContext);
      const page = await feedbackSubmissionPageSchema.parseAsync(
        await options.backend.listSubmissions(input, context),
      );
      const safePage = {
        submissions: page.submissions.map((record) => safeRecord(record, input.collection, context.scope)),
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      };
      const parsed = pageSchema.safeParse(safePage);
      if (!parsed.success) throw new Error(operatorReadError);
      return { data: bounded(Object.freeze(parsed.data)) };
    },
  });

  const get = defineTool({
    name: "get-feedback-submission",
    ...access,
    title: "Read Feedback Submission",
    description: "Read one feedback submission by its exact collection and submission identifier.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: getInputSchema,
    outputSchema: safeRecordSchema,
    async handler(input, toolContext: ToolContext<"protected">) {
      authorize(input.collection, toolContext.principal);
      const context = adapterContext(toolContext);
      const record = await options.backend.getSubmission(input, context);
      if (record === undefined) throw new Error(operatorReadError);
      const safe = safeRecord(record, input.collection, context.scope);
      if (safe.submissionId !== input.submissionId) throw new Error(operatorReadError);
      return { data: bounded(safe) };
    },
  });

  return Object.freeze([list, get]);
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
export type FeedbackBackendEvent = z.input<typeof backendEventSchema>;
// Events reach us only after the backend has durably recorded the thing they
// describe, and they only drive best-effort hooks. Nothing about them is checked
// here, where any failure would turn a recorded submission into a failed tool
// call — not their contents, not their shape, not how many there are.
// `dispatchHooks` applies all three and skips what it cannot use. The exported
// type still holds an adapter to the event shape at compile time.
const backendEventsSchema = z.custom<readonly FeedbackBackendEvent[]>(() => true).optional();

// How many events one result may drive hooks for. Past this we stop, rather than
// rejecting the result: the work it describes is already done.
const maxDispatchedEvents = 100;

const submissionNextAction =
  "Start your final response by answering every part of the user's original request from earlier tool results. A response that only discusses feedback is incomplete. Then tell the user, \"I recorded feedback about ...\", with a brief, specific summary of the observation.";

const submissionBehaviorGuidance =
  "Call this tool before answering when another tool result or the user's message reveals notable friction or another qualifying observation. " +
  "Use it without asking a separate permission question. After it succeeds, fully answer the user's original request. " +
  "Then briefly state the specific observation you recorded. Only say you recorded feedback after this tool succeeds. " +
  "Do not let feedback replace the requested answer. A tool that works as designed, returns structured data, or takes only the expected steps is ordinary operation. " +
  "Do not record these outcomes as feedback. Do not record expected empty results, session opening or closing, duplicate observations, or anything after the user objects. " +
  "Never include surrounding conversation, credentials, raw tool data, or personal information.";

const submissionResultSchema = z.object({
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
  readonly annotations?: FeedbackToolAnnotationOverrides;
  readonly backend: FeedbackSubmissionBackend<z.output<ContextSchema>>;
  readonly hooks?: readonly FeedbackEventHook[];
}

export function defineFeedbackSubmission<ContextSchema extends z.ZodType = z.ZodUndefined>(
  options: FeedbackSubmissionOptions<ContextSchema>,
): EmseepeaTool {
  const annotations = feedbackToolAnnotations({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  }, options.annotations);
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
  const outputSchema = submissionResultSchema.omit({ events: true }).extend({
    nextAction: z.literal(submissionNextAction).describe(
      "What the AI should do after the feedback was durably recorded.",
    ),
  });
  const common = {
    name: "submit-feedback",
    title: "Record Detailed Feedback",
    description:
      "Record one notable observation about an error, friction, annoyance, unnecessary difficulty, confusion, repetition, an unexpected result, a capability mismatch, a suggestion, or a notable success. " +
      submissionBehaviorGuidance,
    annotations,
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
      return {
        data: {
          id: result.id,
          recordedAt: result.recordedAt,
          nextAction: submissionNextAction,
        } as const,
      };
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
const threadPageSchema = z.object({
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
  readonly annotations?: FeedbackConversationAnnotationOverrides;
  readonly backend: FeedbackConversationBackend;
  readonly hooks?: readonly FeedbackEventHook[];
}

export function defineFeedbackConversation(options: FeedbackConversationOptions): readonly EmseepeaTool[] {
  const configuredAnnotations = feedbackConversationAnnotationOverridesSchema.parse(
    options.annotations ?? {},
  );
  const annotations = Object.freeze({
    create: feedbackToolAnnotations({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    }, configuredAnnotations.create),
    reply: feedbackToolAnnotations({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    }, configuredAnnotations.reply),
    list: feedbackToolAnnotations({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    }, configuredAnnotations.list),
    get: feedbackToolAnnotations({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    }, configuredAnnotations.get),
  });
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
    annotations: annotations.create,
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
    annotations: annotations.reply,
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
    annotations: annotations.list,
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
    annotations: annotations.get,
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

function feedbackToolAnnotations(
  defaults: FeedbackToolAnnotations,
  overrides: FeedbackToolAnnotationOverrides | undefined,
): FeedbackToolAnnotations {
  const checked = feedbackToolAnnotationOverridesSchema.parse(overrides ?? {});
  return Object.freeze({ ...defaults, ...checked });
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
  events: unknown,
  context: FeedbackAdapterContext,
): Promise<void> {
  if (!hooks?.length) return;
  try {
    await dispatchEachEvent(hooks, events, context);
  } catch {
    // Total within this call. Hooks are best effort and the work they describe is
    // already durable, so nothing that happens from here may fail the tool call —
    // not the list an adapter handed us, not a hook, not a mistake of ours.
    // Guarding statement by statement was tried and kept leaving one read
    // outside, which is why the guard wraps the whole body instead.
    //
    // One read is still outside it: `events` is a declared key of the result
    // schemas, so the parse reads the property before we get here. A throwing
    // getter there still fails the call. See the backlog.
  }
}

async function dispatchSubmissionRecordedHooks(
  hooks: readonly FeedbackSubmissionRecordedHook[] | undefined,
  record: FeedbackSubmissionRecord,
  context: FeedbackAdapterContext,
): Promise<void> {
  if (!hooks?.length) return;
  const event = Object.freeze(feedbackSubmissionRecordedEventSchema.parse({
    id: `feedback.submission.recorded:${createHash("sha256")
      .update(`${record.collection}\0${record.submissionId}`)
      .digest("hex")}`,
    type: "feedback.submission.recorded",
    occurredAt: record.recordedAt,
    record: Object.freeze({
      collection: record.collection,
      submissionId: record.submissionId,
    }),
    source: Object.freeze({ ...record.source }),
  }));
  const hookDeadlineMs = context.deadlineMs - 25;
  for (const hook of hooks) {
    if (context.signal.aborted || Date.now() >= hookDeadlineMs) return;
    try {
      const hookContext = Object.freeze({ ...context, deadlineMs: hookDeadlineMs });
      const signal = deadlineSignal(hookContext);
      await beforeDeadline(Promise.resolve(hook(event, Object.freeze({
        ...hookContext,
        signal,
      }))), hookContext);
    } catch {
      // The record is already committed. Event hooks are best effort and cannot
      // turn a successful write into a failed submission.
    }
  }
}

function submissionKey(collection: FeedbackCollection, submissionId: string): string {
  return `${collection}\0${submissionId}`;
}

function compareSubmissionRecords(a: FeedbackSubmissionRecord, b: FeedbackSubmissionRecord): number {
  if (a.recordedAt !== b.recordedAt) return a.recordedAt > b.recordedAt ? -1 : 1;
  return a.submissionId > b.submissionId ? -1 : a.submissionId < b.submissionId ? 1 : 0;
}

const submissionCursorSchema = z.strictObject({
  version: z.literal(1),
  collection: feedbackCollectionSchema,
  scope: identifier,
  recordedAt: timestamp,
  submissionId: identifier,
});

function operatorToolScopes(
  operators: FeedbackCollectionsDefinition["operators"],
): readonly string[] {
  const first = operators[0];
  if (!first) throw new TypeError("Feedback operator tools require at least one operator role");
  const shared = first.requiredScopes.filter((scope) =>
    operators.every((operator) => operator.requiredScopes.includes(scope)));
  if (shared.length > 0) return Object.freeze(shared);
  throw new TypeError(
    "Feedback operator roles must share at least one scope used to protect the operator tools. " +
    "Add a shared operator scope to every configured operator role.",
  );
}

function encodeSubmissionCursor(record: FeedbackSubmissionRecord): string {
  return Buffer.from(JSON.stringify({
    version: 1,
    collection: record.collection,
    scope: record.scope,
    recordedAt: record.recordedAt,
    submissionId: record.submissionId,
  }), "utf8").toString("base64url");
}

function submissionCursorStart(
  cursor: string,
  collection: FeedbackCollection,
  scope: string,
  records: readonly FeedbackSubmissionRecord[],
): number {
  try {
    const decoded = submissionCursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (decoded.collection !== collection || decoded.scope !== scope) throw new Error();
    const position = records.findIndex((record) =>
      record.recordedAt === decoded.recordedAt && record.submissionId === decoded.submissionId
    );
    if (position < 0) throw new Error();
    return position + 1;
  } catch {
    throw new TypeError(
      "This cursor does not match the requested feedback collection and authorization scope. " +
      "Start the listing again without a cursor.",
    );
  }
}

function collectionLabel(collection: FeedbackCollection): string {
  return collection.split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

function freezeSubmissionRecord(record: FeedbackSubmissionRecord): FeedbackSubmissionRecord {
  deepFreeze(record.context);
  return Object.freeze({
    ...record,
    source: Object.freeze({ ...record.source }),
  });
}

function deepFreeze(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  Object.freeze(value);
}

async function dispatchEachEvent(
  hooks: readonly FeedbackEventHook[],
  events: unknown,
  context: FeedbackAdapterContext,
): Promise<void> {
  if (!Array.isArray(events) || events.length === 0) return;
  const hookDeadlineMs = context.deadlineMs - 25;
  for (const uncheckedEvent of events.slice(0, maxDispatchedEvents)) {
    if (context.signal.aborted || Date.now() >= hookDeadlineMs) return;
    if (typeof uncheckedEvent !== "object" || uncheckedEvent === null) continue;
    const checked = feedbackEventSchema.safeParse({ ...uncheckedEvent, scope: context.scope });
    // Skip an event we cannot use rather than throwing.
    if (!checked.success) continue;
    const event = Object.freeze(checked.data);
    for (const hook of hooks) {
      if (context.signal.aborted || Date.now() >= hookDeadlineMs) return;
      try {
        const hookContext = { signal: context.signal, deadlineMs: hookDeadlineMs };
        const signal = deadlineSignal(hookContext);
        await beforeDeadline(Promise.resolve(hook(event, Object.freeze({
          signal,
          deadlineMs: hookContext.deadlineMs,
        }))), hookContext);
      } catch {
        // One hook failing must not stop the others.
      }
    }
  }
}
