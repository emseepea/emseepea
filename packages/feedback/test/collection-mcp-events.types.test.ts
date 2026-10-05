import {
  createFeedbackSubmittedEventsOptions,
  type FeedbackMonitorAuthorizationPhase,
  type FeedbackSubmittedEventsOptions,
} from "../src/mcp-events.js";
import { defineFeedbackCollections } from "../src/index.js";

declare const options: Omit<FeedbackSubmittedEventsOptions, "definition">;

const events = createFeedbackSubmittedEventsOptions({
  ...options,
  definition: defineFeedbackCollections({
    collections: ["internal"],
    monitors: [{
      collection: "internal",
      access: "protected",
      requiredScopes: ["feedback:monitor"],
    }],
  }),
});

if (events) events.definitions.length satisfies number;
const phase: FeedbackMonitorAuthorizationPhase = "refresh";
phase satisfies "refresh";
