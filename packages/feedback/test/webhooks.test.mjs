import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  ingestGitHubFeedbackWebhook,
  ingestZendeskFeedbackWebhook,
} from "../dist/webhooks.js";

const webhookSecret = "0123456789abcdef0123456789abcdef";
const liveContext = () => ({
  scope: "unused",
  signal: new AbortController().signal,
  deadlineMs: Date.now() + 10_000,
});

test("GitHub webhook ingestion requires 32 secret bytes, authenticates, scopes, maps, and deduplicates", async () => {
  const claimed = new Set();
  const store = {
    claim(id) {
      if (claimed.has(id)) return false;
      claimed.add(id);
      return true;
    },
    resolveScope(hash) {
      return hash === "scopehash" ? "client-a" : undefined;
    },
  };
  const body = bytes({
    action: "created",
    repository: { full_name: "emseepea/support" },
    issue: {
      number: 42,
      updated_at: "2026-09-10T00:00:00.000Z",
      labels: [{ name: "emseepea-scopehash" }],
    },
    comment: {
      id: 91,
      body: "Support fixed the filter.",
      created_at: "2026-09-10T00:00:00.000Z",
    },
  });
  const input = {
    body,
    headers: {
      "x-github-delivery": "delivery-1",
      "x-github-event": "issue_comment",
      "x-hub-signature-256": `sha256=${createHmac("sha256", webhookSecret).update(body).digest("hex")}`,
    },
  };
  const options = { secret: webhookSecret, owner: "emseepea", repository: "support", store };

  await assert.rejects(
    ingestGitHubFeedbackWebhook(input, { ...options, secret: webhookSecret.slice(1) }, liveContext()),
    /at least 32 bytes/,
  );
  const events = await ingestGitHubFeedbackWebhook(input, options, liveContext());
  assert.deepEqual(events, [{
    id: "github:delivery-1",
    type: "feedback.message.added",
    occurredAt: "2026-09-10T00:00:00.000Z",
    scope: "client-a",
    threadId: "github-issue-42",
    messageId: "github-comment-91",
    author: "team",
  }]);
  assert.deepEqual(await ingestGitHubFeedbackWebhook(input, options, liveContext()), []);
  assert.deepEqual([...claimed], ["github:delivery-1"]);
});

test("webhook ingestion rejects bad authentication, input, destination, size, and deadline", async () => {
  const body = bytes({
    action: "closed",
    repository: { full_name: "wrong/repository" },
    issue: {
      number: 42,
      updated_at: "2026-09-10T00:00:00.000Z",
      labels: [{ name: "emseepea-scopehash" }],
    },
  });
  const store = { claim: () => true, resolveScope: () => "client-a" };
  const options = { secret: webhookSecret, owner: "emseepea", repository: "support", store };
  const signed = {
    body,
    headers: {
      "x-github-delivery": "delivery-2",
      "x-github-event": "issues",
      "x-hub-signature-256": `sha256=${createHmac("sha256", webhookSecret).update(body).digest("hex")}`,
    },
  };

  await assert.rejects(ingestGitHubFeedbackWebhook({ ...signed, headers: {} }, options, liveContext()), /signature/);
  await assert.rejects(ingestGitHubFeedbackWebhook(signed, options, liveContext()), /wrong repository/);
  await assert.rejects(ingestGitHubFeedbackWebhook(
    { ...signed, body: new Uint8Array(65 * 1024) },
    options,
    liveContext(),
  ), /64 KiB/);
  const validBody = bytes({
    action: "closed",
    repository: { full_name: "emseepea/support" },
    issue: {
      number: 42,
      updated_at: "2026-09-10T00:00:00.000Z",
      labels: [{ name: "emseepea-scopehash" }],
    },
  });
  await assert.rejects(ingestGitHubFeedbackWebhook(
    {
      body: validBody,
      headers: {
        ...signed.headers,
        "x-hub-signature-256": `sha256=${createHmac("sha256", webhookSecret).update(validBody).digest("hex")}`,
      },
    },
    options,
    { ...liveContext(), deadlineMs: Date.now() - 1 },
  ), /deadline expired/);

  const validHeaders = {
    ...signed.headers,
    "x-hub-signature-256": `sha256=${createHmac("sha256", webhookSecret).update(validBody).digest("hex")}`,
  };
  for (const labels of [[], [{ name: "emseepea-one" }, { name: "emseepea-two" }]]) {
    const ambiguousBody = bytes({
      action: "closed",
      repository: { full_name: "emseepea/support" },
      issue: { number: 42, updated_at: "2026-09-10T00:00:00.000Z", labels },
    });
    await assert.rejects(ingestGitHubFeedbackWebhook({
      body: ambiguousBody,
      headers: {
        ...validHeaders,
        "x-hub-signature-256": `sha256=${createHmac("sha256", webhookSecret).update(ambiguousBody).digest("hex")}`,
      },
    }, options, liveContext()), /exactly one feedback scope/);
  }
  await assert.rejects(ingestGitHubFeedbackWebhook({
    body: validBody,
    headers: { ...validHeaders, "x-hub-signature-256": `sha256=${createHmac("sha256", "").update(validBody).digest("hex")}` },
  }, { ...options, secret: "" }, liveContext()), /at least 32 bytes/);
});

test("GitHub webhook ingestion maps every supported native issue action", async () => {
  const actions = ["assigned", "closed", "labeled", "milestoned", "reopened", "unassigned", "unlabeled"];
  for (const action of actions) {
    const body = bytes({
      action,
      repository: { full_name: "emseepea/support" },
      issue: {
        number: 42,
        updated_at: "2026-09-10T00:00:00.000Z",
        labels: [{ name: "emseepea-scopehash" }],
      },
    });
    const events = await ingestGitHubFeedbackWebhook({
      body,
      headers: {
        "x-github-delivery": `delivery-${action}`,
        "x-github-event": "issues",
        "x-hub-signature-256": `sha256=${createHmac("sha256", webhookSecret).update(body).digest("hex")}`,
      },
    }, {
      secret: webhookSecret, owner: "emseepea", repository: "support",
      store: { claim: () => true, resolveScope: () => "client-a" },
    }, liveContext());
    assert.equal(events[0].type, "feedback.status.changed");
  }
});

test("Zendesk webhook ingestion requires 32 secret bytes and maps configured public events", async () => {
  const body = bytes({
    eventId: "audit-9",
    subdomain: "support",
    ticketId: 73,
    scopeTag: "emseepea_0123456789abcdef01234567",
    occurredAt: "2026-09-10T00:00:00.000Z",
    change: { type: "public_comment", commentId: 8, author: "team" },
  });
  const sentAt = "1788998400";
  const signature = createHmac("sha256", webhookSecret)
    .update(`${sentAt}${new TextDecoder().decode(body)}`)
    .digest("base64");
  const input = {
    body,
    headers: {
      "x-zendesk-webhook-signature": signature,
      "x-zendesk-webhook-signature-timestamp": sentAt,
    },
  };
  const options = {
    secret: webhookSecret,
    subdomain: "support",
    store: { claim: () => true, resolveScope: () => "client-a" },
  };
  await assert.rejects(
    ingestZendeskFeedbackWebhook(input, { ...options, secret: webhookSecret.slice(1) }, liveContext()),
    /at least 32 bytes/,
  );
  const events = await ingestZendeskFeedbackWebhook(input, options, liveContext());
  assert.equal(events[0].id, "zendesk:audit-9");
  assert.equal(events[0].messageId, "zendesk-comment-8");
});

test("webhook deduplication namespaces provider IDs and maps Zendesk status changes", async () => {
  const claimed = new Set();
  const store = {
    claim(id) {
      if (claimed.has(id)) return false;
      claimed.add(id);
      return true;
    },
    resolveScope: () => "client-a",
  };
  const githubBody = bytes({
    action: "closed",
    repository: { full_name: "emseepea/support" },
    issue: {
      number: 42,
      updated_at: "2026-09-10T00:00:00.000Z",
      labels: [{ name: "emseepea-scopehash" }],
    },
  });
  await ingestGitHubFeedbackWebhook({
    body: githubBody,
    headers: {
      "x-github-delivery": "same-id",
      "x-github-event": "issues",
      "x-hub-signature-256": `sha256=${createHmac("sha256", webhookSecret).update(githubBody).digest("hex")}`,
    },
  }, { secret: webhookSecret, owner: "emseepea", repository: "support", store }, liveContext());

  const zendeskBody = bytes({
    eventId: "same-id",
    subdomain: "support",
    ticketId: 73,
    scopeTag: "emseepea_0123456789abcdef01234567",
    occurredAt: "2026-09-10T00:00:00.000Z",
    change: { type: "status_changed" },
  });
  const sentAt = "1788998400";
  const events = await ingestZendeskFeedbackWebhook({
    body: zendeskBody,
    headers: {
      "x-zendesk-webhook-signature": createHmac("sha256", webhookSecret)
        .update(`${sentAt}${new TextDecoder().decode(zendeskBody)}`).digest("base64"),
      "x-zendesk-webhook-signature-timestamp": sentAt,
    },
  }, { secret: webhookSecret, subdomain: "support", store }, liveContext());

  assert.equal(events[0].type, "feedback.status.changed");
  assert.deepEqual([...claimed], ["github:same-id", "zendesk:same-id"]);
});

function bytes(value) {
  return new TextEncoder().encode(JSON.stringify(value));
}
