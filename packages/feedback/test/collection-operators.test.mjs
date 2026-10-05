import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepea } from "@emseepea/server";
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";
import { z } from "zod";
import {
  createInMemoryFeedbackCollectionBackend,
  defineFeedbackCollectionOperators,
  defineFeedbackCollections,
} from "../dist/index.js";

const now = "2026-10-05T04:00:00.000Z";

function context(scope = "deployment-a") {
  return {
    scope,
    signal: new AbortController().signal,
    deadlineMs: Date.now() + 10_000,
  };
}

function publicError(result) {
  return result.content?.map((item) => item.text ?? "").join("\n") ?? "";
}

test("operator tools expose only configured collections and safe validated fields", async (t) => {
  const ids = ["shared-id", "shared-id", "internal-2", "customer-only-id"];
  const stored = createInMemoryFeedbackCollectionBackend({
    sourceSystem: "support-system",
    createSubmissionId: () => ids.shift(),
    now: () => now,
  });
  await stored.recordSubmission({
    collection: "internal",
    observation: "friction",
    detail: "The internal workflow required repeated steps.",
    context: { feature: "triage" },
  }, context());
  await stored.recordSubmission({
    collection: "customer",
    observation: "confusion",
    detail: "The customer could not identify the next action.",
    context: { feature: "checkout" },
  }, context());
  await stored.recordSubmission({
    collection: "internal",
    observation: "suggestion",
    detail: "Show the next action beside the result.",
    context: { feature: "triage" },
  }, context());
  await stored.recordSubmission({
    collection: "customer",
    observation: "suggestion",
    detail: "Offer a shorter checkout explanation.",
    context: { feature: "checkout" },
  }, context());

  const calls = [];
  const backend = {
    getSubmission(query, adapterContext) {
      calls.push(["get", query]);
      return stored.getSubmission(query, adapterContext);
    },
    listSubmissions(query, adapterContext) {
      calls.push(["list", query]);
      return stored.listSubmissions(query, adapterContext);
    },
  };
  const definition = defineFeedbackCollections({
    collections: ["customer", "internal"],
    operators: [
      { collection: "customer", access: "protected",
        requiredScopes: ["feedback:operator", "feedback:customer"] },
      { collection: "internal", access: "protected",
        requiredScopes: ["feedback:operator", "feedback:internal"] },
    ],
  });
  const tools = defineFeedbackCollectionOperators({
    definition,
    scope: "deployment-a",
    contextSchema: z.strictObject({ feature: z.string() }),
    backend,
  });
  const running = await startEmseepea(t, createEmseepea({
    name: "feedback-operator-test",
    version: "0.0.0",
    tools,
    authentication: insecureTestAuthentication(["feedback:operator", "feedback:internal"]),
  }));
  const client = await running.connect("test-token");
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(({ name, title }) => ({ name, title })), [
    { name: "list-feedback-submissions", title: "List Feedback Submissions" },
    { name: "get-feedback-submission", title: "Read Feedback Submission" },
  ]);
  for (const tool of listed.tools) {
    assert.deepEqual(tool.inputSchema.properties.collection.enum, ["customer", "internal"]);
  }

  const page = await client.callTool({
    name: "list-feedback-submissions",
    arguments: { collection: "internal", limit: 1 },
  });
  assert.equal(page.isError, false);
  assert.equal(page.structuredContent.submissions.length, 1);
  assert.equal(page.structuredContent.submissions[0].collection, "internal");
  assert.deepEqual(page.structuredContent.submissions[0].context, { feature: "triage" });
  assert.equal("scope" in page.structuredContent.submissions[0], false);
  assert.equal("source" in page.structuredContent.submissions[0], false);
  assert.ok(page.structuredContent.nextCursor);

  const exact = await client.callTool({
    name: "get-feedback-submission",
    arguments: { collection: "internal", submissionId: "shared-id" },
  });
  assert.equal(exact.isError, false);
  assert.equal(exact.structuredContent.detail, "The internal workflow required repeated steps.");
  assert.equal(exact.structuredContent.collection, "internal");
  assert.equal("scope" in exact.structuredContent, false);
  assert.equal("source" in exact.structuredContent, false);

  const callsBeforeDenied = calls.length;
  const denied = await client.callTool({
    name: "get-feedback-submission",
    arguments: { collection: "customer", submissionId: "shared-id" },
  });
  assert.equal(denied.isError, true);
  assert.equal(calls.length, callsBeforeDenied);
  const deniedList = await client.callTool({
    name: "list-feedback-submissions",
    arguments: { collection: "customer", limit: 20 },
  });
  assert.equal(deniedList.isError, true);
  assert.equal(calls.length, callsBeforeDenied);

  const invalidCollection = await client.callTool({
    name: "get-feedback-submission",
    arguments: { collection: "unknown", submissionId: "shared-id" },
  });
  assert.equal(invalidCollection.isError, true);
  assert.equal(calls.length, callsBeforeDenied);

  const unknown = await client.callTool({
    name: "get-feedback-submission",
    arguments: { collection: "internal", submissionId: "missing-id" },
  });
  const crossCollection = await client.callTool({
    name: "get-feedback-submission",
    arguments: { collection: "internal", submissionId: "customer-only-id" },
  });
  assert.equal(unknown.isError, true);
  assert.equal(crossCollection.isError, true);
  assert.equal(publicError(denied), publicError(unknown));
  assert.equal(publicError(crossCollection), publicError(unknown));
});

test("operator tools fail closed on mismatched backend records and oversized safe results", async (t) => {
  const definition = defineFeedbackCollections({
    collections: ["internal"],
    operators: [{ collection: "internal", access: "protected", requiredScopes: ["feedback:operator"] }],
  });
  const record = {
    collection: "customer",
    submissionId: "wrong-collection",
    scope: "deployment-a",
    observation: "friction",
    detail: "This record must not cross the configured collection boundary.",
    context: { value: "safe" },
    recordedAt: now,
    source: { system: "support", id: "wrong-collection" },
  };
  const tools = defineFeedbackCollectionOperators({
    definition,
    scope: "deployment-a",
    contextSchema: z.strictObject({ value: z.string() }),
    backend: {
      getSubmission: () => record,
      listSubmissions: () => ({ submissions: [{ ...record, collection: "internal",
        context: { value: "x".repeat(300_000) } }] }),
    },
  });
  const running = await startEmseepea(t, createEmseepea({
    name: "feedback-operator-fail-closed-test",
    version: "0.0.0",
    tools,
    authentication: insecureTestAuthentication(["feedback:operator"]),
  }));
  const client = await running.connect("test-token");
  const wrong = await client.callTool({
    name: "get-feedback-submission",
    arguments: { collection: "internal", submissionId: "wrong-collection" },
  });
  const oversized = await client.callTool({
    name: "list-feedback-submissions",
    arguments: { collection: "internal", limit: 50 },
  });
  assert.equal(wrong.isError, true);
  assert.equal(oversized.isError, true);
  assert.equal(publicError(wrong), publicError(oversized));
  record.collection = "internal";
  const wrongId = await client.callTool({
    name: "get-feedback-submission",
    arguments: { collection: "internal", submissionId: "requested-id" },
  });
  assert.equal(wrongId.isError, true);
  assert.equal(publicError(wrongId), publicError(wrong));
});

test("a submission-only customer topology compiles no operator tools", () => {
  const definition = defineFeedbackCollections({
    collections: ["customer"],
    submissions: [{ collection: "customer", access: "public" }],
  });
  assert.deepEqual(defineFeedbackCollectionOperators({
    definition,
    backend: createInMemoryFeedbackCollectionBackend(),
  }), []);
});

test("operator tools reject disjoint collection scopes instead of requiring every role", () => {
  const definition = defineFeedbackCollections({
    collections: ["customer", "internal"],
    operators: [
      { collection: "customer", access: "protected", requiredScopes: ["feedback:customer"] },
      { collection: "internal", access: "protected", requiredScopes: ["feedback:internal"] },
    ],
  });
  assert.throws(() => defineFeedbackCollectionOperators({
    definition,
    backend: createInMemoryFeedbackCollectionBackend(),
  }), /shared.*scope/i);
});
