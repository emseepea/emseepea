import {
  defineFeedbackConversation,
  defineFeedbackSubmission,
  type FeedbackConversationBackend,
} from "../src/index.js";
import { z } from "zod";

defineFeedbackSubmission({
  access: "public",
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
