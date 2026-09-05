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
  await chat.prepare(async ({ readResource, getPrompt }) => {
    await readResource({ uri: "guide://peas/getting-started" });
    await getPrompt({ name: "growing-guide", arguments: { topic: "sowing-depth" } });
  });

  const response = await chat.send(
    "If I sow pea seeds deeper, should I also space the plants farther apart? " +
    "Explain the distinction for a home gardener.",
  );

  assertNoToolCalls(response);
  assertResponseContains(response, ["Sowing depth", "plant spacing"]);
  await assertResponseMeaning(response, {
    expected:
      "Sowing peas deeper does not mean spacing plants farther apart. Sowing depth " +
      "is how deep a seed goes, while plant spacing is the gap between plants.",
  });
});
