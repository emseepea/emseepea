import test from "node:test";
import {
  assertNoNegativeFeedback,
  assertResponseContains,
  assertResponseMeaning,
  assertToolCallsWithOptionalFeedback,
  createConversation,
} from "@emseepea/testing/semantic";

test("looks up a pet and explains its status", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../test-support/llm-server.mjs", import.meta.url),
  });
  const response = await chat.send("Look up Swagger Petstore pet 7. What is its name and status?");

  await assertToolCallsWithOptionalFeedback(response, [{ name: "get-pet", arguments: { petId: 7 } }]);
  assertResponseContains(response, "Sweet Pea");
  await assertResponseMeaning(response, { expected: "Pet 7 is named Sweet Pea and is available." });
  assertNoNegativeFeedback(response);
});
