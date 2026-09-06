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

  // The first turn checks idempotent repeated calls. The exact second turn
  // distinguishes the other advertised tool without adding another judge.
  const response = await chat.send(
    "Call the shared harvest report twice with request ID daily-harvest-report, " +
    "as if the second call came from another server instance. Who created the " +
    "report, what are the pea type counts, and is another report created?",
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
