import test from "node:test";
import {
  assertNoToolCalls,
  assertNoNegativeFeedback,
  assertResponseContains,
  assertResponseMeaning,
  assertToolCallsWithOptionalFeedback,
  createConversation,
} from "@emseepea/testing/semantic";

test("searches once and remembers the common name for a follow-up", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../test-support/llm-server.mjs", import.meta.url),
  });

  // The judged search covers the backend result's domain meaning. The exact
  // no-call follow-up adds memory coverage without paying for a second judge.
  const search = await chat.send(
    'Search the public taxon catalogue for "pea". ' +
    "Which species has more recorded observations, how many does it have, " +
    "and does that count estimate the wild population?",
  );

  await assertToolCallsWithOptionalFeedback(search, [{
    name: "search-pea-taxa",
    arguments: { query: "pea" },
  }]);
  assertResponseContains(search, "Pisum sativum");
  await assertResponseMeaning(search, {
    expected:
      "Pisum sativum has the most recorded observations, with 8,720. " +
      "The response explains that recorded observations are not an estimate " +
      "of the wild population.",
  });

  const followUp = await chat.send("What was its common name?");
  assertNoToolCalls(followUp);
  assertResponseContains(followUp, "Common Pea");
  assertNoNegativeFeedback(search, followUp);
});
