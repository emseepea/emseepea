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
    item: z.string(),
    onHandPackets: z.number().int().nonnegative(),
    reservedPackets: z.number().int().nonnegative(),
    availableToPromisePackets: z.number().int().nonnegative(),
    inboundPackets: z.number().int().nonnegative(),
    inboundAvailableToPromise: z.boolean(),
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
