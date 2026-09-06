import { defineTool, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";

const inventoryReport = {
  item: "Pea seed packets",
  onHandPackets: 120,
  reservedPackets: 35,
  availableToPromisePackets: 85,
  inboundPackets: 40,
  inboundAvailableToPromise: false,
} as const;

export default (() => defineTool({
  name: "get-private-inventory-report",
  access: "protected",
  requiredScopes: ["inventory:read"],
  title: "Private Inventory Report",
  description: "Report private on-hand, reserved, available-to-promise, and inbound inventory.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    item: z.string().describe("Inventory item counted by this report."),
    onHandPackets: z.number().int().nonnegative().describe("Packets currently held in inventory."),
    reservedPackets: z.number().int().nonnegative().describe("On-hand packets already reserved for orders."),
    availableToPromisePackets: z.number().int().nonnegative()
      .describe("On-hand packets available for new orders after reservations."),
    inboundPackets: z.number().int().nonnegative().describe("Packets expected but not yet received."),
    inboundAvailableToPromise: z.boolean()
      .describe("Whether inbound packets are included in available-to-promise inventory."),
  }),
  handler: () => ({ data: inventoryReport }),
})) satisfies CapabilityModuleFactory;
