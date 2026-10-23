import { defineFeedbackSubmission, type FeedbackSubmissionBackend, type FeedbackSubmissionOptions } from "../src/index.js";
declare const backend: FeedbackSubmissionBackend;
const options: FeedbackSubmissionOptions = { access: "public", backend, description: "Application-specific guidance." };
defineFeedbackSubmission(options);
defineFeedbackSubmission({ access: "protected", requiredScopes: ["feedback"], backend, description: "Application-specific guidance." });
// @ts-expect-error Descriptions must be strings.
defineFeedbackSubmission({ access: "public", backend, description: 123 });
// @ts-expect-error Description configuration is immutable.
options.description = "changed";
