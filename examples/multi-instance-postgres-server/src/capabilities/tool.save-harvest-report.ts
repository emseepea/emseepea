import { defineTool, type CapabilityModuleFactory, type ToolContext } from "@emseepea/server";
import { z } from "zod";
import { editableReportSchema, reportSchema } from "../harvest-report.js";
import type { MultiInstanceContext } from "./context.js";

const inputSchema = editableReportSchema;
const outputSchema = reportSchema;

export default ((context) => defineTool({
  name: "save-harvest-report",
  ...context.access,
  description: "Save the complete pea harvest report for a garden bed and date.",
  inputSchema,
  outputSchema,
  async handler({ gardenBed, harvestDate, shellingCount, snapCount }, { signal }: ToolContext) {
    const database = context.database();
    if (!database) throw new Error("Report provider unavailable");
    signal.throwIfAborted();
    const result = await database.query({
      text: `
        INSERT INTO harvest_reports (
          garden_bed, harvest_date, shelling_count, snap_count
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (garden_bed, harvest_date) DO UPDATE SET
          shelling_count = EXCLUDED.shelling_count,
          snap_count = EXCLUDED.snap_count
        RETURNING
          garden_bed AS "gardenBed",
          harvest_date::text AS "harvestDate",
          shelling_count AS "shellingCount",
          snap_count AS "snapCount",
          (shelling_count + snap_count)::integer AS "totalPlants"
      `,
      values: [gardenBed, harvestDate, shellingCount, snapCount],
    });
    signal.throwIfAborted();
    return { data: result.rows[0] as z.input<typeof outputSchema> };
  },
})) satisfies CapabilityModuleFactory<MultiInstanceContext>;
