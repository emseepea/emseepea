import {
  defineFeedbackConversation,
  defineFeedbackSubmission,
  type FeedbackConversationBackend,
} from "../src/index.js";
import { z } from "zod";

defineFeedbackSubmission({
  access: "public",
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  contextSchema: z.strictObject({ feature: z.string() }),
  backend: {
    submit(command) {
      command.context.feature satisfies string;
      return { id: "feedback-1", recordedAt: "2026-09-10T00:00:00.000Z" };
    },
  },
});

defineFeedbackSubmission({
  access: "public",
  backend: {
    // @ts-expect-error submission backends must return the checked public shape
    submit: () => ({ recordedAt: "missing identifier" }),
  },
});

const backend = {
  createThread: () => ({
    conversation: {
      id: "thread-1",
      subject: "Feedback",
      status: "open",
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
      messages: [],
    },
  }),
  appendMessage: (_command) => ({
    message: {
      id: "message-1",
      threadId: "thread-1",
      sequence: 1,
      author: "user" as const,
      kind: "comment" as const,
      body: "Feedback",
      createdAt: "2026-09-10T00:00:00.000Z",
    },
  }),
  listThreads: () => ({ page: { threads: [] } }),
  getThread: () => ({
    conversation: {
      id: "thread-1",
      subject: "Feedback",
      status: "open",
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
      messages: [],
    },
  }),
} satisfies FeedbackConversationBackend;

defineFeedbackConversation({ requiredScopes: ["feedback"], backend });

defineFeedbackConversation({
  requiredScopes: ["feedback"],
  annotations: {
    create: { destructiveHint: true },
    reply: { destructiveHint: true, openWorldHint: false },
    list: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    get: { destructiveHint: true, idempotentHint: false },
  },
  backend,
});

defineFeedbackSubmission({
  access: "public",
  // @ts-expect-error annotation values must be booleans
  annotations: { destructiveHint: "yes" },
  backend: { submit: () => ({ id: "feedback-1", recordedAt: "2026-09-10T00:00:00.000Z" }) },
});

defineFeedbackConversation({
  requiredScopes: ["feedback"],
  annotations: {
    // @ts-expect-error conversation annotation operation names are closed
    archive: { destructiveHint: true },
  },
  backend,
});

defineFeedbackConversation({
  requiredScopes: ["feedback"],
  annotations: {
    // @ts-expect-error annotation keys are closed
    list: { recipient: "support@example.com" },
  },
  backend,
});
