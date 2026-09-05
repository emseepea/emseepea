import test from "node:test";
import {
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

test("keeps progress stages distinct from the completed result", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
  });
  const response = await chat.send(
    "Run the sample-tray pea germination trial. List its progress stages and final result.",
  );

  assertToolCalls(response, [{
    name: "run-germination-trial",
    arguments: { tray: "sample-tray" },
  }]);
  assertResponseContains(response, "sample-tray");
  await assertResponseMeaning(response, {
    expected:
      "Soak, sow, and sprout are progress stages. The separate completed result " +
      "is 8 of 10 germinated seeds for sample-tray.",
  });
});
