import { defineFeedbackConversation, defineFeedbackSubmission, type FeedbackToolAnnotationOverrides,
  type FeedbackConversationAnnotationOverrides, type FeedbackConversationBackend, type FeedbackSubmissionBackend } from "../src/index.js";

declare const conversationBackend: FeedbackConversationBackend;
declare const submissionBackend: FeedbackSubmissionBackend;
const flags: FeedbackToolAnnotationOverrides = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
const annotations: FeedbackConversationAnnotationOverrides = { list: flags,
  create: { destructiveHint: true }, reply: {}, get: undefined };
defineFeedbackConversation({ requiredScopes: ["feedback"], backend: conversationBackend, annotations });
defineFeedbackSubmission({ access: "public", backend: submissionBackend, annotations: flags });
defineFeedbackSubmission({ access: "protected", requiredScopes: ["feedback"], backend: submissionBackend, annotations: {} });
// @ts-expect-error Annotation flags must be booleans.
const invalidFlag: FeedbackToolAnnotationOverrides = { readOnlyHint: "false" };
// @ts-expect-error Map keys are create, reply, list, and get, not backend method names.
const invalidOperation: FeedbackConversationAnnotationOverrides = { listThreads: flags };
// @ts-expect-error Unsupported annotation fields are rejected.
const invalidField: FeedbackToolAnnotationOverrides = { title: "other title" };
// @ts-expect-error Public annotation configuration is immutable.
flags.readOnlyHint = true;
// @ts-expect-error Public per-tool configuration is immutable.
annotations.list = {};
void [invalidFlag, invalidOperation, invalidField];
