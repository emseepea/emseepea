import { defineTool, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";
import type { MultiInstanceContext } from "./context.js";

export default (({ instanceName }) => defineTool({
  name: "describe-instance",
  access: "public",
  description: "Return the server instance handling this request, not the instance that created a stored report.",
  inputSchema: z.object({}),
  outputSchema: z.object({ instanceName: z.string() }),
  handler: () => ({ text: instanceName, data: { instanceName } }),
})) satisfies CapabilityModuleFactory<MultiInstanceContext>;
