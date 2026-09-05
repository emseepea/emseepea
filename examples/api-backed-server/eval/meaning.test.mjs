import test from "node:test";
import {
  assertNoToolCalls,
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

test("searches once and remembers the common name for a follow-up", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../test-support/llm-server.mjs", import.meta.url),
  });

  const search = await chat.send(
    'Search the public taxon catalogue for "pea". ' +
    "Which species has more recorded observations, how many does it have, " +
    "and does that count estimate the wild population?",
  );

  assertToolCalls(search, [{
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
});
