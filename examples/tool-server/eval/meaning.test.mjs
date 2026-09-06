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

  // The first turn's flexible prose needs the one model judge. The follow-up's
  // exact call and returned name add context coverage without another judge.
  const highland = await chat.send(
    "Describe the pea type, growth habit, maturity time, and traits of Highland Snap.",
  );

  assertToolCalls(highland, [{
    name: "get-pea-variety",
    arguments: { name: "Highland Snap" },
  }]);
  assertResponseContains(highland, "Highland Snap");
  await assertResponseMeaning(highland, {
    expected:
      "Highland Snap is a climbing snap pea that matures in 70 days, has edible " +
      "pods, and needs support. Pea type, growth habit, maturity time, and traits " +
      "remain distinct.",
  });

  const comparison = await chat.send(
    "Compare that with Harbour Gem. Include its pea type, growth habit, and maturity time.",
  );
  assertToolCalls(comparison, [{
    name: "get-pea-variety",
    arguments: { name: "Harbour Gem" },
  }]);
  assertResponseContains(comparison, "Harbour Gem");
});
