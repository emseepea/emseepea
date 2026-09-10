import assert from "node:assert/strict";
import test from "node:test";
import { createGitHubFeedbackBackend } from "../dist/github.js";
import { createZendeskFeedbackBackend } from "../dist/zendesk.js";

const context = {
  scope: "client-a",
  signal: new AbortController().signal,
  deadlineMs: Date.now() + 10_000,
};
const createdAt = "2026-09-10T00:00:00.000Z";

test("GitHub keeps the issue authoritative through replies, actions, and offer receipts", async () => {
  const requests = [];
  const comments = [];
  const reactions = new Set();
  let failReaction = false;
  const issue = {
    number: 42,
    title: "Search was confusing",
    body: "<!-- emseepea-feedback:user -->\n<!-- emseepea-feedback-scope:placeholder -->\nThe result labels were unclear.",
    state: "open",
    created_at: createdAt,
    updated_at: createdAt,
    user: { login: "feedback-bot" },
    labels: [],
    assignees: [{ login: "support-person" }],
    milestone: { title: "Next patch" },
  };
  const fetch = async (request, init = {}) => {
    const url = new URL(request);
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ method: init.method ?? "GET", path: `${url.pathname}${url.search}`, body });
    if (url.pathname.includes("/labels/") && (init.method ?? "GET") === "GET") {
      return json(404, { message: "not found" });
    }
    if (url.pathname.endsWith("/labels") && init.method === "POST") {
      issue.labels.push({ name: body.name });
      return json(201, { name: body.name });
    }
    if (url.pathname.endsWith("/issues") && init.method === "POST") {
      issue.title = body.title;
      issue.body = body.body;
      issue.labels = body.labels.map((name) => ({ name }));
      return json(201, issue);
    }
    if (url.pathname.endsWith("/issues/42") && !init.method) return json(200, issue);
    if (url.pathname.endsWith("/issues/42/comments") && init.method === "POST") {
      const comment = {
        id: 100 + comments.length,
        body: body.body,
        created_at: createdAt,
        user: { login: "feedback-bot" },
      };
      comments.push(comment);
      return json(201, comment);
    }
    if (url.pathname.endsWith("/issues/42/comments")) return json(200, comments);
    if (url.pathname.includes("/issues/comments/") && url.pathname.endsWith("/reactions")) {
      if (failReaction) return json(503, { message: "unavailable" });
      const status = reactions.has(url.pathname) ? 200 : 201;
      reactions.add(url.pathname);
      return json(status, { created_at: createdAt });
    }
    if (url.pathname.endsWith("/issues")) return json(200, [issue]);
    throw new Error(`Unexpected GitHub request: ${url} ${init.method ?? "GET"}`);
  };
  const backend = createGitHubFeedbackBackend({
    owner: "emseepea",
    repository: "support",
    token: "test-token",
    apiUrl: new URL("https://github.test/"),
    fetch,
  });

  const created = await backend.createThread({
    subject: "Search was confusing",
    message: "The result labels were unclear.",
  }, context);
  const threadId = created.conversation.id;
  assert.equal(threadId, "github-issue-42");

  await backend.appendMessage({ threadId, message: "It happened on the second page." }, context);
  comments.push({
    id: 101,
    body: "We clarified those labels and assigned the issue for release.",
    created_at: createdAt,
    user: { login: "support-person" },
  });
  issue.state = "closed";
  const read = await backend.getThread({ threadId }, context);
  assert.equal(read.conversation.status, "closed");
  assert.equal(read.conversation.messages[2].author, "team");
  assert.equal(read.conversation.messages[2].offeredToClientAt, createdAt);
  assert.deepEqual(read.events.map(({ type }) => type), ["feedback.message.offered-to-client"]);

  const reread = await backend.getThread({ threadId }, context);
  assert.deepEqual(reread.events, []);
  assert.equal(requests.filter(({ path }) => path.endsWith("/reactions")).length, 2);
  assert.equal(requests.some(({ body }) => body?.content === "eyes"), true);

  comments.push({
    id: 102,
    body: "A second support reply still reaches the client when receipt recording is unavailable.",
    created_at: createdAt,
    user: { login: "support-person" },
  });
  failReaction = true;
  const receiptFailure = await backend.getThread({ threadId }, context);
  assert.match(receiptFailure.conversation.messages[3].body, /still reaches the client/);
  assert.equal(receiptFailure.conversation.messages[3].offeredToClientAt, undefined);
  assert.deepEqual(issue.assignees, [{ login: "support-person" }]);
  assert.deepEqual(issue.milestone, { title: "Next patch" });
});

test("GitHub issue pagination neither skips nor repeats issues around pull requests", async () => {
  const requests = [];
  const firstPage = [githubIssue(90, true), githubIssue(1), githubIssue(91, true), githubIssue(2), githubIssue(3)];
  const backend = createGitHubFeedbackBackend({
    owner: "emseepea",
    repository: "support",
    token: "test-token",
    apiUrl: new URL("https://github.test/"),
    fetch: async (request) => {
      const url = new URL(request);
      requests.push(url.search);
      return json(200, Number(url.searchParams.get("page")) === 1 ? firstPage : []);
    },
  });

  const first = await backend.listThreads({ limit: 2 }, context);
  const second = await backend.listThreads({ limit: 2, cursor: first.page.nextCursor }, context);

  assert.deepEqual(first.page.threads.map(({ id }) => id), ["github-issue-1", "github-issue-2"]);
  assert.deepEqual(second.page.threads.map(({ id }) => id), ["github-issue-3"]);
  assert.equal(second.page.nextCursor, undefined);
  assert.equal(requests.length, 2);
});

test("GitHub issue pagination returns a continuation after its fixed raw-page ceiling", async () => {
  const requests = [];
  const pullRequests = Array.from({ length: 100 }, (_, index) => githubIssue(index + 1, true));
  const backend = createGitHubFeedbackBackend({
    owner: "emseepea",
    repository: "support",
    token: "test-token",
    apiUrl: new URL("https://github.test/"),
    fetch: async (request) => {
      const url = new URL(request);
      const page = Number(url.searchParams.get("page"));
      requests.push(page);
      return json(200, page <= 10 ? pullRequests : [githubIssue(101)]);
    },
  });

  const first = await backend.listThreads({ limit: 1 }, context);
  assert.deepEqual(first.page.threads, []);
  assert.ok(first.page.nextCursor);
  const second = await backend.listThreads({ limit: 1, cursor: first.page.nextCursor }, context);
  assert.deepEqual(second.page.threads.map(({ id }) => id), ["github-issue-101"]);
  assert.deepEqual(requests, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("Zendesk excludes private notes while preserving public replies and native receipts", async () => {
  const requests = [];
  const ticket = {
    id: 73,
    subject: "Filters were difficult",
    description: "The filters were difficult to find.",
    status: "open",
    created_at: createdAt,
    updated_at: createdAt,
    tags: [],
    requester_id: 321,
    assignee_id: 654,
    category: "product_feedback",
  };
  const comments = [];
  let failReceipt = false;
  const fetch = async (request, init = {}) => {
    const url = new URL(request);
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ method: init.method ?? "GET", path: `${url.pathname}${url.search}`, body });
    if (url.pathname.endsWith("/tickets.json") && init.method === "POST") {
      ticket.subject = body.ticket.subject;
      ticket.tags = body.ticket.tags;
      comments.push({ id: 1, body: body.ticket.comment.body, public: true, created_at: createdAt });
      return json(201, { ticket });
    }
    if (url.pathname.endsWith("/tickets/73/comments.json")) return json(200, { comments });
    if (url.pathname.endsWith("/tickets/73.json") && !init.method) return json(200, { ticket });
    if (url.pathname.endsWith("/tickets/73.json") && init.method === "PUT") {
      const comment = body.ticket.comment;
      if (failReceipt && comment.public === false) return json(503, { error: "unavailable" });
      comments.push({
        id: comments.length + 1,
        body: comment.body,
        public: comment.public,
        created_at: createdAt,
      });
      return json(200, { ticket });
    }
    if (url.pathname.endsWith("/search.json")) return json(200, { results: [ticket] });
    throw new Error(`Unexpected Zendesk request: ${url} ${init.method ?? "GET"}`);
  };
  const backend = createZendeskFeedbackBackend({
    baseUrl: new URL("https://zendesk.test/"),
    token: "test-token",
    requesterId: () => 321,
    fetch,
  });

  const created = await backend.createThread({
    subject: "Filters were difficult",
    message: "The filters were difficult to find.",
  }, context);
  const threadId = created.conversation.id;
  await backend.appendMessage({ threadId, message: "It took three attempts." }, context);
  comments.push({
    id: 3,
    body: "We moved the filters above the results.",
    public: true,
    created_at: createdAt,
  });
  comments.push({
    id: 4,
    body: "Internal release note. Never show this to the user.",
    public: false,
    created_at: createdAt,
  });
  ticket.status = "pending";

  const read = await backend.getThread({ threadId }, context);
  assert.equal(read.conversation.status, "pending");
  assert.deepEqual(read.conversation.messages.map(({ author }) => author), ["user", "user", "team"]);
  assert.doesNotMatch(JSON.stringify(read.conversation), /Internal release note/);
  assert.equal(read.conversation.messages[2].offeredToClientAt, createdAt);
  assert.deepEqual(read.events.map(({ type }) => type), ["feedback.message.offered-to-client"]);
  assert.equal(comments.some(({ body }) => body.startsWith("[emseepea-feedback:offered:3]")), true);

  const reread = await backend.getThread({ threadId }, context);
  assert.deepEqual(reread.events, []);
  assert.doesNotMatch(JSON.stringify(reread.conversation), /offered:3|Internal release note/);
  assert.equal(requests.filter(({ body }) => body?.ticket?.comment?.public === false).length, 1);

  comments.push({
    id: 6,
    body: "This reply remains visible even if the private receipt note fails.",
    public: true,
    created_at: createdAt,
  });
  failReceipt = true;
  const receiptFailure = await backend.getThread({ threadId }, context);
  assert.match(receiptFailure.conversation.messages[3].body, /remains visible/);
  assert.equal(receiptFailure.conversation.messages[3].offeredToClientAt, undefined);
  assert.equal(ticket.requester_id, 321);
  assert.equal(ticket.assignee_id, 654);
  assert.equal(ticket.category, "product_feedback");
  const createBody = requests.find(({ path, method }) => path.endsWith("/tickets.json") && method === "POST").body;
  assert.equal(createBody.ticket.requester_id, 321);
  assert.equal(createBody.ticket.comment.author_id, 321);
  const userReply = requests.find(({ body }) => body?.ticket?.comment?.body?.includes("It took three attempts."));
  assert.equal(userReply.body.ticket.comment.author_id, 321);
});

function githubIssue(number, pullRequest = false) {
  return {
    number,
    title: `Issue ${number}`,
    body: "Feedback",
    state: "open",
    created_at: createdAt,
    updated_at: createdAt,
    user: { login: "feedback-bot" },
    labels: [{ name: "emseepea-placeholder" }],
    assignees: [],
    milestone: null,
    ...(pullRequest ? { pull_request: {} } : {}),
  };
}

function json(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}
