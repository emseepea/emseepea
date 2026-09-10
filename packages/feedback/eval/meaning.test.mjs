import test from "node:test";
import {
  assertFeedback,
  assertNoToolCalls,
  assertResponseContains,
  assertResponseMeaning,
  assertToolArguments,
  assertToolCalls,
  assertToolNames,
  createConversation,
} from "@emseepea/testing/semantic";

test("records observed friction openly, once, and stops after an objection", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("./submission-server.mjs", import.meta.url),
  });

  // The application result exposes real interaction evidence, not test
  // guidance. One judge covers open disclosure; exact calls cover the rest.
  const recorded = await chat.send(
    "Find a snap pea variety in the catalogue.",
  );
  assertToolNames(recorded, ["search-pea-varieties", "submit-feedback"]);
  assertToolArguments(recorded, "search-pea-varieties", { query: "snap pea" });
  assertFeedback(recorded, {
    observation: "friction",
    detailIncludes: ["filter", "below the results"],
  });
  await assertResponseMeaning(recorded, {
    expected:
      "The response tells the user that Highland Snap matched and openly says feedback about the difficult variety filter was recorded.",
  });

  const objection = await chat.send("Do not record any more feedback in this conversation.");
  assertNoToolCalls(objection);

  const repeated = await chat.send("Find that same snap pea variety again.");
  assertToolNames(repeated, ["search-pea-varieties"]);
  assertResponseContains(repeated, "Highland Snap");
});

test("records notable success", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("./submission-server.mjs", import.meta.url),
  });

  // One positive observation proves feedback is not framed as complaint-only.
  const success = await chat.send("Find a shelling pea variety in the catalogue.");
  assertToolNames(success, ["search-pea-varieties"]);
  assertToolArguments(success, "search-pea-varieties", { query: "shelling pea" });
  assertResponseContains(success, "Harbour Gem");

  const praised = await chat.send("That was unexpectedly helpful and saved me a lot of time.");
  assertToolNames(praised, ["submit-feedback"]);
  assertFeedback(praised, {
    observation: ["notable_success", "unexpected_good_result"],
    detailIncludes: ["shelling pea", "time"],
  });
  await assertResponseMeaning(praised, {
    expected:
      "The response tells the user in first-person language that feedback was recorded and briefly summarizes the specific positive observation.",
  });
});

test("does not record feedback for a normal empty result", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("./submission-server.mjs", import.meta.url),
  });

  // Keep this control independent. Prior praise or friction would bias whether
  // an otherwise normal empty result appears notable enough to record.
  const empty = await chat.send(
    "Check whether the catalogue contains a pea variety named Example Missing Variety.",
  );
  assertToolNames(empty, ["search-pea-varieties"]);
  await assertResponseMeaning(empty, {
    expected: "The response tells the user that the catalogue returned no matching variety.",
  });
});

test("presents a team reply and appends the user's next message", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("./conversation-server.mjs", import.meta.url),
    authToken: "test-token",
  });

  // The first turn pays for one meaning judgment because presenting the reply
  // is the user outcome. The exact second call proves continued threading at
  // no additional judge cost.
  const reply = await chat.send("Check support feedback thread thread-1 for a reply.");
  assertToolCalls(reply, [{
    name: "get-feedback-thread",
    arguments: { threadId: "thread-1" },
  }]);
  await assertResponseMeaning(reply, {
    expected:
      "The response tells the user that support moved the variety filter above the results and kept it in place after every search.",
  });

  const response = await chat.send("Reply exactly: That fixes the problem, thank you.");
  assertToolCalls(response, [{
    name: "reply-to-feedback-thread",
    arguments: {
      threadId: "thread-1",
      message: "That fixes the problem, thank you.",
    },
  }]);
});
