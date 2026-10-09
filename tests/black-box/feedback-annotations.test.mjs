import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepea } from "@emseepea/server";
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";
import { defineFeedbackConversation, defineFeedbackSubmission } from "@emseepea/feedback";

const now = "2026-10-09T00:00:00.000Z";
const names = ["create-feedback-thread", "reply-to-feedback-thread", "list-feedback-threads", "get-feedback-thread"];
const operation = { "create-feedback-thread": "create", "reply-to-feedback-thread": "reply",
  "list-feedback-threads": "list", "get-feedback-thread": "get" };
const defaults = (name) => ({ readOnlyHint: name === "list-feedback-threads", destructiveHint: false,
  idempotentHint: ["list-feedback-threads", "get-feedback-thread"].includes(name), openWorldHint: true });
function fixture() {
  const state = { activityWrites: 0, inactivityNotice: true, submissions: 0, notifications: 0 };
  const backend = {
    createThread() { throw new Error("unused"); },
    appendMessage() { throw new Error("unused"); },
    getThread() { throw new Error("unused"); },
    listThreads() { state.activityWrites++; state.inactivityNotice = false; return { page: { threads: [] } }; },
  };
  const submission = { submit() { state.submissions++; return {
    id: "feedback-1", recordedAt: now,
    events: [{ id: "event-1", type: "feedback.message.added", occurredAt: now,
      threadId: "feedback-1", messageId: "feedback-1", author: "user" }],
  }; } };
  return { state, backend, submission };
}
async function connect(t, tools, discovery = "public") {
  const running = await startEmseepea(t, createEmseepea({ name: "annotation-check", version: "1", tools,
    authentication: { ...insecureTestAuthentication(["feedback"]), discovery },
  }));
  return running.connect("test-token");
}

test("conversation discovery preserves defaults with absent, empty, and undefined overrides", async (t) => {
  for (const annotations of [undefined, {}, { list: { readOnlyHint: undefined, destructiveHint: undefined } }]) {
    const f = fixture();
    const client = await connect(t, defineFeedbackConversation({ requiredScopes: ["feedback"], backend: f.backend, annotations }));
    const tools = (await client.listTools()).tools;
    assert.deepEqual(tools.map(({ name }) => name), names);
    for (const tool of tools) assert.deepEqual(tool.annotations, defaults(tool.name));
    assert.equal(f.state.activityWrites, 0);
  }
});

test("per-tool overrides reach public and protected MCP discovery and preserve composed effects", async (t) => {
  for (const discovery of ["public", "protected"]) {
    const f = fixture();
    const annotations = {
      create: { destructiveHint: true },
      reply: { idempotentHint: true, openWorldHint: false },
      list: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
      get: { idempotentHint: false },
    };
    const tools = defineFeedbackConversation({ requiredScopes: ["feedback"], backend: f.backend, annotations });
    // Definitions capture the checked configuration, not later mutations.
    annotations.list.readOnlyHint = true;
    const client = await connect(t, tools, discovery);
    const advertised = (await client.listTools()).tools;
    const expected = {
      ...annotations,
      list: { ...annotations.list, readOnlyHint: false },
    };
    for (const tool of advertised) assert.deepEqual(tool.annotations, { ...defaults(tool.name), ...expected[operation[tool.name]] });
    assert.equal(f.state.activityWrites, 0);
    for (let call = 0; call < 2; call++) {
      const result = await client.callTool({ name: "list-feedback-threads", arguments: {} });
      assert.equal(result.isError, false);
      assert.deepEqual(result.structuredContent, { threads: [] });
    }
    assert.equal(f.state.activityWrites, 2);
    assert.equal(f.state.inactivityNotice, false);
  }
});

test("submission overrides reach public and protected tool registration without changing hooks", async (t) => {
  for (const access of ["public", "protected"]) {
    const f = fixture();
    const annotations = { destructiveHint: true, openWorldHint: false };
    const tool = defineFeedbackSubmission({ access, ...(access === "protected" ? { requiredScopes: ["feedback"] } : {}),
      backend: f.submission, annotations, hooks: [() => { f.state.notifications++; }] });
    annotations.destructiveHint = false;
    const client = await connect(t, [tool]);
    const listed = (await client.listTools()).tools[0];
    assert.deepEqual(listed.annotations, { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false });
    const response = await client.callTool({ name: "submit-feedback", arguments: { observation: "friction", detail: "The filter took extra steps." } });
    assert.equal(response.isError, false);
    assert.equal(response.structuredContent.id, "feedback-1");
    assert.equal(f.state.submissions, 1);
    assert.equal(f.state.notifications, 1);
  }
});

test("submission supports every boolean override and preserves defaults for undefined values", async (t) => {
  for (const annotations of [undefined, {}, { destructiveHint: undefined },
    { readOnlyHint: true, destructiveHint: true, idempotentHint: true, openWorldHint: false }]) {
    const f = fixture();
    const client = await connect(t, [defineFeedbackSubmission({ access: "public", backend: f.submission, annotations })]);
    const listed = (await client.listTools()).tools[0];
    assert.deepEqual(listed.annotations, { ...defaults("submit-feedback"),
      ...Object.fromEntries(Object.entries(annotations ?? {}).filter(([, value]) => value !== undefined)) });
  }
});

test("invalid flags and unknown operation names fail before backend or hook execution", () => {
  const f = fixture();
  for (const annotations of [null, [], false, { readOnlyHint: "false" }, { destructiveHint: 1 },
    { idempotentHint: null }, { openWorldHint: {} }, { title: "unsupported" }, { destrutiveHint: true }]) {
    assert.throws(() => defineFeedbackSubmission({ access: "public", backend: f.submission, annotations }));
    assert.throws(() => defineFeedbackConversation({ requiredScopes: ["feedback"], backend: f.backend,
      annotations: { list: annotations } }));
  }
  for (const annotations of [null, [], false, { listThreads: {} }, { "list-feedback-threads": {} }, { "unknown-operation": {} }])
    assert.throws(() => defineFeedbackConversation({ requiredScopes: ["feedback"], backend: f.backend, annotations }));
  assert.deepEqual(f.state, { activityWrites: 0, inactivityNotice: true, submissions: 0, notifications: 0 });
});
