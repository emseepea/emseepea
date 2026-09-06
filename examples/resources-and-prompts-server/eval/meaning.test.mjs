import test from "node:test";
import {
  assertNoToolCalls,
  assertResponseContains,
  assertResponseMeaning,
  createConversation,
} from "@emseepea/testing/semantic";

test("keeps sowing depth and plant spacing separate", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
  });

  // Fixed and templated resources plus a prompt are prepared in one turn. That
  // broadens MCP coverage without adding another model conversation or judge.
  await chat.prepare(async ({ readResource, getPrompt }) => {
    await readResource({ uri: "guide://peas/getting-started" });
    await readResource({ uri: "guide://peas/planting/container" });
    await getPrompt({ name: "growing-guide", arguments: { topic: "sowing-depth" } });
  });

  const response = await chat.send(
    "Which planting method is the selected method guide for? If I sow pea seeds " +
    "deeper, should I also space the plants farther apart? Explain the distinction.",
  );

  assertNoToolCalls(response);
  // The explanation may be paraphrased, so spend the test's only semantic
  // judgment here instead of coupling the test to particular wording.
  await assertResponseMeaning(response, {
    expected:
      "The selected method guide is for containers. Sowing peas deeper does not " +
      "mean spacing plants farther apart. Sowing depth is how deep a seed goes, " +
      "while plant spacing is the gap between plants.",
  });

  const followUp = await chat.send(
    "What is the exact URI of the selected planting method guide?",
  );
  // The URI is a stable identifier, so exact matching proves conversational
  // recall without paying for a second semantic judgment.
  assertNoToolCalls(followUp);
  assertResponseContains(followUp, "guide://peas/planting/container");
});
