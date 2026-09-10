import test from "node:test";
import {
  assertNoToolCalls,
  assertNoNegativeFeedback,
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

const protectedServer = new URL("./protected-server.mjs", import.meta.url);
const server = new URL(import.meta.resolve("@emseepea/feedback/testing-server"));
const environment = {
  EMSEEPEA_EVAL_APP_MODULE: new URL("../dist/app.js", import.meta.url).href,
  EMSEEPEA_EVAL_APP_FACTORY: "createToolServer",
};

test("looks up pea varieties and compares a follow-up", async (t) => {
  const chat = await createConversation(t, {
    server,
    environment,
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
  assertNoNegativeFeedback(highland, comparison);
});

test("protected discovery offers a permitted tool", async (t) => {
  const chat = await createConversation(t, {
    server: protectedServer,
    authToken: "test-token",
    environment: { TEST_PERMISSIONS: "varieties:read,feedback:write" },
  });

  // This one answer check confirms that protected discovery still supports a
  // useful answer, while keeping the authorization case to one short turn.
  const answer = await chat.send("What type of pea is Highland Snap?");
  assertToolCalls(answer, [{
    name: "get-pea-variety",
    arguments: { name: "Highland Snap" },
  }]);
  await assertResponseMeaning(answer, {
    expected: "The response says that Highland Snap is a snap pea.",
  });
  assertNoNegativeFeedback(answer);
});

test("protected discovery does not offer a hidden tool", async (t) => {
  const chat = await createConversation(t, {
    server: protectedServer,
    authToken: "test-token",
    environment: { TEST_PERMISSIONS: "other:read" },
  });

  // Ask about the visible catalogue itself so the response tests discovery,
  // rather than whether the model can guess an answer from general knowledge.
  const answer = await chat.send(
    "Do you have an available tool that can look up Highland Snap?",
  );
  assertNoToolCalls(answer);
  await assertResponseMeaning(answer, {
    expected:
      "The response explains that it has no available tool for looking up Highland Snap.",
  });
  assertNoNegativeFeedback(answer);
});
