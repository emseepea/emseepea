import test from "node:test";
import {
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

test("does not mistake a native UI preview for a completed effect", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
  });
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
});
