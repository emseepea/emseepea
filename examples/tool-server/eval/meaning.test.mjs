import test from "node:test";
import {
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

test("looks up pea varieties and compares a follow-up", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
  });

  // Two turns cover exact lookup and context-aware follow-up selection. Only
  // the comparison needs a model judge; fixed fields are cheaper as literals.
  const highland = await chat.send(
    "Describe the pea type, growth habit, maturity time, and traits of Highland Snap.",
  );

  assertToolCalls(highland, [{
    name: "get-pea-variety",
    arguments: { name: "Highland Snap" },
  }]);
  assertResponseContains(highland, [
    "Highland Snap",
    "70",
    "edible pods",
    "needs support",
  ]);

  const comparison = await chat.send(
    "Compare that with Harbour Gem. Include its pea type, growth habit, and maturity time.",
  );
  assertToolCalls(comparison, [{
    name: "get-pea-variety",
    arguments: { name: "Harbour Gem" },
  }]);
  assertResponseContains(comparison, ["Harbour Gem", "62"]);
  await assertResponseMeaning(comparison, {
    expected:
      "Harbour Gem is a bush shelling pea that matures in 62 days, while Highland " +
      "Snap is a climbing snap pea that matures in 70 days.",
  });
});
