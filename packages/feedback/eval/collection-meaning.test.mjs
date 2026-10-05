import test from "node:test";
import {
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

for (const collection of ["customer", "internal"]) {
  test(`records feedback only in the configured ${collection} collection`, async (t) => {
    const chat = await createConversation(t, {
      server: new URL("./collection-server.mjs", import.meta.url),
      environment: { FEEDBACK_EVAL_MODE: collection },
      authToken: "isolated-test-token",
    });
    const recorded = await chat.send(
      `Record ${collection} feedback with category friction and exactly this detail: The filter required three attempts.`,
    );
    assertToolCalls(recorded, [{
      name: `submit-${collection}-feedback`,
      arguments: { observation: "friction", detail: "The filter required three attempts." },
    }]);
    await assertResponseMeaning(recorded, {
      expected: `The response tells the user that ${collection} feedback about the filter requiring three attempts was recorded.`,
    });
  });
}

test("lists customer feedback then reads the exact authoritative submission", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("./collection-server.mjs", import.meta.url),
    environment: { FEEDBACK_EVAL_MODE: "operator" },
    authToken: "isolated-test-token",
  });
  const listed = await chat.send("List the latest customer feedback submissions, at most 5.");
  assertToolCalls(listed, [{
    name: "list-feedback-submissions", arguments: { collection: "customer", limit: 5 },
  }]);
  const read = await chat.send("Read that customer submission by its exact identifier and tell me what happened.");
  assertToolCalls(read, [{
    name: "get-feedback-submission",
    arguments: { collection: "customer", submissionId: "customer-1" },
  }]);
  await assertResponseMeaning(read, {
    expected: "The customer needed three checkout retries because the payment button disappeared. The response describes that authoritative customer submission without confusing it with internal feedback.",
  });
});

test("reads a body-free submitted-event reference before interpreting its content", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("./collection-server.mjs", import.meta.url),
    environment: { FEEDBACK_EVAL_MODE: "operator" },
    authToken: "isolated-test-token",
  });
  // This supplied reference tests interpretation and native retrieval, not webhook delivery.
  const read = await chat.send(
    'Feedback event feedback.submitted arrived with {"collection":"internal","submissionId":"internal-1","sourceEventId":"recorded-1"}. Tell me what the feedback says.',
  );
  assertToolCalls(read, [{
    name: "get-feedback-submission",
    arguments: { collection: "internal", submissionId: "internal-1" },
  }]);
  await assertResponseMeaning(read, {
    expected: "After reading the exact internal submission, the response says the feedback suggests showing the triage queue beside the internal incident view. It does not invent feedback content from the event identifiers.",
  });
});
