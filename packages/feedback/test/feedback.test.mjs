import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepea } from "@emseepea/server";
import {
  insecureTestAuthentication,
  startEmseepea,
} from "@emseepea/testing";
import {
  defineFeedbackConversation,
  defineFeedbackSubmission,
} from "../dist/index.js";
import { z } from "zod";

const now = "2026-09-10T00:00:00.000Z";

test("records useful public detail and application-declared context", async (t) => {
  const calls = [];
  const events = [];
  const tool = defineFeedbackSubmission({
    access: "public",
    scope: "pea-guide",
    contextSchema: z.strictObject({
      feature: z.string().describe("Feature involved in the observation."),
    }),
    backend: {
      submit(command, context) {
        calls.push({ command, scope: context.scope });
        return {
          id: "feedback-1",
          recordedAt: now,
          events: [{
            id: "feedback.created:feedback-1",
            type: "feedback.message.added",
            occurredAt: now,
            threadId: "feedback-1",
            messageId: "feedback-1",
            author: "user",
          }],
        };
      },
    },
    hooks: [
      (event) => events.push(event),
      () => { throw new Error("email unavailable"); },
      () => new Promise(() => {}),
    ],
  });
  const running = await startEmseepea(t, createEmseepea({
    name: "feedback-test",
    version: "0.0.0",
    tools: [tool],
    operationTimeoutMs: 150,
  }));
  const client = await running.connect();

  const listed = await client.listTools();
  assert.equal(listed.tools[0].inputSchema.properties.detail.description,
    "What happened, what helped or failed, what was harder than it should have been, or what was surprising.");
  const result = await client.callTool({
    name: "submit-feedback",
    arguments: {
      observation: "friction",
      detail: "Finding the seed filter took three attempts.",
      context: { feature: "seed filter" },
    },
  }, { timeout: 2_000 });

  assert.equal(result.isError, false);
  assert.deepEqual(result.structuredContent, { id: "feedback-1", recordedAt: now });
  assert.deepEqual(calls, [{
    command: {
      observation: "friction",
      detail: "Finding the seed filter took three attempts.",
      context: { feature: "seed filter" },
    },
    scope: "pea-guide",
  }]);
  assert.deepEqual(events, [{
    id: "feedback.created:feedback-1",
    type: "feedback.message.added",
    occurredAt: now,
    scope: "pea-guide",
    threadId: "feedback-1",
    messageId: "feedback-1",
    author: "user",
  }]);
  assert.doesNotMatch(JSON.stringify(events), /Finding the seed filter|seed filter/);
});

test("keeps protected feedback conversations scoped, append-only, and inspectable", async (t) => {
  const threads = new Map();
  const events = [];
  const backend = {
    createThread({ subject, message }, context) {
      const conversation = {
        id: "thread-1",
        subject,
        status: "open",
        createdAt: now,
        updatedAt: now,
        messages: [{
          id: "message-1",
          threadId: "thread-1",
          sequence: 1,
          author: "user",
          kind: "comment",
          body: message,
          createdAt: now,
        }],
      };
      threads.set(`${context.scope}:thread-1`, conversation);
      return {
        conversation,
        events: [{
          id: "feedback.thread.created:thread-1",
          type: "feedback.thread.created",
          occurredAt: now,
          threadId: "thread-1",
          author: "user",
        }],
      };
    },
    appendMessage({ threadId, message }, context) {
      const conversation = threads.get(`${context.scope}:${threadId}`);
      if (!conversation) throw new Error("not found");
      const entry = {
        id: `message-${conversation.messages.length + 1}`,
        threadId,
        sequence: conversation.messages.length + 1,
        author: "user",
        kind: "comment",
        body: message,
        createdAt: now,
      };
      conversation.messages.push(entry);
      return { message: entry };
    },
    listThreads(_query, context) {
      return {
        page: {
          threads: [...threads.entries()]
            .filter(([key]) => key.startsWith(`${context.scope}:`))
            .map(([, { messages: _messages, ...thread }]) => thread),
        },
      };
    },
    getThread({ threadId }, context) {
      const conversation = threads.get(`${context.scope}:${threadId}`);
      if (!conversation) throw new Error("not found");
      const reply = conversation.messages.find(({ author }) => author === "team");
      const firstOffer = reply && !reply.offeredToClientAt;
      if (firstOffer) reply.offeredToClientAt = now;
      return {
        conversation,
        events: firstOffer ? [{
          id: `feedback.message.offered-to-client:${reply.id}`,
          type: "feedback.message.offered-to-client",
          occurredAt: now,
          threadId,
          messageId: reply.id,
          author: "team",
        }] : undefined,
      };
    },
  };
  const tools = defineFeedbackConversation({
    requiredScopes: ["feedback"],
    backend,
    hooks: [(event) => events.push(event)],
  });
  const running = await startEmseepea(t, createEmseepea({
    name: "conversation-test",
    version: "0.0.0",
    tools,
    authentication: insecureTestAuthentication(["feedback"]),
  }));
  const client = await running.connect("test-token");

  assert.deepEqual((await client.listTools()).tools.map(({ name }) => name), [
    "create-feedback-thread",
    "reply-to-feedback-thread",
    "list-feedback-threads",
    "get-feedback-thread",
  ]);
  const created = await client.callTool({
    name: "create-feedback-thread",
    arguments: { subject: "Seed search friction", message: "The filters were difficult to find." },
  });
  assert.equal(created.isError, false);
  assert.equal(created.structuredContent.messages[0].body, "The filters were difficult to find.");

  const conversation = threads.get("emseepea-test-client:thread-1");
  conversation.messages.push({
    id: "message-2",
    threadId: "thread-1",
    sequence: 2,
    author: "team",
    kind: "comment",
    body: "We moved the filters above the results.",
    createdAt: now,
  });
  const read = await client.callTool({
    name: "get-feedback-thread",
    arguments: { threadId: "thread-1" },
  });
  assert.equal(read.structuredContent.messages[1].body, "We moved the filters above the results.");
  assert.equal(read.structuredContent.messages[1].offeredToClientAt, now);

  const replied = await client.callTool({
    name: "reply-to-feedback-thread",
    arguments: { threadId: "thread-1", message: "That fixes it, thank you." },
  });
  assert.equal(replied.structuredContent.sequence, 3);
  assert.deepEqual(conversation.messages.map(({ author }) => author), ["user", "team", "user"]);
  assert.ok(events.some(({ type }) => type === "feedback.message.offered-to-client"));
  assert.doesNotMatch(JSON.stringify(events), /filters|thank you/);
});

test("rejects unsafe access and invalid backend output without leaking it", async (t) => {
  assert.throws(() => defineFeedbackSubmission({
    access: "protected",
    backend: { submit: () => ({ id: "unused", recordedAt: now }) },
  }), /require at least one scope/);

  const tool = defineFeedbackSubmission({
    access: "public",
    backend: { submit: () => ({ id: "bad", recordedAt: "secret-invalid-output" }) },
  });
  const running = await startEmseepea(t, createEmseepea({
    name: "invalid-feedback-test",
    version: "0.0.0",
    tools: [tool],
  }));
  const result = await (await running.connect()).callTool({
    name: "submit-feedback",
    arguments: { observation: "error", detail: "The search failed." },
  });
  assert.equal(result.isError, true);
  assert.doesNotMatch(JSON.stringify(result), /secret-invalid-output/);
});
