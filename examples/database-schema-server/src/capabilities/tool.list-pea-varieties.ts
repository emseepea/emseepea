import { defineTool, type CapabilityModuleFactory, type ToolContext } from "@emseepea/server";
import { z } from "zod";
import { peaVarietyCatalog } from "../generated/public/PeaVarietyCatalog.mjs";
import { varietySchema } from "../pea-variety.js";
import type { DatabaseSchemaContext } from "./context.js";

const inputSchema = z.object({
  pea_type: z.string().trim().min(1).max(40).optional()
    .describe("Optional pea type to match exactly. Omit it to list every type."),
});
const outputSchema = z.object({
  varieties: z.array(varietySchema).max(20).describe("Matching pea varieties ordered by name."),
});

export default ((context) => defineTool({
  name: "list-pea-varieties",
  ...context.access,
  description: "List pea varieties, optionally filtered by pea type.",
  inputSchema,
  outputSchema,
  async handler({ pea_type }, { signal }: ToolContext) {
    const database = context.database();
    if (!database) throw new Error("Variety provider unavailable");
    signal.throwIfAborted();
    const result = await database.query({
      text: `
        SELECT name, pea_type, growth_habit, days_to_maturity, notes
        FROM pea_variety_catalog
        WHERE ($1::text IS NULL OR pea_type = $1)
        ORDER BY name
        LIMIT 20
      `,
      values: [pea_type ?? null],
    });
    signal.throwIfAborted();
    const varieties = z.array(peaVarietyCatalog).max(20).parse(result.rows);
    return { data: { varieties } };
  },
})) satisfies CapabilityModuleFactory<DatabaseSchemaContext>;
