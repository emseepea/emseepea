import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepea } from "@emseepea/server";
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";
import {
  createInMemoryFeedbackCollectionBackend,
  defineFeedbackCollections,
  defineFeedbackCollectionSubmissions,
} from "../dist/index.js";

const now = "2026-10-05T03:00:00.000Z";

function adapterContext(scope = "operator-a") {
  return {
    scope,
    signal: new AbortController().signal,
    deadlineMs: Date.now() + 10_000,
  };
}

test("the reference backend keeps exact collection identity and bounded isolated pages", async () => {
  const ids = ["same-id", "same-id", "customer-2", "legacy-id"];
  const backend = createInMemoryFeedbackCollectionBackend({
    sourceSystem: "reference-support",
    createSubmissionId: () => ids.shift(),
    now: () => now,
  });

  const internal = await backend.recordSubmission({
    collection: "internal",
    observation: "friction",
    detail: "The internal workflow required repeated steps.",
    context: undefined,
  }, adapterContext());
  const customer = await backend.recordSubmission({
    collection: "customer",
    observation: "confusion",
    detail: "The customer could not identify the next action.",
    context: { feature: "checkout" },
  }, adapterContext());
  await backend.recordSubmission({
    collection: "customer",
    observation: "suggestion",
    detail: "Show the next action beside the result.",
    context: undefined,
  }, adapterContext());

  assert.equal(internal.submissionId, "same-id");
  assert.equal(customer.submissionId, "same-id");
  assert.equal((await backend.getSubmission({
    collection: "internal",
    submissionId: "same-id",
  }, adapterContext()))?.detail, "The internal workflow required repeated steps.");
  assert.equal((await backend.getSubmission({
    collection: "customer",
    submissionId: "same-id",
  }, adapterContext()))?.detail, "The customer could not identify the next action.");

  const first = await backend.listSubmissions({ collection: "customer", limit: 1 }, adapterContext());
  assert.equal(first.submissions.length, 1);
  assert.ok(first.nextCursor);
  const second = await backend.listSubmissions({
    collection: "customer",
    limit: 1,
    cursor: first.nextCursor,
  }, adapterContext());
  assert.equal(second.submissions.length, 1);
  assert.notEqual(second.submissions[0].submissionId, first.submissions[0].submissionId);
  assert.throws(() => backend.listSubmissions({
    collection: "internal",
    limit: 1,
    cursor: first.nextCursor,
  }, adapterContext()), /cursor/i);
  assert.throws(() => backend.listSubmissions({
    collection: "customer",
    limit: 1,
    cursor: first.nextCursor,
  }, adapterContext("operator-b")), /cursor/i);
});

test("the reference backend rejects duplicate composite identity and excludes unclassified records", async () => {
  const backend = createInMemoryFeedbackCollectionBackend({
    sourceSystem: "reference-support",
    initialRecords: [{
      submissionId: "legacy-1",
      scope: "operator-a",
      observation: "friction",
      detail: "Legacy feedback without a collection.",
      recordedAt: now,
      source: { system: "legacy", id: "legacy-1" },
    }],
    createSubmissionId: () => "duplicate",
    now: () => now,
  });
  const command = {
    collection: "internal",
    observation: "friction",
    detail: "The internal workflow required repeated steps.",
    context: undefined,
  };
  await backend.recordSubmission(command, adapterContext());
  assert.throws(() => backend.recordSubmission(command, adapterContext()), /already exists/i);
  assert.equal((await backend.listSubmissions({
    collection: "internal",
    limit: 50,
  }, adapterContext())).submissions.length, 1);
  assert.equal(await backend.getSubmission({
    collection: "internal",
    submissionId: "legacy-1",
  }, adapterContext()), undefined);
});

test("fixed submission tools route only through compiled collections and emit after persistence", async (t) => {
  const order = [];
  const events = [];
  const backend = createInMemoryFeedbackCollectionBackend({
    sourceSystem: "support",
    createSubmissionId: () => "feedback-1",
    now: () => now,
  });
  const wrapped = {
    ...backend,
    async recordSubmission(command, context) {
      order.push(`persist:${command.collection}`);
      return backend.recordSubmission(command, context);
    },
  };
  const definition = defineFeedbackCollections({
    collections: ["customer", "internal"],
    submissions: [
      { collection: "customer", access: "public" },
      { collection: "internal", access: "protected", requiredScopes: ["feedback:internal"] },
    ],
    operators: [{
      collection: "internal",
      access: "protected",
      requiredScopes: ["feedback:operator"],
    }],
    monitors: [{
      collection: "internal",
      access: "protected",
      requiredScopes: ["feedback:monitor"],
    }],
  });
  const tools = defineFeedbackCollectionSubmissions({
    definition,
    scope: "deployment-a",
    backend: wrapped,
    hooks: [
      () => { throw new Error("notification unavailable"); },
      (event) => {
        order.push(`event:${event.record.collection}`);
        events.push(event);
      },
    ],
  });
  const running = await startEmseepea(t, createEmseepea({
    name: "collection-feedback-test",
    version: "0.0.0",
    tools,
    authentication: insecureTestAuthentication(["feedback:internal"]),
  }));
  const protectedClient = await running.connect("test-token");
  const listed = await protectedClient.listTools();
  assert.deepEqual(listed.tools.map(({ name }) => name), [
    "submit-customer-feedback",
    "submit-internal-feedback",
  ]);
  const internalTool = listed.tools.find(({ name }) => name === "submit-internal-feedback");
  assert.equal(internalTool.title, "Record Internal Feedback");
  assert.equal("collection" in internalTool.inputSchema.properties, false);
  assert.equal("destination" in internalTool.inputSchema.properties, false);

  const customerResult = await protectedClient.callTool({
    name: "submit-customer-feedback",
    arguments: { observation: "confusion", detail: "The customer could not identify the next action." },
  });
  assert.equal(customerResult.isError, false);
  assert.equal(customerResult.structuredContent.collection, "customer");
  assert.equal(customerResult.structuredContent.submissionId, "feedback-1");

  const internalResult = await protectedClient.callTool({
    name: "submit-internal-feedback",
    arguments: { observation: "friction", detail: "The internal workflow required repeated steps." },
  });
  assert.equal(internalResult.isError, false);
  assert.equal(internalResult.structuredContent.collection, "internal");
  assert.deepEqual(order, [
    "persist:customer", "event:customer",
    "persist:internal", "event:internal",
  ]);
  assert.deepEqual(events.map(({ type }) => type), [
    "feedback.submission.recorded",
    "feedback.submission.recorded",
  ]);
  assert.equal(events.every(Object.isFrozen), true);
  assert.equal(events.every((event) => !Object.hasOwn(event, "detail")), true);
  assert.equal(listed.tools.some(({ name }) => /operator|monitor|event|subscribe/.test(name)), false);

  const wrongScopeRunning = await startEmseepea(t, createEmseepea({
    name: "collection-feedback-wrong-scope-test",
    version: "0.0.0",
    tools,
    authentication: insecureTestAuthentication(["feedback:customer"]),
  }));
  const wrongScopeClient = await wrongScopeRunning.connect("test-token");
  await assert.rejects(() => wrongScopeClient.callTool({
    name: "submit-internal-feedback",
    arguments: { observation: "friction", detail: "This must not be recorded." },
  }), /Capability not found/);
  assert.equal(order.filter((entry) => entry === "persist:internal").length, 1);
});

test("customer-only topology exposes one public submission tool", async (t) => {
  const definition = defineFeedbackCollections({
    collections: ["customer"],
    submissions: [{ collection: "customer", access: "public" }],
  });
  const tools = defineFeedbackCollectionSubmissions({
    definition,
    backend: createInMemoryFeedbackCollectionBackend(),
  });
  const running = await startEmseepea(t, createEmseepea({
    name: "customer-feedback-test",
    version: "0.0.0",
    tools,
  }));
  const client = await running.connect();
  const listed = await client.listTools();
  assert.equal("collection" in listed.tools[0].inputSchema.properties, false);
  assert.equal("destination" in listed.tools[0].inputSchema.properties, false);
  assert.deepEqual(listed.tools.map(({ name, title }) => ({ name, title })), [{
    name: "submit-customer-feedback",
    title: "Record Customer Feedback",
  }]);
});

test("storage failure emits no recorded event", async (t) => {
  const events = [];
  const definition = defineFeedbackCollections({
    collections: ["internal"],
    submissions: [{ collection: "internal", access: "public" }],
  });
  const tools = defineFeedbackCollectionSubmissions({
    definition,
    backend: {
      recordSubmission() { throw new Error("storage unavailable"); },
      getSubmission() { return undefined; },
      listSubmissions() { return { submissions: [] }; },
    },
    hooks: [(event) => events.push(event)],
  });
  const running = await startEmseepea(t, createEmseepea({
    name: "collection-feedback-failure-test",
    version: "0.0.0",
    tools,
  }));
  const client = await running.connect();
  const result = await client.callTool({
    name: "submit-internal-feedback",
    arguments: { observation: "error", detail: "The operation failed." },
  });
  assert.equal(result.isError, true);
  assert.deepEqual(events, []);
});
