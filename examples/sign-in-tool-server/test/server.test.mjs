import assert from "node:assert/strict";
import test from "node:test";

import { startMcpServer } from "@emseepea/testing";

test("keeps discovery public and requires authorization for inventory", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const anonymous = await running.connect();
  const listed = await anonymous.listTools();
  assert.deepEqual(listed.tools.map(({ name }) => name), [
    "get-private-inventory-report",
  ]);
  const output = listed.tools[0].outputSchema.properties;
  assert.equal(output.item.description, "Inventory item counted by this report.");
  assert.equal(output.onHandPackets.description, "Packets currently held in inventory.");
  assert.equal(output.reservedPackets.description, "On-hand packets already reserved for orders.");
  assert.equal(output.availableToPromisePackets.description, "On-hand packets available for new orders after reservations.");
  assert.equal(output.inboundPackets.description, "Packets expected but not yet received.");
  assert.equal(output.inboundAvailableToPromise.description, "Whether inbound packets are included in available-to-promise inventory.");

  const authorized = await running.connect("example-access-token");
  const result = await authorized.callTool({
    name: "get-private-inventory-report",
    arguments: {},
  });
  assert.equal(result.isError, false);
  assert.deepEqual(result.structuredContent, {
    item: "Pea seed packets",
    onHandPackets: 120,
    reservedPackets: 35,
    availableToPromisePackets: 85,
    inboundPackets: 40,
    inboundAvailableToPromise: false,
  });
});
