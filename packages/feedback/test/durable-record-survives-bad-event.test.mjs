import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepea } from "@emseepea/server";
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";
import { defineFeedbackConversation, defineFeedbackSubmission } from "../dist/index.js";

const now = "2026-09-20T00:00:00.000Z";

// The backend has already durably recorded the feedback by the time it returns.
// Events only drive best-effort hooks, so a malformed one must not turn a
// recorded submission into a failed tool call.
test("a malformed event does not fail a submission the backend already recorded", async (t) => {
  const recorded = [];
  const seen = [];
  const running = await startEmseepea(t, createEmseepea({
    name: "durable-record-test",
    version: "0.0.0",
    tools: [defineFeedbackSubmission({
      access: "public",
      scope: "durability",
      backend: {
        submit() {
          recorded.push("f-1");
          return {
            id: "f-1",
            recordedAt: now,
            events: [
              { id: "e-good", type: "feedback.message.added", occurredAt: now, threadId: "t-1" },
              { id: "e-bad", type: "not-a-real-event-type", occurredAt: now, threadId: "t-1" },
            ],
          };
        },
      },
      hooks: [(event) => seen.push(event.id)],
    })],
  }));
  const client = await running.connect();

  const result = await client.callTool({
    name: "submit-feedback",
    arguments: { observation: "friction", detail: "The filters were hard to find." },
  });

  assert.deepEqual(recorded, ["f-1"], "the backend recorded the feedback");
  assert.notEqual(result.isError, true, "a recorded submission must not report failure");
  assert.equal(result.structuredContent.id, "f-1");
  // The good event still reaches hooks; the malformed one is skipped, not fatal.
  assert.deepEqual(seen, ["e-good"]);
});

test("a submission backend's stray top-level key is dropped, not returned", async (t) => {
  const running = await startEmseepea(t, createEmseepea({
    name: "submission-drop-test",
    version: "0.0.0",
    tools: [defineFeedbackSubmission({
      access: "public",
      scope: "drop",
      backend: { submit: () => ({ id: "f-2", recordedAt: now, surprise: "extra" }) },
    })],
  }));
  const client = await running.connect();
  const result = await client.callTool({
    name: "submit-feedback",
    arguments: { observation: "friction", detail: "The filters were hard to find." },
  });
  assert.notEqual(result.isError, true);
  assert.equal(Object.hasOwn(result.structuredContent, "surprise"), false);
});

test("a stray key inside an event skips that event without failing the call", async (t) => {
  const seen = [];
  const running = await startEmseepea(t, createEmseepea({
    name: "event-straykey-test",
    version: "0.0.0",
    tools: [defineFeedbackSubmission({
      access: "public",
      scope: "stray",
      backend: {
        submit: () => ({
          id: "f-3",
          recordedAt: now,
          events: [
            { id: "e-ok", type: "feedback.message.added", occurredAt: now, threadId: "t-1" },
            { id: "e-stray", type: "feedback.message.added", occurredAt: now, threadId: "t-1", surprise: "extra" },
          ],
        }),
      },
      hooks: [(event) => seen.push(event.id)],
    })],
  }));
  const client = await running.connect();
  const result = await client.callTool({
    name: "submit-feedback",
    arguments: { observation: "friction", detail: "The filters were hard to find." },
  });
  assert.notEqual(result.isError, true);
  assert.deepEqual(seen, ["e-ok"], "the event carrying a key we do not declare is skipped");
});

// Nothing about the events a backend returns may fail a call for work it has
// already committed — not their contents, not their shape, not how many.
const submitReturning = (t, result, hooks = []) => startEmseepea(t, createEmseepea({
  name: "event-shape-test",
  version: "0.0.0",
  tools: [defineFeedbackSubmission({
    access: "public", scope: "shape", backend: { submit: () => result }, hooks,
  })],
})).then((running) => running.connect()).then((client) => client.callTool({
  name: "submit-feedback",
  arguments: { observation: "friction", detail: "The filters were hard to find." },
}));

test("more events than we will process does not fail a recorded submission", async (t) => {
  const seen = [];
  const many = Array.from({ length: 101 }, (_, index) => ({
    id: `e-${index}`, type: "feedback.message.added", occurredAt: now, threadId: "t-1",
  }));
  const result = await submitReturning(t, { id: "f-4", recordedAt: now, events: many },
    [(event) => seen.push(event.id)]);
  assert.notEqual(result.isError, true);
  assert.equal(result.structuredContent.id, "f-4");
  assert.equal(seen.length, 100, "hooks see the capped number, and the call still succeeds");
});

test("events that are not a list does not fail a recorded submission", async (t) => {
  const seen = [];
  const result = await submitReturning(t, { id: "f-5", recordedAt: now, events: null },
    [(event) => seen.push(event.id)]);
  assert.notEqual(result.isError, true);
  assert.equal(result.structuredContent.id, "f-5");
  assert.deepEqual(seen, []);
});

// The conversation tools write durably too, and they share the event path. Every
// test above drives the submission tool, so without this one a change scoped to
// a conversation result schema could bring the hazard back with the suite green.
test("a bad event does not fail a thread the backend already created", async (t) => {
  const seen = [];
  const thread = { id: "t-1", subject: "s", status: "open", createdAt: now, updatedAt: now };
  const running = await startEmseepea(t, createEmseepea({
    name: "conversation-durability-test",
    version: "0.0.0",
    tools: defineFeedbackConversation({
      requiredScopes: ["feedback"],
      backend: {
        createThread: () => ({
          conversation: { ...thread, messages: [] },
          events: [
            { id: "e-ok", type: "feedback.thread.created", occurredAt: now, threadId: "t-1" },
            { id: "e-bad", type: "not-a-real-event-type", occurredAt: now, threadId: "t-1" },
          ],
        }),
        appendMessage: () => ({ message: {} }),
        listThreads: () => ({ page: { threads: [] } }),
        getThread: () => ({ conversation: { ...thread, messages: [] }, events: null }),
      },
      hooks: [(event) => seen.push(event.id)],
    }),
    authentication: insecureTestAuthentication(["feedback"]),
  }));
  const client = await running.connect("test-token");

  const created = await client.callTool({
    name: "create-feedback-thread",
    arguments: { subject: "Seed search friction", message: "The filters were hard to find." },
  });
  assert.notEqual(created.isError, true, "a created thread must not report failure");
  assert.equal(created.structuredContent.id, "t-1");
  assert.deepEqual(seen, ["e-ok"]);

  // Events that are not a list are survivable on this path too.
  const read = await client.callTool({ name: "get-feedback-thread", arguments: { threadId: "t-1" } });
  assert.notEqual(read.isError, true);
});

// reply-to-feedback-thread is one of the four paths that dispatch hooks, and it
// appends durably. Without this, a change scoped to its own result schema could bring
// the defect back with every other test green.
test("a bad event does not fail a message the backend already appended", async (t) => {
  const seen = [];
  const thread = { id: "t-1", subject: "s", status: "open", createdAt: now, updatedAt: now };
  const message = {
    id: "m-1", threadId: "t-1", sequence: 1, author: "user", kind: "comment",
    body: "b", createdAt: now,
  };
  const running = await startEmseepea(t, createEmseepea({
    name: "append-durability-test",
    version: "0.0.0",
    tools: defineFeedbackConversation({
      requiredScopes: ["feedback"],
      backend: {
        createThread: () => ({ conversation: { ...thread, messages: [] } }),
        appendMessage: () => ({
          message,
          events: [
            { id: "e-ok", type: "feedback.message.added", occurredAt: now, threadId: "t-1" },
            { id: "e-bad", type: "not-a-real-event-type", occurredAt: now, threadId: "t-1" },
          ],
        }),
        listThreads: () => ({ page: { threads: [] } }),
        getThread: () => ({ conversation: { ...thread, messages: [] } }),
      },
      hooks: [(event) => seen.push(event.id)],
    }),
    authentication: insecureTestAuthentication(["feedback"]),
  }));
  const client = await running.connect("test-token");
  const replied = await client.callTool({
    name: "reply-to-feedback-thread",
    arguments: { threadId: "t-1", message: "Still hard to find." },
  });
  assert.notEqual(replied.isError, true, "an appended message must not report failure");
  assert.equal(replied.structuredContent.id, "m-1");
  assert.deepEqual(seen, ["e-ok"]);
});

test("shape and size of an append backend's events cannot fail the call either", async (t) => {
  const thread = { id: "t-1", subject: "s", status: "open", createdAt: now, updatedAt: now };
  const message = {
    id: "m-1", threadId: "t-1", sequence: 1, author: "user", kind: "comment",
    body: "b", createdAt: now,
  };
  const many = Array.from({ length: 101 }, (_, index) => ({
    id: `e-${index}`, type: "feedback.message.added", occurredAt: now, threadId: "t-1",
  }));
  for (const events of [null, many]) {
    const running = await startEmseepea(t, createEmseepea({
      name: "append-shape-test",
      version: "0.0.0",
      tools: defineFeedbackConversation({
        requiredScopes: ["feedback"],
        backend: {
          createThread: () => ({ conversation: { ...thread, messages: [] } }),
          appendMessage: () => ({ message, events }),
          listThreads: () => ({ page: { threads: [] } }),
          getThread: () => ({ conversation: { ...thread, messages: [] } }),
        },
      }),
      authentication: insecureTestAuthentication(["feedback"]),
    }));
    const client = await running.connect("test-token");
    const replied = await client.callTool({
      name: "reply-to-feedback-thread",
      arguments: { threadId: "t-1", message: "Still hard to find." },
    });
    assert.notEqual(replied.isError, true, `events=${Array.isArray(events) ? "over cap" : "not a list"}`);
  }
});

test("a hostile events container cannot fail a recorded submission", async (t) => {
  // An Array subclass survives Array.isArray and reaches the iteration, so a
  // throwing iterator is the shape that kept escaping guards placed statement by
  // statement.
  class Hostile extends Array {
    get [Symbol.iterator]() { throw new Error("iterator trap"); }
  }
  const hostile = Hostile.from([
    { id: "e-1", type: "feedback.message.added", occurredAt: now, threadId: "t-1" },
  ]);
  const seen = [];
  const running = await startEmseepea(t, createEmseepea({
    name: "hostile-container-test",
    version: "0.0.0",
    tools: [defineFeedbackSubmission({
      access: "public",
      scope: "hostile",
      backend: { submit: () => ({ id: "f-6", recordedAt: now, events: hostile }) },
      hooks: [(event) => seen.push(event.id)],
    })],
  }));
  const client = await running.connect();
  const result = await client.callTool({
    name: "submit-feedback",
    arguments: { observation: "friction", detail: "The filters were hard to find." },
  });
  assert.notEqual(result.isError, true, "a recorded submission survives a hostile container");
  assert.equal(result.structuredContent.id, "f-6");
  assert.deepEqual(seen, []);
});
