import { createEmseepea, serveEmseepea } from "@emseepea/server";
import { insecureTestAuthentication } from "@emseepea/testing";
import {
  createInMemoryFeedbackCollectionBackend,
  defineFeedbackCollections,
  defineFeedbackCollectionSubmissions,
  defineFeedbackCollectionOperators,
} from "../dist/index.js";

const mode = process.env.FEEDBACK_EVAL_MODE;
if (!["customer", "internal", "operator"].includes(mode)) throw new Error("Invalid collection eval mode");
const scope = "isolated-account";
const backend = createInMemoryFeedbackCollectionBackend({
  createSubmissionId: () => "new-submission",
  now: () => "2026-10-05T00:00:00.000Z",
  initialRecords: [
    {
      collection: "customer", submissionId: "customer-1", scope,
      observation: "friction", detail: "Checkout required three retries because the payment button disappeared.",
      recordedAt: "2026-10-05T00:00:00.000Z",
      source: { system: "support", id: "customer-1" },
    },
    {
      collection: "internal", submissionId: "internal-1", scope,
      observation: "suggestion", detail: "Show the triage queue beside the internal incident view.",
      recordedAt: "2026-10-05T00:00:00.000Z",
      source: { system: "support", id: "internal-1" },
    },
  ],
});
const definition = defineFeedbackCollections({
  collections: ["customer", "internal"],
  ...(mode === "operator" ? {
    operators: [
      { collection: "customer", access: "protected", requiredScopes: ["feedback:operator"] },
      { collection: "internal", access: "protected", requiredScopes: ["feedback:operator"] },
    ],
  } : {
    submissions: [{ collection: mode, access: "protected", requiredScopes: ["feedback:submit"] }],
  }),
});
const app = createEmseepea({
  name: "collection-feedback-eval", version: "0.0.0",
  authentication: insecureTestAuthentication(["feedback:submit", "feedback:operator"]),
  tools: [
    ...defineFeedbackCollectionSubmissions({ definition, scope, backend }),
    ...defineFeedbackCollectionOperators({ definition, scope, backend }),
  ],
});
const running = await serveEmseepea(app, {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});
console.log(`Collection feedback eval server listening at ${running.url}`);
process.once("SIGINT", () => void running.close());
process.once("SIGTERM", () => void running.close());
