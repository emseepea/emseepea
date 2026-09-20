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

// Pins the one strict check the release note says survives. Its truth rests on
// the conversation wrappers staying strict at their top level while everything
// they contain is open, which is exactly the kind of per-level distinction
// Problem 006 shows is easy to get wrong.
test("a conversation backend's stray top-level key is still rejected", async (t) => {
  const now = "2026-09-20T00:00:00.000Z";
  const thread = { id: "t-1", subject: "s", status: "open", createdAt: now, updatedAt: now };
  const tools = defineFeedbackConversation({
    requiredScopes: ["feedback"],
    backend: {
      createThread: () => ({ conversation: { ...thread, messages: [] }, surprise: "extra" }),
      appendMessage: () => ({ message: {} }),
      listThreads: () => ({ page: { threads: [] } }),
      getThread: () => ({ conversation: { ...thread, messages: [] } }),
    },
  });
  const running = await startEmseepea(t, createEmseepea({
    name: "conversation-strictness-test",
    version: "0.0.0",
    tools,
    authentication: insecureTestAuthentication(["feedback"]),
  }));
  const client = await running.connect("test-token");
  const result = await client.callTool({
    name: "create-feedback-thread",
    arguments: { subject: "Seed search friction", message: "The filters were hard to find." },
  });
  assert.equal(result.isError, true);
});
