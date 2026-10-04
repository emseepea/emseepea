import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepea, serveEmseepea } from "@emseepea/server";
import {
  createFeedbackReplyEventsOptions,
  publishFeedbackTeamReplyEvent,
} from "@emseepea/feedback/mcp-events";

const now = "2026-10-04T00:00:00.000Z";

test("team replies prompt only the authorized feedback owner to fetch the exact thread", async () => {
  const queued = [];
  const subscriptions = ["owner-a", "owner-b"].map((ownerKey) => ({
    id: `sub-${ownerKey}`, ownerKey, name: "feedback.reply.ready",
    arguments: { threadId: "shared-thread" },
    url: "https://callback.example.com/events", secret: "unused",
    expiresAt: Date.now() + 60_000,
  }));
  const allowed = new Set(["owner-a:shared-thread", "owner-b:shared-thread"]);
  const events = createFeedbackReplyEventsOptions({
    ownerKey: (auth) => auth.clientId,
    canReadThread: (ownerKey, threadId) => allowed.has(`${ownerKey}:${threadId}`),
    health: () => true,
    store: {
      async get() { return null; }, async put() {}, async delete() {},
      async list(name) { return subscriptions.filter((row) => row.name === name); },
      async enqueue(row) { queued.push(row); },
      async claimDue() { return []; }, async complete() {}, async reschedule() {},
    },
  });
  assert.equal(await events.authorize({ ownerKey: "owner-a", name: "feedback.reply.ready",
    arguments: { threadId: "shared-thread" }, phase: "subscribe" }), true);
  assert.equal(await events.authorize({ ownerKey: "owner-a", name: "feedback.reply.ready",
    arguments: { threadId: "another-thread" }, phase: "subscribe" }), false);

  const app = createEmseepea({ name: "feedback-events", version: "0.0.0",
    authentication: {
      verifier: { async verifyAccessToken(token) { return {
        token, clientId: token, scopes: ["events:read"],
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        resource: new URL("https://api.example/mcp"),
      }; } },
      metadata: { resourceServerUrl: new URL("https://api.example/mcp"), oauthMetadata: {
        issuer: "https://auth.example", authorization_endpoint: "https://auth.example/authorize",
        token_endpoint: "https://auth.example/token", response_types_supported: ["code"],
      } },
    },
    events,
  });
  const running = await serveEmseepea(app, { port: 0 });
  try {
    const userMessage = { id: "evt-user", type: "feedback.message.added", occurredAt: now,
      scope: "owner-a", threadId: "shared-thread", messageId: "message-1", author: "user" };
    assert.equal(await publishFeedbackTeamReplyEvent(app, userMessage), false);
    assert.equal(queued.length, 0);

    const teamReply = { ...userMessage, id: "evt-team", messageId: "message-2", author: "team" };
    assert.equal(await publishFeedbackTeamReplyEvent(app, teamReply), true);
    assert.deepEqual(queued.map(({ subscriptionId }) => subscriptionId), ["sub-owner-a"]);
    const published = JSON.parse(queued[0].body);
    assert.equal(published.name, "feedback.reply.ready");
    assert.deepEqual(published.data, {
      scope: "owner-a", threadId: "shared-thread", messageId: "message-2",
      sourceEventId: "evt-team",
    });
    assert.doesNotMatch(queued[0].body, /reply body|private note|email/i);

    assert.equal(await publishFeedbackTeamReplyEvent(app, teamReply), true);
    assert.equal(queued.length, 2);
    assert.notEqual(JSON.parse(queued[1].body).eventId, published.eventId);
    assert.equal(JSON.parse(queued[1].body).data.sourceEventId, "evt-team");

    allowed.delete("owner-a:shared-thread");
    assert.equal(await events.authorize({ ownerKey: "owner-a", name: "feedback.reply.ready",
      arguments: { threadId: "shared-thread" }, phase: "delivery" }), false);
    await publishFeedbackTeamReplyEvent(app, { ...teamReply, id: "evt-team-2" });
    assert.equal(queued.length, 2);
    await assert.rejects(publishFeedbackTeamReplyEvent(app, { ...teamReply, scope: "" }));
  } finally {
    await running.close();
  }
});
