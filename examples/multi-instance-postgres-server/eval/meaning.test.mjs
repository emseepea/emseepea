import test from "node:test";
import {
  assertNoToolCalls,
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

test("reuses the original shared report across server instances", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
    environment: { EMSEEPEA_INSTANCE: "eval-instance" },
  });

  // One judged turn checks whether the model understands replay. Cross-process
  // concurrency stays in ordinary tests because asking the model to simulate
  // routing would not exercise it. The second turn checks exact recall without
  // another tool call or another semantic judge.
  const response = await chat.send(
    "Create a shared harvest report with request ID daily-harvest-report. Then " +
    "repeat the same request ID. What are the pea type counts, and did the retry " +
    "create another report?",
  );

  assertToolCalls(response, [
    { name: "create-shared-harvest-report", arguments: { requestId: "daily-harvest-report" } },
    { name: "create-shared-harvest-report", arguments: { requestId: "daily-harvest-report" } },
  ]);
  await assertResponseMeaning(response, {
    expected:
      "The report contains four plants, two shelling and two snap. Reusing the " +
      "request ID returns that report and does not create another one.",
  });

  const creator = await chat.send(
    "What exact createdByInstance value did those tool results return?",
  );
  assertNoToolCalls(creator);
  assertResponseContains(creator, "eval-instance");
});
