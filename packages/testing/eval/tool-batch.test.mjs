import assert from "node:assert/strict";
import test from "node:test";
import { assertResponseContains, assertResponseMeaning, assertToolNames, createConversation } from "@emseepea/testing/semantic";

test("an isolated native conversation reads records across resumed and fresh sessions", async (t) => {
  const chat = await createConversation(t, { server: new URL("./batch-server.mjs", import.meta.url) });
  const allRoutes = await chat.send(
    "In the connected synthetic timetable, what are the north, east, south, and west departure times?",
  );
  assertToolNames(allRoutes, ["read-departure", "read-departure", "read-departure", "read-departure"]);
  const expectedCalls = ["east", "north", "south", "west"]
    .map((route) => ({ name: "read-departure", arguments: { route } }));
  for (const calls of allRoutes.toolCalls) {
    assert.deepEqual([...calls].sort((a, b) => a.arguments.route.localeCompare(b.arguments.route)), expectedCalls);
  }
  for (const departure of ["08:10", "09:20", "10:30", "11:40"]) assertResponseContains(allRoutes, departure);
  await assertResponseMeaning(allRoutes, {
    expected: "North departs at 08:10, east at 09:20, south at 10:30, and west at 11:40. Each route is paired with its authoritative time.",
  });

  const east = await chat.send(
    "Re-read the east route from the connected synthetic timetable and report its current departure time.",
  );
  assertToolNames(east, ["read-departure"]);
  assertResponseContains(east, "09:20");

  await chat.fresh();
  const fresh = await chat.send("In the connected synthetic timetable, what is the west route's departure time?");
  assertToolNames(fresh, ["read-departure"]);
  assertResponseContains(fresh, "11:40");
});
