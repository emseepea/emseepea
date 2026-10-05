import assert from "node:assert/strict";
import test from "node:test";
import {
  feedbackCollectionSchema,
  feedbackSubmissionRecordSchema,
  feedbackSubmissionRecordedEventSchema,
  getFeedbackSubmissionQuerySchema,
  listFeedbackSubmissionsQuerySchema,
} from "../dist/index.js";

const now = "2026-10-05T00:00:00.000Z";

test("feedback collection identifiers use the bounded deployment grammar", () => {
  for (const collection of ["internal", "customer", "a", "team.one_2-beta"]) {
    assert.equal(feedbackCollectionSchema.parse(collection), collection);
  }
  for (const collection of ["", "Internal", "1internal", "internal/customer", "a".repeat(65)]) {
    assert.equal(feedbackCollectionSchema.safeParse(collection).success, false);
  }
});

test("submission records keep collection separate from scope", () => {
  const record = feedbackSubmissionRecordSchema.parse({
    collection: "internal",
    submissionId: "feedback-1",
    scope: "pea-guide",
    observation: "friction",
    detail: "Finding the seed filter took three attempts.",
    context: { feature: "seed filter" },
    recordedAt: now,
    source: { system: "support", id: "ticket-1" },
  });

  assert.equal(record.collection, "internal");
  assert.equal(record.scope, "pea-guide");
  assert.notEqual(record.collection, record.scope);
});

test("submission recorded events contain references but no feedback or identity data", () => {
  const event = feedbackSubmissionRecordedEventSchema.parse({
    id: "feedback.submission.recorded:feedback-1",
    type: "feedback.submission.recorded",
    occurredAt: now,
    record: { collection: "internal", submissionId: "feedback-1" },
    source: { system: "support", id: "ticket-1" },
  });

  assert.deepEqual(Object.keys(event).sort(), ["id", "occurredAt", "record", "source", "type"]);
  assert.deepEqual(event.record, { collection: "internal", submissionId: "feedback-1" });
  for (const forbidden of ["body", "detail", "context", "scope", "principal", "clientId", "secret"]) {
    assert.equal(feedbackSubmissionRecordedEventSchema.safeParse({ ...event, [forbidden]: "private" }).success, false);
  }
});

test("collection lookup is exact and pagination is bounded", () => {
  assert.deepEqual(getFeedbackSubmissionQuerySchema.parse({
    collection: "customer",
    submissionId: "feedback-2",
  }), {
    collection: "customer",
    submissionId: "feedback-2",
  });
  assert.deepEqual(listFeedbackSubmissionsQuerySchema.parse({ collection: "customer" }), {
    collection: "customer",
    limit: 20,
  });
  assert.equal(listFeedbackSubmissionsQuerySchema.safeParse({ collection: "customer", limit: 51 }).success, false);
});
