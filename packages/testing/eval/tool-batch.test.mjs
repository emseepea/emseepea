import assert from "node:assert/strict";
import test from "node:test";
import { assertResponseContains, assertResponseMeaning, assertToolNames, createConversation } from "@emseepea/testing/semantic";

test("a native conversation reads four authoritative records in one answer", async (t) => {
  const chat = await createConversation(t, { server: new URL("./batch-server.mjs", import.meta.url) });
  const answer = await chat.send("What are the departure times for the north, east, south, and west routes?");
  assertToolNames(answer, Array(4).fill("read-departure"));
  // Independent reads may be scheduled in any order, but every trial must
  // call the real MCP tool exactly once for each requested route.
  for (const calls of answer.toolCalls) {
    assert.deepEqual([...calls].sort((a, b) => a.arguments.route.localeCompare(b.arguments.route)),
      ["east", "north", "south", "west"].map((route) => ({ name: "read-departure", arguments: { route } })));
  }
  for (const departure of ["08:10", "09:20", "10:30", "11:40"]) assertResponseContains(answer, departure);
  await assertResponseMeaning(answer, {
    expected: "North departs at 08:10, east at 09:20, south at 10:30, and west at 11:40. Each route is paired with its authoritative time.",
  });
});
