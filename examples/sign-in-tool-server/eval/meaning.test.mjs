import test from "node:test";
import {
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

test("excludes reserved and inbound packets from current availability", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
    authToken: "example-access-token",
  });
  const response = await chat.send(
    "How many pea seed packets can we promise now, and do inbound packets count?",
  );

  assertToolCalls(response, [{
    name: "get-private-inventory-report",
    arguments: {},
  }]);
  assertResponseContains(response, "85");
  await assertResponseMeaning(response, {
    expected:
      "There are 85 packets available to promise because 35 reserved packets " +
      "are excluded from the 120 on hand. The 40 inbound packets do not count yet.",
  });
});
