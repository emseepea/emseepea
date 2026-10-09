import { defineFeedbackConversation, defineFeedbackSubmission, type FeedbackToolAnnotations,
  type FeedbackConversationAnnotations, type FeedbackConversationBackend, type FeedbackSubmissionBackend } from "../src/index.js";

declare const conversationBackend: FeedbackConversationBackend;
declare const submissionBackend: FeedbackSubmissionBackend;
const flags: FeedbackToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
const annotations: FeedbackConversationAnnotations = { "list-feedback-threads": flags,
  "create-feedback-thread": { destructiveHint: true }, "reply-to-feedback-thread": {}, "get-feedback-thread": undefined };
defineFeedbackConversation({ requiredScopes: ["feedback"], backend: conversationBackend, annotations });
defineFeedbackSubmission({ access: "public", backend: submissionBackend, annotations: flags });
defineFeedbackSubmission({ access: "protected", requiredScopes: ["feedback"], backend: submissionBackend, annotations: {} });
// @ts-expect-error Annotation flags must be booleans.
const invalidFlag: FeedbackToolAnnotations = { readOnlyHint: "false" };
// @ts-expect-error Map keys are public MCP tool names, not backend method names.
const invalidOperation: FeedbackConversationAnnotations = { listThreads: flags };
// @ts-expect-error Unsupported annotation fields are rejected.
const invalidField: FeedbackToolAnnotations = { title: "other title" };
// @ts-expect-error Public annotation configuration is immutable.
flags.readOnlyHint = true;
// @ts-expect-error Public per-tool configuration is immutable.
annotations["list-feedback-threads"] = {};
void [invalidFlag, invalidOperation, invalidField];
