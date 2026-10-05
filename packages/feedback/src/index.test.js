import assert from "node:assert/strict";
import test from "node:test";
import { createEmseepea } from "@emseepea/server";
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";
import { defineFeedbackCollectionOperators, defineFeedbackCollections } from "../dist/index.js";

test("exact operator retrieval rejects a different record in the same collection and scope", async (t) => {
  const definition = defineFeedbackCollections({
    collections: ["internal"],
    operators: [{ collection: "internal", access: "protected", requiredScopes: ["feedback:operator"] }],
  });
  const tools = defineFeedbackCollectionOperators({
    definition,
    scope: "deployment-a",
    backend: {
      getSubmission: () => ({
        collection: "internal", submissionId: "different-id", scope: "deployment-a",
        observation: "friction", detail: "Another record.",
        recordedAt: "2026-10-05T04:00:00.000Z",
        source: { system: "support", id: "different-id" },
      }),
      listSubmissions: () => ({ submissions: [] }),
    },
  });
  const running = await startEmseepea(t, createEmseepea({
    name: "exact-feedback-record", version: "0.0.0", tools,
    authentication: insecureTestAuthentication(["feedback:operator"]),
  }));
  const client = await running.connect("test-token");
  const result = await client.callTool({
    name: "get-feedback-submission",
    arguments: { collection: "internal", submissionId: "requested-id" },
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
});
