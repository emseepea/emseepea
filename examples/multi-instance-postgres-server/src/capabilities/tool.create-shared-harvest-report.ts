import { defineMappedTool, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";
import type { MultiInstanceContext } from "./context.js";

const requestIdSchema = z.string().min(3).max(64).regex(/^[a-z0-9][a-z0-9-]*$/)
  .describe("Idempotency key. Reusing it returns the existing report instead of creating another.");
const inputSchema = z.object({ requestId: requestIdSchema });
const outputSchema = z.object({
  reportId: z.number().int().positive().describe("Stored report identifier."),
  requestId: requestIdSchema,
  createdByInstance: z.string().min(1).max(64).describe("Server instance that originally created the report."),
  totalPlants: z.number().int().nonnegative().describe("Total pea plants counted in the report."),
  peaTypeCounts: z.object({
    shelling: z.number().int().nonnegative().describe("Shelling pea plants counted in the report."),
    snap: z.number().int().nonnegative().describe("Snap pea plants counted in the report."),
  }).describe("Plant counts grouped by pea type."),
});
const backendInputSchema = z.object({ idempotency_key: requestIdSchema });
const backendOutputSchema = z.object({
  report_id: z.number().int().positive(),
  idempotency_key: requestIdSchema,
  created_by_instance: z.string().min(1).max(64),
  total_plants: z.number().int().nonnegative(),
  shelling_count: z.number().int().nonnegative(),
  snap_count: z.number().int().nonnegative(),
});

export default ((context) => defineMappedTool({
  name: "create-shared-harvest-report",
  access: "public",
  description: "Create or return one stored pea harvest report per request ID. The result identifies its original server instance.",
  inputSchema,
  outputSchema,
  backendInputSchema,
  backendOutputSchema,
  isAvailable: () => {
    return context.database() !== undefined;
  },
  mapInput: ({ requestId }) => ({ idempotency_key: requestId }),
  async adapter({ idempotency_key }, { signal }) {
    const database = context.database();
    if (!database) throw new Error("Report provider unavailable");
    signal.throwIfAborted();
    const result = await database.query({
      text: `
        INSERT INTO reports (
          idempotency_key, created_by_instance, total_plants,
          shelling_count, snap_count
        )
        SELECT
          $1,
          $2,
          COUNT(*)::integer,
          COUNT(*) FILTER (WHERE pea_type = 'shelling')::integer,
          COUNT(*) FILTER (WHERE pea_type = 'snap')::integer
        FROM pea_plants
        ON CONFLICT (idempotency_key) DO UPDATE
          SET idempotency_key = EXCLUDED.idempotency_key
        RETURNING
          report_id, idempotency_key, created_by_instance, total_plants,
          shelling_count, snap_count
      `,
      values: [idempotency_key, context.instanceName],
    });
    signal.throwIfAborted();
    return result.rows[0] as z.input<typeof backendOutputSchema>;
  },
  mapOutput: (report) => {
    const data = {
      reportId: report.report_id,
      requestId: report.idempotency_key,
      createdByInstance: report.created_by_instance,
      totalPlants: report.total_plants,
      peaTypeCounts: {
        shelling: report.shelling_count,
        snap: report.snap_count,
      },
    };
    return { data };
  },
})) satisfies CapabilityModuleFactory<MultiInstanceContext>;
