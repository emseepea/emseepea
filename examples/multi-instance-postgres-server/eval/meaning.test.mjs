import test from "node:test";
import {
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
  // routing would not exercise it. The exact second turn distinguishes the
  // other advertised tool without adding another judge.
  const response = await chat.send(
    "Create a shared harvest report with request ID daily-harvest-report. Then " +
    "repeat the same request ID. Who created the stored report, what are the pea " +
    "type counts, and did the retry create another report?",
  );

  assertToolCalls(response, [
    { name: "create-shared-harvest-report", arguments: { requestId: "daily-harvest-report" } },
    { name: "create-shared-harvest-report", arguments: { requestId: "daily-harvest-report" } },
  ]);
  assertResponseContains(response, "eval-instance");
  await assertResponseMeaning(response, {
    expected:
      "The original report was created by eval-instance and contains four plants, " +
      "two shelling and two snap. Reusing the request ID returns that report and " +
      "does not create another one.",
  });

  const currentInstance = await chat.send(
    "Which server instance is handling this request now? Do not tell me which instance created the report.",
  );
  assertToolCalls(currentInstance, [{
    name: "describe-instance",
    arguments: {},
  }]);
  assertResponseContains(currentInstance, "eval-instance");
});
