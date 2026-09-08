import { defineTool, type CapabilityModuleFactory } from "@emseepea/server";
import { peaVarietyCatalog } from "../generated/public/PeaVarietyCatalog.mjs";
import { varietySchema } from "../pea-variety.js";
import type { DatabaseSchemaContext } from "./context.js";

const inputSchema = varietySchema;
const outputSchema = varietySchema;

export default ((context) => defineTool({
  name: "add-pea-variety",
  access: "public",
  description: "Add one pea variety to the catalogue.",
  inputSchema,
  outputSchema,
  async handler(variety, { signal }) {
    const database = context.database();
    if (!database) throw new Error("Variety provider unavailable");
    signal.throwIfAborted();
    const result = await database.query({
      text: `
        INSERT INTO pea_variety_catalog
          (name, pea_type, growth_habit, days_to_maturity, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING name, pea_type, growth_habit, days_to_maturity, notes
      `,
      values: [
        variety.name,
        variety.pea_type,
        variety.growth_habit,
        variety.days_to_maturity,
        variety.notes,
      ],
    });
    signal.throwIfAborted();
    return { data: peaVarietyCatalog.parse(result.rows[0]) };
  },
})) satisfies CapabilityModuleFactory<DatabaseSchemaContext>;
