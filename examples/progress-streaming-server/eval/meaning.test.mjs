import test from "node:test";
import {
  assertNoToolCalls,
  assertNoNegativeFeedback,
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

const server = new URL(import.meta.resolve("@emseepea/feedback/testing-server"));
const environment = {
  EMSEEPEA_EVAL_APP_MODULE: new URL("../dist/app.js", import.meta.url).href,
  EMSEEPEA_EVAL_APP_FACTORY: "createProgressStreamingServer",
};

test("keeps progress stages distinct from the completed result", async (t) => {
  const chat = await createConversation(t, {
    server,
    environment,
  });

  // The judge checks the important progress-versus-result distinction once.
  // A literal follow-up checks stage memory without rerunning the slow tool.
  const response = await chat.send(
    "Run the sample-tray pea germination trial. List its progress stages and final result.",
  );

  assertToolCalls(response, [{
    name: "run-germination-trial",
    arguments: { tray: "sample-tray" },
  }]);
  assertResponseContains(response, "sample-tray");
  await assertResponseMeaning(response, {
    expected:
      "Soak, sow, and sprout are progress stages. The separate completed result " +
      "is 8 of 10 germinated seeds for sample-tray.",
  });

  const followUp = await chat.send(
    "Which progress stage came immediately after soak? Reply with the lowercase stage name only.",
  );
  assertNoToolCalls(followUp);
  assertResponseContains(followUp, "sow");
  assertNoNegativeFeedback(response, followUp);
});
