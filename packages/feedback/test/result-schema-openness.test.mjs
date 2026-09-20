import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepea } from "@emseepea/server";
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";
import { defineFeedbackConversation, defineFeedbackSubmission } from "../dist/index.js";

const now = "2026-09-20T00:00:00.000Z";

// Every object node in a published result schema, with a path, so a failure
// names the exact node that is closed rather than just saying "somewhere".
function closedNodes(node, path = "") {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => closedNodes(item, `${path}[${index}]`));
  }
  if (node === null || typeof node !== "object") return [];
  const here = node.additionalProperties === false ? [path || "(root)"] : [];
  return [
    ...here,
    ...Object.entries(node).flatMap(([key, value]) => closedNodes(value, path ? `${path}.${key}` : key)),
  ];
}

test("the feedback submission tool publishes an open result schema", async (t) => {
  const tool = defineFeedbackSubmission({
    access: "public",
    scope: "openness",
    backend: { submit: () => ({ id: "feedback-1", recordedAt: now }) },
  });
  const running = await startEmseepea(t, createEmseepea({
    name: "feedback-openness-test",
    version: "0.0.0",
    tools: [tool],
  }));
  const client = await running.connect();
  const [listed] = (await client.listTools()).tools;
  assert.deepEqual(closedNodes(listed.outputSchema), []);
});

test("every feedback conversation tool publishes an open result schema", async (t) => {
  const thread = { id: "t-1", subject: "s", status: "open", createdAt: now, updatedAt: now };
  const message = {
    id: "m-1", threadId: "t-1", sequence: 1, author: "user", kind: "comment",
    body: "b", createdAt: now,
  };
  const conversation = { ...thread, messages: [message] };
  const tools = defineFeedbackConversation({
    requiredScopes: ["feedback"],
    backend: {
      createThread: () => ({ conversation }),
      appendMessage: () => ({ message }),
      listThreads: () => ({ page: { threads: [thread] } }),
      getThread: () => ({ conversation }),
    },
  });
  const running = await startEmseepea(t, createEmseepea({
    name: "conversation-openness-test",
    version: "0.0.0",
    tools,
    authentication: insecureTestAuthentication(["feedback"]),
  }));
  const client = await running.connect("test-token");
  for (const listed of (await client.listTools()).tools) {
    assert.deepEqual(closedNodes(listed.outputSchema), [], listed.name);
  }
});

// Pins the two checks the release note says survive. The note's truth otherwise
// rests on strictness being inherited through `.omit()`, which is exactly the
// kind of unpinned derivation Problem 006 was about.
test("a submission backend's stray top-level key is dropped but a stray event key is rejected", async (t) => {
  const now = "2026-09-20T00:00:00.000Z";
  const event = {
    id: "e-1", type: "feedback.message.added", occurredAt: now,
    threadId: "t-1", messageId: "m-1", author: "user",
  };
  const start = async (result) => {
    const running = await startEmseepea(t, createEmseepea({
      name: "submission-strictness-test",
      version: "0.0.0",
      tools: [defineFeedbackSubmission({
        access: "public",
        scope: "strictness",
        backend: { submit: () => result },
      })],
    }));
    return (await running.connect()).callTool({
      name: "submit-feedback",
      arguments: { observation: "friction", detail: "The filters were hard to find." },
    });
  };

  const dropped = await start({ id: "f-1", recordedAt: now, surprise: "extra" });
  assert.notEqual(dropped.isError, true);
  assert.equal(Object.hasOwn(dropped.structuredContent, "surprise"), false);

  const rejected = await start({ id: "f-2", recordedAt: now, events: [{ ...event, surprise: "extra" }] });
  assert.equal(rejected.isError, true);
});
