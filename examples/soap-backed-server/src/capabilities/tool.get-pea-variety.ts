import { defineTool, type CapabilityModuleFactory, type ToolContext } from "@emseepea/server";
import { z } from "zod";
import type { GetPeaRequest, GetPeaResponse } from "../generated/pea-service.js";
import type { SoapExampleContext } from "./context.js";

const inputSchema = z.object({
  name: z.string().trim().min(1).max(100).describe("Name of the pea variety to retrieve."),
});
const outputSchema = z.object({
  name: z.string().min(1).max(100).describe("Name of the pea variety."),
  peaType: z.string().min(1).max(40).describe("Type of pea."),
  daysToMaturity: z.number().int().positive().describe("Typical number of days from sowing to harvest."),
  note: z.string().max(500).optional().describe("Optional growing note."),
  traits: z.array(z.string().max(100)).max(5).describe("Growing or eating traits."),
});

export default (({ client, access }) => defineTool({
  name: "get-pea-variety",
  ...access,
  description: "Get details about one pea variety.",
  inputSchema,
  outputSchema,
  async handler({ name }, { signal }: ToolContext) {
    signal.throwIfAborted();
    const request: GetPeaRequest = { name };
    const [response] = await client.GetPeaAsync(request, { signal });
    signal.throwIfAborted();
    return { data: outputSchema.parse(mapResponse(response)) };
  },
})) satisfies CapabilityModuleFactory<SoapExampleContext>;

function mapResponse(response: GetPeaResponse): z.input<typeof outputSchema> {
  return {
    name: response.name,
    peaType: response.peaType,
    // node-soap returns validated XSD numeric text as a string.
    daysToMaturity: Number(response.daysToMaturity),
    note: response.note,
    traits: response.trait ?? [],
  };
}
