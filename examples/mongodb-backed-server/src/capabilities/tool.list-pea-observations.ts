import { defineTool, type CapabilityModuleFactory, type ToolContext } from "@emseepea/server";
import { z } from "zod";
import type { MongoContext } from "../database.js";
import { parsePeaObservationDocument } from "../pea-observation-document.js";
import { observationSchema } from "../pea-observation.js";

const inputSchema = z.object({
  variety_name: z.string().trim().min(1).max(100).optional()
    .describe("Optional variety name to match exactly. Omit it to list every variety."),
});
const outputSchema = z.object({
  observations: z.array(observationSchema).max(20)
    .describe("Up to 20 recent pea observations, newest first."),
});

export default ((context) => defineTool({
  name: "list-pea-observations",
  ...context.access,
  description: "List up to 20 recent observations of pea plants.",
  inputSchema,
  outputSchema,
  async handler({ variety_name }, { signal }: ToolContext) {
    const collection = context.observations();
    if (!collection) throw new Error("Observation provider unavailable");
    signal.throwIfAborted();
    const rows = await collection.find(
      variety_name ? { variety_name } : {},
      {
        projection: {
          _id: 1,
          variety_name: 1,
          observed_on: 1,
          location: 1,
          growth_stage: 1,
          notes: 1,
        },
      },
    ).sort({ observed_on: -1, variety_name: 1 }).limit(20).maxTimeMS(1_500).toArray();
    signal.throwIfAborted();
    const observations = rows.map((row) => {
      const { _id: _internalId, ...observation } = parsePeaObservationDocument(row);
      return observation;
    });
    return { data: { observations } };
  },
})) satisfies CapabilityModuleFactory<MongoContext>;
