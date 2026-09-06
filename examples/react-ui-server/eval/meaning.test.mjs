import test from "node:test";
import {
  assertNoToolCalls,
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

test("understands an all-varieties React UI preview", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
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
});
