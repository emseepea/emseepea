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
  EMSEEPEA_EVAL_APP_FACTORY: "createReactUiServer",
};

test("understands an all-varieties React UI preview", async (t) => {
  const chat = await createConversation(t, {
    server,
    environment,
  });

  // This variant covers all-variety filtering and omitted tips. One exact
  // follow-up checks memory while keeping the suite to one costly judge.
  const response = await chat.send(
    "Preview a plan titled All pea plan for all pea types, without growing tips. " +
    "Summarize the matches and say whether anything was sent, stored, or changed.",
  );

  assertToolCalls(response, [{
    name: "preview-planting-plan",
    arguments: { title: "All pea plan", peaType: "all", includeTips: false },
  }]);
  assertResponseContains(response, "Harbour Gem");
  await assertResponseMeaning(response, {
    expected:
      "The preview contains Harbour Gem, Highland Snap, and Meadow Sweet without " +
      "growing tips. It is preview-only, sent and stored no report, and changed no " +
      "external data.",
  });

  const followUp = await chat.send(
    "How many varieties were in that preview? Reply with the numeral only.",
  );
  assertNoToolCalls(followUp);
  assertResponseContains(followUp, "3");
  assertNoNegativeFeedback(response, followUp);
});
