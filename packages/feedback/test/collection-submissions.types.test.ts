import {
  createInMemoryFeedbackCollectionBackend,
  defineFeedbackCollections,
  defineFeedbackCollectionSubmissions,
  type FeedbackCollectionSubmissionBackend,
  type FeedbackSubmissionRecordedHook,
} from "../src/index.js";
import { z } from "zod";

const backend = createInMemoryFeedbackCollectionBackend<{ feature: string }>({
  sourceSystem: "support",
});
backend satisfies FeedbackCollectionSubmissionBackend<{ feature: string }>;

const hook: FeedbackSubmissionRecordedHook = (event) => {
  event.type satisfies "feedback.submission.recorded";
  event.record.collection satisfies string;
};

const tools = defineFeedbackCollectionSubmissions({
  definition: defineFeedbackCollections({
    collections: ["internal"],
    submissions: [{
      collection: "internal",
      access: "protected",
      requiredScopes: ["feedback:internal"],
    }],
  }),
  contextSchema: z.strictObject({ feature: z.string() }),
  backend,
  hooks: [hook],
});

tools.length satisfies number;
