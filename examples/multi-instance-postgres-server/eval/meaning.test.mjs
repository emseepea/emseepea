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

  // Cross-process concurrency stays in ordinary tests because asking the model
  // to simulate routing would not exercise it. Only the comparison turn needs
  // a semantic judge; the other turns use exact tool and literal assertions.
  const created = await chat.send(
    "Create a shared harvest report with request ID daily-harvest-report.",
  );
  assertToolCalls(created, [
    { name: "create-shared-harvest-report", arguments: { requestId: "daily-harvest-report" } },
  ]);
  const repeated = await chat.send(
    "Create that report again with the same request ID. Is its report ID the " +
    "same as before?",
  );
  assertToolCalls(repeated, [
    { name: "create-shared-harvest-report", arguments: { requestId: "daily-harvest-report" } },
  ]);
  await assertResponseMeaning(repeated, {
    expected: "The repeated request returned the same report ID.",
  });

  const creator = await chat.send(
    "What exact createdByInstance value did those tool results return?",
  );
  assertNoToolCalls(creator);
  assertResponseContains(creator, "eval-instance");
});
