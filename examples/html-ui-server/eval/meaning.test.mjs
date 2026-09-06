import test from "node:test";
import {
  assertNoToolCalls,
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

test("does not mistake a native UI preview for a completed effect", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
  });

  // The judged turn covers the UI tool's main semantic risk: preview is not an
  // effect. A literal follow-up adds conversation coverage without another judge.
  const response = await chat.send(
    "Preview a plan titled Snap pea plan for snap peas, including growing tips. " +
    "Summarize the matches and say whether anything was sent, stored, or changed.",
  );

  assertToolCalls(response, [{
    name: "preview-planting-plan",
    arguments: { title: "Snap pea plan", peaType: "snap", includeTips: true },
  }]);
  assertResponseContains(response, "Highland Snap");
  await assertResponseMeaning(response, {
    expected:
      "The preview contains Highland Snap and Meadow Sweet. It is preview-only, " +
      "performed no effect, sent and stored no report, and changed no external data.",
  });

  const followUp = await chat.send(
    "How many snap varieties were in that preview? Reply with the numeral only.",
  );
  assertNoToolCalls(followUp);
  assertResponseContains(followUp, "2");
});
