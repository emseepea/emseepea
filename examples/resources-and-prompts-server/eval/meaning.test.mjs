import test from "node:test";
import {
  assertNoToolCalls,
  assertNoNegativeFeedback,
  assertResponseMeaning,
  createConversation,
} from "@emseepea/testing/semantic";

const server = new URL(import.meta.resolve("@emseepea/feedback/testing-server"));
const environment = {
  EMSEEPEA_EVAL_APP_MODULE: new URL("../dist/app.js", import.meta.url).href,
  EMSEEPEA_EVAL_APP_FACTORY: "createResourcesAndPromptsServer",
};

test("does not pretend an unselected resource was supplied", async (t) => {
  const chat = await createConversation(t, {
    server,
    environment,
  });

  const response = await chat.send(
    "Without me selecting or attaching a growing guide, what exact sowing depth " +
    "and plant spacing does guide://peas/planting/container specify?",
  );

  assertNoToolCalls(response);
  // Resources and prompts are user-selected client features, not autonomous
  // tools. One semantic assertion checks the honest unselected experience.
  await assertResponseMeaning(response, {
    expected:
      "The response does not claim to know the guide's recommendation. It says " +
      "the user must select or attach the resource before its content can be used.",
  });
  assertNoNegativeFeedback(response);
});
