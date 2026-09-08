import { defineTool, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";
import { reportKeySchema, reportSchema } from "../harvest-report.js";
import type { MultiInstanceContext } from "./context.js";

const inputSchema = reportKeySchema;
const outputSchema = z.object({
  report: reportSchema.nullable().describe(
    "The saved harvest report, or null when no report exists for that garden bed and date.",
  ),
});

export default ((context) => defineTool({
  name: "get-harvest-report",
  access: "public",
  description: "Get the pea harvest report for a garden bed and date.",
  inputSchema,
  outputSchema,
  async handler({ gardenBed, harvestDate }, { signal }) {
    const database = context.database();
    if (!database) throw new Error("Report provider unavailable");
    signal.throwIfAborted();
    const result = await database.query({
      text: `
        SELECT
          garden_bed AS "gardenBed",
          harvest_date::text AS "harvestDate",
          shelling_count AS "shellingCount",
          snap_count AS "snapCount",
          (shelling_count + snap_count)::integer AS "totalPlants"
        FROM harvest_reports
        WHERE garden_bed = $1 AND harvest_date = $2
      `,
      values: [gardenBed, harvestDate],
    });
    signal.throwIfAborted();
    return { data: { report: result.rows[0] ?? null } };
  },
})) satisfies CapabilityModuleFactory<MultiInstanceContext>;
