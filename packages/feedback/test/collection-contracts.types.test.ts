import {
  type FeedbackCollection,
  type FeedbackCollectionBackend,
  type FeedbackSubmissionRecord,
  type FeedbackSubmissionRecordedEvent,
} from "../src/index.js";

const record = {
  collection: "internal",
  submissionId: "feedback-1",
  scope: "pea-guide",
  observation: "friction",
  detail: "Finding the seed filter took three attempts.",
  context: { feature: "seed filter" },
  recordedAt: "2026-10-05T00:00:00.000Z",
  source: { system: "support", id: "ticket-1" },
} satisfies FeedbackSubmissionRecord;

record.collection satisfies FeedbackCollection;
record.scope satisfies string;

const collectionBackend = {
  getSubmission(query) {
    query.collection satisfies FeedbackCollection;
    query.submissionId satisfies string;
    return record;
  },
  listSubmissions(query) {
    query.collection satisfies FeedbackCollection;
    query.limit satisfies number;
    return { submissions: [record] };
  },
} satisfies FeedbackCollectionBackend;

collectionBackend.getSubmission({ collection: "internal", submissionId: "feedback-1" });

const recordedEvent = {
  id: "feedback.submission.recorded:feedback-1",
  type: "feedback.submission.recorded",
  occurredAt: "2026-10-05T00:00:00.000Z",
  record: { collection: "internal", submissionId: "feedback-1" },
  source: { system: "support", id: "ticket-1" },
} satisfies FeedbackSubmissionRecordedEvent;

recordedEvent.record.collection satisfies FeedbackCollection;
