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
  handler: () => ({
    text: [
      "Pea seed packet inventory:",
      "- 120 on hand",
      "- 35 reserved",
      "- 85 available to promise (120 on hand minus 35 reserved)",
      "- 40 inbound, not yet available to promise",
    ].join("\n"),
    data: inventoryReport,
  }),
})) satisfies CapabilityModuleFactory;
