import {
  defineFeedbackCollections,
  type FeedbackCollectionsDefinition,
} from "../src/index.js";

const compiled = defineFeedbackCollections({
  collections: ["internal", "customer"],
  submissions: [{ collection: "internal", access: "public" }],
  operators: [{
    collection: "internal",
    access: "protected",
    requiredScopes: ["feedback:read"],
  }],
  monitors: [{
    collection: "customer",
    access: "protected",
    requiredScopes: ["feedback:events"],
  }],
});

compiled satisfies FeedbackCollectionsDefinition;
compiled.catalogue[0]!.roles satisfies readonly ("submission" | "operator" | "monitor")[];
compiled.submissions[0]!.toolName satisfies `submit-${string}-feedback`;

defineFeedbackCollections({
  collections: ["internal"],
  // @ts-expect-error operator roles must declare protected access and scopes
  operators: [{ collection: "internal", access: "public" }],
});
