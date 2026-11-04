import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import { createEmseepea } from "@emseepea/server";
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";
import { defineFeedbackConversation, defineFeedbackSubmission } from "@emseepea/feedback";
import { createGitHubFeedbackBackend, createGitHubFeedbackSubmissionBackend } from "@emseepea/feedback/github";
import { ingestGitHubFeedbackWebhook } from "@emseepea/feedback/webhooks";
import { createFeedbackReplyEventsOptions, publishFeedbackTeamReplyEvent } from "@emseepea/feedback/mcp-events";

const now = "2026-11-05T00:00:00.000Z";

test("GitHub-backed public feedback results and reply events use matching neutral references", async (t) => {
  const scope = "owner-a";
  const scopeHash = createHash("sha256").update(scope).digest("hex").slice(0, 24);
  const issue = { number: 123, title: "Synthetic feedback", body: "", state: "open",
    created_at: now, updated_at: now, user: { login: "synthetic" },
    labels: [], assignees: [], milestone: null };
  const comments = [{ id: 456, body: "The filter is fixed.", created_at: now, user: { login: "support" } }];
  const requests = [];
  const options = { owner: "synthetic", repository: "support", token: "synthetic-only",
    async fetch(request, init = {}) {
      const url = new URL(request);
      const body = init.body ? JSON.parse(init.body) : undefined;
      requests.push({ method: init.method ?? "GET", path: url.pathname });
      if (url.pathname.includes("/labels/")) return Response.json({ name: "existing" });
      if (url.pathname.endsWith("/issues") && init.method === "POST") {
        issue.body = body.body; issue.labels = body.labels;
        return Response.json(issue, { status: 201 });
      }
      if (url.pathname.endsWith("/issues")) return Response.json([issue]);
      if (url.pathname.endsWith("/issues/123")) return Response.json(issue);
      if (url.pathname.endsWith("/comments") && init.method === "POST") {
        const comment = { id: 457, body: body.body, created_at: now, user: { login: "synthetic" } };
        comments.push(comment); return Response.json(comment, { status: 201 });
      }
      if (url.pathname.endsWith("/comments")) return Response.json(comments);
      if (url.pathname.endsWith("/reactions")) return Response.json({ created_at: now }, { status: 201 });
      throw new Error("Unexpected synthetic provider request");
    } };
  const queued = [];
  const app = createEmseepea({ name: "neutral-feedback", version: "1",
    authentication: insecureTestAuthentication(["feedback"]),
    tools: [defineFeedbackSubmission({ access: "public", scope,
      backend: createGitHubFeedbackSubmissionBackend(options) }),
    ...defineFeedbackConversation({ requiredScopes: ["feedback"], scope,
      backend: createGitHubFeedbackBackend(options) })],
    events: createFeedbackReplyEventsOptions({ ownerKey: () => scope,
      canReadThread: (owner, thread) => owner === scope && thread === "feedback-123",
      health: () => true, store: {
        async get() { return null; }, async put() {}, async delete() {},
        async list() { return [{ id: "subscription", ownerKey: scope, name: "feedback.reply.ready",
          arguments: { threadId: "feedback-123" }, url: "https://callback.example/events",
          secret: "synthetic-only", expiresAt: Date.now() + 60_000 }]; },
        async enqueue(row) { queued.push(row); }, async claimDue() { return []; },
        async complete() {}, async reschedule() {},
      } }),
  });
  const running = await startEmseepea(t, app);
  const client = await running.connect("test-token");
  const submit = await client.callTool({ name: "submit-feedback",
    arguments: { observation: "friction", detail: "The filter took extra steps." } });
  assert.equal(submit.isError, false);
  assert.equal(submit.structuredContent.id, "feedback-123");
  const listed = await client.callTool({ name: "list-feedback-threads", arguments: {} });
  assert.equal(listed.structuredContent.threads[0].id, "feedback-123");
  const read = await client.callTool({ name: "get-feedback-thread", arguments: { threadId: "feedback-123" } });
  assert.equal(read.isError, false);
  assert.deepEqual(read.structuredContent.messages.map(({ id }) => id), ["feedback-123-body", "message-456"]);
  assert.equal(read.structuredContent.messages.every(({ threadId }) => threadId === "feedback-123"), true);
  const reply = await client.callTool({ name: "reply-to-feedback-thread",
    arguments: { threadId: "feedback-123", message: "Thanks for fixing the filter." } });
  assert.equal(reply.isError, false);
  assert.equal(reply.structuredContent.id, "message-457");
  const beforeInvalid = requests.length;
  for (const threadId of ["github-issue-123", "feedback-123-extra"]) {
    const invalid = await client.callTool({ name: "get-feedback-thread", arguments: { threadId } });
    assert.equal(invalid.isError, true);
  }
  assert.equal(requests.length, beforeInvalid);
  await assert.rejects(createGitHubFeedbackBackend(options).getThread({ threadId: "feedback-123" }, {
    scope: "another-owner", signal: new AbortController().signal, deadlineMs: Date.now() + 60_000,
  }), /not found/);

  const secret = "0123456789abcdef0123456789abcdef";
  const body = Buffer.from(JSON.stringify({ action: "created", repository: { full_name: "synthetic/support" },
    issue: { number: 123, updated_at: now, labels: [{ name: `emseepea-${scopeHash}` }] }, comment: comments[0] }));
  const events = await ingestGitHubFeedbackWebhook({ body, headers: {
    "x-github-delivery": "delivery-1", "x-github-event": "issue_comment",
    "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
  } }, { secret, owner: "synthetic", repository: "support",
    store: { claim: () => true, resolveScope: (hash) => hash === scopeHash ? scope : undefined } },
  { scope, signal: new AbortController().signal, deadlineMs: Date.now() + 60_000 });
  assert.equal(await publishFeedbackTeamReplyEvent(app, events[0]), true);
  assert.equal(queued.length, 1);
  assert.deepEqual(JSON.parse(queued[0].body).data, { scope, threadId: "feedback-123",
    messageId: "message-456", sourceEventId: "event:delivery-1" });
  assert.doesNotMatch(JSON.stringify([submit, listed, read, reply, JSON.parse(queued[0].body)]), /github/i);
});
