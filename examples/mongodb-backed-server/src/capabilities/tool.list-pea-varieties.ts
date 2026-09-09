import { defineTool, type CapabilityModuleFactory, type ToolContext } from "@emseepea/server";
import { z } from "zod";
import { parsePeaDocument } from "../pea-document.js";
import { varietySchema } from "../pea-variety.js";
import type { MongoContext } from "../database.js";

const inputSchema = z.object({
  pea_type: z.string().trim().min(1).max(40).optional()
    .describe("Optional pea type to match exactly. Omit it to list every type."),
});
const outputSchema = z.object({
  varieties: z.array(varietySchema).max(20).describe("Up to 20 matching pea varieties ordered by name."),
});

export default ((context) => defineTool({
  name: "list-pea-varieties",
  ...context.access,
  description: "List up to 20 pea varieties, optionally filtered by pea type.",
  inputSchema,
  outputSchema,
  async handler({ pea_type }, { signal }: ToolContext) {
    const collection = context.varieties();
    if (!collection) throw new Error("Variety provider unavailable");
    signal.throwIfAborted();
    const rows = await collection.find(
      pea_type ? { pea_type } : {},
      { projection: { _id: 1, name: 1, pea_type: 1, growth_habit: 1, days_to_maturity: 1, notes: 1 } },
    ).sort({ name: 1 }).limit(20).maxTimeMS(1_500).toArray();
    signal.throwIfAborted();
    const varieties = rows.map((row) => {
      const { _id: _internalId, ...variety } = parsePeaDocument(row);
      return variety;
    });
    return { data: { varieties } };
  },
})) satisfies CapabilityModuleFactory<MongoContext>;
