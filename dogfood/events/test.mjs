import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createFeedbackReplyEventsOptions,
  publishFeedbackTeamReplyEvent,
} from "@emseepea/feedback/mcp-events";
import { createEmseepea } from "@emseepea/server";
import { createDemoAuth, feedbackOwnerKey } from "./auth.mjs";
import { createFeedbackSmokeApp } from "./server.mjs";
import { openStore } from "./store.mjs";

const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "feedback-events-smoke-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("subscriptions survive restart and leases reject stale workers", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "emseepea-events-smoke-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "events.sqlite");
  const first = openStore(path);
  const expiresAt = Date.now() + 60_000;
  await first.subscription.put({ id: "sub-1", name: "feedback.reply.ready", ownerKey: "client-a", arguments: { threadId: "thread-1" },
    url: "https://example.com/callback", secret: "whsec_test", expiresAt });
  await first.subscription.enqueue({ id: "job-1", subscriptionId: "sub-1", eventId: "event-1", body: "{}", attempts: 0, nextAttemptAt: 1 });
  const initial = await first.subscription.claimDue(1, 100, 50);
  assert.equal(initial.length, 1);
  assert.deepEqual(await first.subscription.claimDue(1, 149, 50), []);
  first.close();

  const second = openStore(path);
  assert.deepEqual(await second.subscription.list("feedback.reply.ready"), [{
    id: "sub-1", name: "feedback.reply.ready", ownerKey: "client-a", arguments: { threadId: "thread-1" },
    url: "https://example.com/callback", secret: "whsec_test", expiresAt,
  }]);
  const recovered = await second.subscription.claimDue(1, 150, 50);
  assert.equal(recovered.length, 1);
  await second.subscription.complete("job-1", initial[0].leaseId);
  assert.deepEqual(await second.subscription.claimDue(1, 151, 50), []);
  await second.subscription.complete("job-1", recovered[0].leaseId);
  assert.deepEqual(await second.subscription.claimDue(1, 300, 50), []);
  assert.equal(second.healthy(), true);
  second.close();
});

test("ChatGPT-style DCR, PIN, PKCE, resource binding and bearer verification", async (t) => {
  const issuer = "https://auth.example.test";
  const resource = "https://mcp.example.test/mcp";
  const pin = "smoke-only-test-pin";
  const auth = createDemoAuth({ issuer, resource, pin, signingKey: randomBytes(32) });
  await new Promise((resolve) => auth.server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => auth.server.close(resolve)));
  const base = `http://127.0.0.1:${auth.server.address().port}`;
  const metadata = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
  assert.equal(metadata.code_challenge_methods_supported[0], "S256");
  const redirectUri = "https://chatgpt.com/connector_platform_oauth_redirect";
  const registration = await fetch(`${base}/register`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ redirect_uris: [redirectUri] }) });
  assert.equal(registration.status, 201);
  const { client_id: clientId } = await registration.json();
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri,
    code_challenge: challenge, code_challenge_method: "S256", resource, scope: "feedback events:read", state: "state-1" });
  const page = await fetch(`${base}/authorize?${params}`);
  assert.equal(page.status, 200);
  const consentPage = await page.text();
  assert.match(consentPage, /<title>Temporary feedback test sign in<\/title>/);
  assert.match(consentPage, /<h1>Temporary feedback test sign in<\/h1>/);
  assert.match(consentPage, /synthetic feedback conversations and feedback reply-event monitoring/);
  assert.match(consentPage, /<button>Authorize temporary feedback access<\/button>/);
  assert.doesNotMatch(consentPage, /notes|demo access/i);
  const denied = await fetch(`${base}/authorize`, { method: "POST", body: new URLSearchParams({ ...Object.fromEntries(params), pin: "wrong" }) });
  assert.equal(denied.status, 401);
  const deniedPage = await denied.text();
  assert.match(deniedPage, /role="alert">Incorrect PIN/);
  assert.match(deniedPage, /aria-invalid="true" aria-describedby="pin-error"/);
  assert.match(deniedPage, /<h1>Temporary feedback test sign in<\/h1>/);
  assert.match(deniedPage, /synthetic feedback conversations and feedback reply-event monitoring/);
  assert.match(deniedPage, /<button>Authorize temporary feedback access<\/button>/);
  assert.doesNotMatch(deniedPage, /notes|demo access/i);
  assert.match(deniedPage, /name="state" value="state-1"/);
  const consent = await fetch(`${base}/authorize`, { method: "POST", redirect: "manual",
    body: new URLSearchParams({ ...Object.fromEntries(params), pin }) });
  assert.equal(consent.status, 302);
  const callback = new URL(consent.headers.get("location"));
  assert.equal(callback.origin, "https://chatgpt.com");
  assert.equal(callback.searchParams.get("iss"), issuer);
  assert.equal(callback.searchParams.get("state"), "state-1");
  const token = await fetch(`${base}/token`, { method: "POST", body: new URLSearchParams({
    grant_type: "authorization_code", code: callback.searchParams.get("code"), code_verifier: verifier,
    client_id: clientId, redirect_uri: redirectUri, resource,
  }) });
  assert.equal(token.status, 200);
  const { access_token: accessToken } = await token.json();
  const verified = auth.verifyAccessToken(accessToken);
  assert.equal(verified.resource.href, resource);
  assert.deepEqual(verified.scopes, ["feedback", "events:read"]);
  assert.equal(feedbackOwnerKey(verified), clientId);
  assert.throws(() => feedbackOwnerKey(undefined), /normalized clientId/);
  assert.throws(() => feedbackOwnerKey({}), /normalized clientId/);
  assert.throws(() => auth.verifyAccessToken(`${accessToken}x`), /Invalid token/);
});

test("feedback storage is append-only, exact-thread scoped, and offers a team reply once", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "emseepea-feedback-smoke-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = openStore(join(dir, "feedback.sqlite"));
  t.after(() => store.close());
  const ownerA = context("client-a");
  const ownerB = context("client-b");

  const created = await store.feedback.createThread({
    subject: "Synthetic feedback", message: "Initial synthetic report.",
  }, ownerA);
  const threadId = created.conversation.id;
  const initialId = created.conversation.messages[0].id;
  const user = await store.feedback.appendMessage({
    threadId, message: "Synthetic follow-up.",
  }, ownerA);
  const team = store.appendTeamReply("client-a", threadId, "Synthetic team reply.");

  assert.equal(store.feedbackOwnerForThread(threadId), "client-a");
  assert.equal(store.canReadFeedbackThread("client-a", threadId), true);
  assert.equal(store.canReadFeedbackThread("client-b", threadId), false);
  assert.equal(store.canReadFeedbackThread("client-a", "missing-thread"), false);
  await assert.rejects(store.feedback.getThread({ threadId }, ownerB), /not found/);
  await assert.rejects(store.feedback.appendMessage({ threadId, message: "Cross-owner write." }, ownerB), /not found/);
  assert.throws(() => store.appendTeamReply("client-b", threadId, "Cross-owner reply."), /not found/);
  assert.deepEqual((await store.feedback.listThreads({ limit: 20 }, ownerB)).page.threads, []);

  const firstRead = (await store.feedback.getThread({ threadId }, ownerA)).conversation;
  const secondRead = (await store.feedback.getThread({ threadId }, ownerA)).conversation;
  assert.deepEqual(firstRead.messages.map(({ sequence }) => sequence), [1, 2, 3]);
  assert.deepEqual(firstRead.messages.map(({ body }) => body), [
    "Initial synthetic report.", "Synthetic follow-up.", "Synthetic team reply.",
  ]);
  assert.equal(firstRead.messages[0].id, initialId);
  assert.equal(firstRead.messages[1].id, user.message.id);
  assert.equal(firstRead.messages[2].id, team.message.id);
  assert.equal(firstRead.messages[0].offeredToClientAt, undefined);
  assert.equal(firstRead.messages[1].offeredToClientAt, undefined);
  assert.match(firstRead.messages[2].offeredToClientAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(secondRead.messages[2].offeredToClientAt, firstRead.messages[2].offeredToClientAt);
});

test("only an owner-scoped team reply queues a body-free feedback event", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "emseepea-feedback-events-smoke-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = openStore(join(dir, "events.sqlite"));
  t.after(() => store.close());
  const created = await store.feedback.createThread({
    subject: "Private synthetic subject", message: "Private synthetic user body.",
  }, context("client-a"));
  const threadId = created.conversation.id;
  await store.subscription.put({
    id: "sub-a", ownerKey: "client-a", name: "feedback.reply.ready", arguments: { threadId },
    url: "https://callback.example.com/events", secret: "whsec_unused", expiresAt: Date.now() + 60_000,
  });
  await store.subscription.put({
    id: "sub-b", ownerKey: "client-b", name: "feedback.reply.ready", arguments: { threadId },
    url: "https://callback.example.com/events", secret: "whsec_unused", expiresAt: Date.now() + 60_000,
  });
  const events = createFeedbackReplyEventsOptions({
    ownerKey: feedbackOwnerKey,
    canReadThread: (ownerKey, candidateThreadId) => store.canReadFeedbackThread(ownerKey, candidateThreadId),
    health: () => store.healthy(),
    store: store.subscription,
  });
  const app = createEmseepea({
    name: "feedback-events-smoke-test", version: "0.0.0",
    authentication: {
      verifier: { async verifyAccessToken(token) { return {
        token, clientId: token, scopes: ["feedback", "events:read"],
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
  t.after(() => app.close());

  const userEvent = {
    id: "event-user", type: "feedback.message.added", occurredAt: new Date().toISOString(),
    scope: "client-a", threadId, messageId: "message-user", author: "user",
  };
  assert.equal(await publishFeedbackTeamReplyEvent(app, userEvent), false);
  assert.equal(await publishFeedbackTeamReplyEvent(app, {
    ...userEvent, id: "event-status", type: "feedback.status.changed", author: "system",
  }), false);
  assert.deepEqual(await store.subscription.claimDue(10, Date.now() + 1_000, 1_000), []);

  const team = store.appendTeamReply("client-a", threadId, "Private synthetic team body.");
  assert.equal(await publishFeedbackTeamReplyEvent(app, team.event), true);
  const queued = await store.subscription.claimDue(10, Date.now() + 1_000, 1_000);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].subscriptionId, "sub-a");
  const published = JSON.parse(queued[0].body);
  assert.equal(published.name, "feedback.reply.ready");
  assert.deepEqual(published.data, {
    scope: "client-a", threadId, messageId: team.message.id, sourceEventId: team.event.id,
  });
  assert.doesNotMatch(queued[0].body, /Private synthetic|subject|token|secret|recipient/i);
});

test("admin reply route fails closed and one client alone can subscribe and read the reply", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "emseepea-feedback-route-smoke-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = openStore(join(dir, "route.sqlite"));
  t.after(() => store.close());
  const publicMcpUrl = new URL("https://api.example/mcp");
  const auth = {
    metadata: {
      issuer: "https://auth.example",
      authorization_endpoint: "https://auth.example/authorize",
      token_endpoint: "https://auth.example/token",
      response_types_supported: ["code"],
    },
    async verifyAccessToken(token) {
      return {
        token, clientId: token, scopes: ["feedback", "events:read"],
        expiresAt: Math.floor(Date.now() / 1000) + 60, resource: publicMcpUrl,
      };
    },
  };
  const adminToken = "synthetic-admin-token-123456789";
  const app = createFeedbackSmokeApp({ publicMcpUrl, auth, adminToken, store });
  t.after(() => app.close());

  const created = await mcpRpc(app, "tools/call", {
    name: "create-feedback-thread",
    arguments: { subject: "Synthetic route feedback", message: "Synthetic initial message." },
  }, "client-a");
  assert.equal(created.statusCode, 200);
  const threadId = created.body.result.structuredContent.id;
  const replyUrl = `/demo/feedback/${threadId}/replies`;
  const payload = { message: "Synthetic protected team reply." };

  const missingToken = await app.inject({ method: "POST", url: replyUrl, payload });
  assert.equal(missingToken.statusCode, 401);
  const wrongToken = await app.inject({
    method: "POST", url: replyUrl, headers: { "x-demo-admin-token": "wrong-token" }, payload,
  });
  assert.equal(wrongToken.statusCode, 401);
  const malformedThread = await app.inject({
    method: "POST", url: "/demo/feedback/not-a-uuid/replies",
    headers: { "x-demo-admin-token": adminToken }, payload,
  });
  assert.equal(malformedThread.statusCode, 400);
  const malformedBody = await app.inject({
    method: "POST", url: replyUrl, headers: { "x-demo-admin-token": adminToken }, payload: { message: "" },
  });
  assert.equal(malformedBody.statusCode, 400);
  const unknownThread = await app.inject({
    method: "POST", url: `/demo/feedback/${randomUUID()}/replies`,
    headers: { "x-demo-admin-token": adminToken }, payload,
  });
  assert.equal(unknownThread.statusCode, 404);
  assert.equal((await store.feedback.getThread({ threadId }, context("client-a"))).conversation.messages.length, 1);
  assert.deepEqual(await store.subscription.claimDue(10, Date.now() + 1_000, 1_000), []);

  const secret = `whsec_${Buffer.alloc(32, 3).toString("base64")}`;
  await store.subscription.put({
    id: "sub-client-a", ownerKey: "client-a", name: "feedback.reply.ready", arguments: { threadId },
    url: "https://callback.example.com/events", secret, expiresAt: Date.now() + 60_000,
  });
  await store.subscription.put({
    id: "sub-client-b", ownerKey: "client-b", name: "feedback.reply.ready", arguments: { threadId },
    url: "https://callback.example.com/events", secret, expiresAt: Date.now() + 60_000,
  });
  const deniedSubscription = await mcpRpc(app, "events/subscribe", {
    name: "feedback.reply.ready", arguments: { threadId },
    delivery: { mode: "webhook", url: "https://callback.example.com/events", secret }, cursor: null,
  }, "client-b");
  assert.equal(deniedSubscription.body.error.code, -32602);

  const valid = await app.inject({
    method: "POST", url: replyUrl, headers: { "x-demo-admin-token": adminToken }, payload,
  });
  assert.equal(valid.statusCode, 201);
  const queued = await store.subscription.claimDue(10, Date.now() + 1_000, 1_000);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].subscriptionId, "sub-client-a");
  const eventBody = JSON.parse(queued[0].body);
  assert.deepEqual(eventBody.data, {
    scope: "client-a", threadId,
    messageId: valid.json().messageId, sourceEventId: eventBody.data.sourceEventId,
  });
  assert.doesNotMatch(queued[0].body, /Synthetic|subject|token|secret|recipient|callback/i);

  const deniedRead = await mcpRpc(app, "tools/call", {
    name: "get-feedback-thread", arguments: { threadId },
  }, "client-b");
  assert.equal(deniedRead.statusCode, 200);
  assert.equal(deniedRead.body.result.isError, true);
  assert.doesNotMatch(JSON.stringify(deniedRead.body), /Synthetic protected team reply/);

  const [firstRead, concurrentRead] = await Promise.all([
    mcpRpc(app, "tools/call", { name: "get-feedback-thread", arguments: { threadId } }, "client-a"),
    mcpRpc(app, "tools/call", { name: "get-feedback-thread", arguments: { threadId } }, "client-a"),
  ]);
  const firstOffer = firstRead.body.result.structuredContent.messages[1].offeredToClientAt;
  const concurrentOffer = concurrentRead.body.result.structuredContent.messages[1].offeredToClientAt;
  assert.match(firstOffer, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(concurrentOffer, firstOffer);
  const laterRead = await mcpRpc(app, "tools/call", {
    name: "get-feedback-thread", arguments: { threadId },
  }, "client-a");
  assert.equal(laterRead.body.result.structuredContent.messages[1].offeredToClientAt, firstOffer);
});

function context(scope) {
  return { scope, signal: new AbortController().signal, deadlineMs: Date.now() + 10_000 };
}

async function mcpRpc(app, method, params, token) {
  const response = await app.inject({
    method: "POST",
    url: "/mcp",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(method === "tools/call" ? { "Mcp-Name": params.name } : {}),
      Authorization: `Bearer ${token}`,
    },
    payload: {
      jsonrpc: "2.0", id: randomUUID(), method,
      params: { ...params, _meta: requestMeta },
    },
  });
  return { statusCode: response.statusCode, body: response.json() };
}
