import { defineTool, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";

const inventoryReport = {
  item: "Green coffee bags",
  onHandBags: 120,
  reservedBags: 35,
  availableToPromiseBags: 85,
  inboundBags: 40,
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
    onHandBags: z.number().int().nonnegative(),
    reservedBags: z.number().int().nonnegative(),
    availableToPromiseBags: z.number().int().nonnegative(),
    inboundBags: z.number().int().nonnegative(),
    inboundAvailableToPromise: z.boolean(),
  }),
  handler: () => ({
    text: [
      "Green coffee bags inventory:",
      "- 120 on hand",
      "- 35 reserved",
      "- 85 available to promise (120 on hand minus 35 reserved)",
      "- 40 inbound, not yet available to promise",
    ].join("\n"),
    data: inventoryReport,
  }),
})) satisfies CapabilityModuleFactory;
