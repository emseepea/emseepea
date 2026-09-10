import { createEmseepea, serveEmseepea } from "@emseepea/server";
import { insecureTestAuthentication } from "@emseepea/testing";
import { defineFeedbackConversation } from "../dist/index.js";

const createdAt = "2026-09-10T00:00:00.000Z";
const messages = [{
  id: "message-1",
  threadId: "thread-1",
  sequence: 1,
  author: "user",
  kind: "comment",
  body: "Finding the variety filter took three attempts.",
  createdAt,
}, {
  id: "message-2",
  threadId: "thread-1",
  sequence: 2,
  author: "team",
  kind: "comment",
  body: "We moved the variety filter above the results and kept it in place after every search.",
  createdAt,
}];
const thread = {
  id: "thread-1",
  subject: "Variety filter friction",
  status: "waiting_on_user",
  createdAt,
  updatedAt: createdAt,
};
const backend = {
  createThread: () => ({ conversation: { ...thread, messages } }),
  appendMessage({ threadId, message }) {
    const entry = {
      id: `message-${messages.length + 1}`,
      threadId,
      sequence: messages.length + 1,
      author: "user",
      kind: "comment",
      body: message,
      createdAt,
    };
    messages.push(entry);
    return { message: entry };
  },
  listThreads: () => ({ page: { threads: [thread] } }),
  getThread: () => ({
    conversation: {
      ...thread,
      messages: messages.map((message) => message.author === "team"
        ? { ...message, offeredToClientAt: createdAt }
        : message),
    },
  }),
};
const app = createEmseepea({
  name: "feedback-conversation-eval",
  version: "0.0.0",
  tools: defineFeedbackConversation({
    requiredScopes: ["feedback"],
    backend,
  }),
  authentication: insecureTestAuthentication(["feedback"]),
});
const running = await serveEmseepea(app, {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});
console.log(`Feedback conversation eval server listening at ${running.url}`);

process.once("SIGINT", () => void running.close());
process.once("SIGTERM", () => void running.close());
