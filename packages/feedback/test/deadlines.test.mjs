import assert from "node:assert/strict";
import test from "node:test";
import { createFirestoreFeedbackSubmissionBackend } from "../dist/firestore.js";
import { createGitHubFeedbackBackend } from "../dist/github.js";
import { createPostgresFeedbackSubmissionBackend } from "../dist/postgres.js";

const context = () => ({
  scope: "client-a",
  signal: new AbortController().signal,
  deadlineMs: Date.now() + 25,
});

test("provider, PostgreSQL, and Firestore waits stop at the feedback deadline", async () => {
  const fetch = (_request, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  const github = createGitHubFeedbackBackend({
    owner: "emseepea",
    repository: "support",
    token: "test-token",
    apiUrl: new URL("https://github.test/"),
    fetch,
  });
  await assert.rejects(github.listThreads({ limit: 20 }, context()), /deadline|timed out|Timeout/i);

  const postgres = createPostgresFeedbackSubmissionBackend({
    pool: { connect: () => new Promise(() => {}), query: () => new Promise(() => {}) },
  });
  await assert.rejects(postgres.submit({
    observation: "friction",
    detail: "The filter was difficult to find.",
    context: undefined,
  }, context()), /deadline|timed out|Timeout/i);

  const firestore = createFirestoreFeedbackSubmissionBackend({
    database: {
      collection: () => { throw new Error("not reached"); },
      runTransaction: () => new Promise(() => {}),
    },
  });
  await assert.rejects(firestore.submit({
    observation: "friction",
    detail: "The filter was difficult to find.",
    context: undefined,
  }, context()), /deadline|timed out|Timeout/i);
});

test("provider work stops when the MCP request disconnects", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("client disconnected", "AbortError"));
  const backend = createGitHubFeedbackBackend({
    owner: "emseepea",
    repository: "support",
    token: "test-token",
    apiUrl: new URL("https://github.test/"),
    fetch: () => { throw new Error("fetch must not start"); },
  });
  await assert.rejects(backend.listThreads({ limit: 20 }, {
    scope: "client-a",
    signal: controller.signal,
    deadlineMs: Date.now() + 1_000,
  }), /client disconnected/);
});
