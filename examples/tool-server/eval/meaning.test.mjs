import test from "node:test";
import {
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

test("keeps pea variety details distinct", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
  });
  const response = await chat.send(
    "Describe the pea type, growth habit, maturity time, and traits of Highland Snap.",
  );

  assertToolCalls(response, [{
    name: "get-pea-variety",
    arguments: { name: "Highland Snap" },
  }]);
  assertResponseContains(response, "Highland Snap");
  await assertResponseMeaning(response, {
    expected:
      "Highland Snap is a climbing snap pea that matures in 70 days, has edible " +
      "pods, and needs support. Pea type, growth habit, maturity time, and traits " +
      "remain distinct.",
  });
});
