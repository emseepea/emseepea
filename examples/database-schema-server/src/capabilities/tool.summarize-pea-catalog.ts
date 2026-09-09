import { defineTool, type CapabilityModuleFactory, type ToolContext } from "@emseepea/server";
import { z } from "zod";
import { peaCatalogSummary } from "../generated/public/PeaCatalogSummary.mjs";
import type { DatabaseSchemaContext } from "./context.js";

const inputSchema = z.object({
  pea_type: z.string().trim().min(1).max(40).optional()
    .describe("Optional pea type to summarize. Omit it to summarize the whole catalogue."),
});
const outputSchema = z.object({
  pea_type: z.string().nullable().describe("Requested pea type, or all for an unfiltered summary."),
  variety_count: z.number().int().nonnegative().describe("Number of matching pea varieties."),
  fastest_days_to_maturity: z.number().int().positive().nullable()
    .describe("Fewest days to maturity among matching varieties, or null when none match."),
});

export default ((context) => defineTool({
  name: "summarize-pea-catalog",
  ...context.access,
  description: "Summarize the pea catalogue.",
  inputSchema,
  outputSchema,
  async handler({ pea_type }, { signal }: ToolContext) {
    const database = context.database();
    if (!database) throw new Error("Variety provider unavailable");
    signal.throwIfAborted();
    const client = await database.connect();
    try {
      const called = await client.query({
        text: "CALL summarize_pea_catalog($1, NULL)",
        values: [pea_type ?? null],
      });
      signal.throwIfAborted();
      const expanded = await client.query({
        text: "SELECT ($1::pea_catalog_summary).*",
        values: [called.rows[0]?.summary],
      });
      signal.throwIfAborted();
      return { data: outputSchema.parse(peaCatalogSummary.parse(expanded.rows[0])) };
    } finally {
      client.release();
    }
  },
})) satisfies CapabilityModuleFactory<DatabaseSchemaContext>;
