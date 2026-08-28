import assert from "node:assert/strict";
import test from "node:test";

import { startMcpServer } from "@emseepea/testing";

test("keeps discovery public and requires authorization for inventory", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const anonymous = await running.connect();
  assert.deepEqual((await anonymous.listTools()).tools.map(({ name }) => name), [
    "get-private-inventory-report",
  ]);

  const authorized = await running.connect("example-access-token");
  const result = await authorized.callTool({
    name: "get-private-inventory-report",
    arguments: {},
  });
  assert.equal(result.isError, false);
  assert.deepEqual(result.structuredContent, {
    item: "Green coffee bags",
    onHandBags: 120,
    reservedBags: 35,
    availableToPromiseBags: 85,
    inboundBags: 40,
    inboundAvailableToPromise: false,
  });
});
