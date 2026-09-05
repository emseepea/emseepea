import { defineMappedTool, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";
import type { MultiInstanceContext } from "./context.js";

const requestIdSchema = z.string().min(3).max(64).regex(/^[a-z0-9][a-z0-9-]*$/);
const reportInputSchema = z.object({ requestId: requestIdSchema });
const reportOutputSchema = z.object({
  reportId: z.number().int().positive(),
  requestId: requestIdSchema,
  createdByInstance: z.string().min(1).max(64),
  totalPlants: z.number().int().nonnegative(),
  peaTypeCounts: z.object({
    shelling: z.number().int().nonnegative(),
    snap: z.number().int().nonnegative(),
  }),
});
const backendCommandSchema = z.object({ idempotency_key: requestIdSchema });
const backendResultSchema = z.object({
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
  inputSchema: reportInputSchema,
  outputSchema: reportOutputSchema,
  backendInputSchema: backendCommandSchema,
  backendOutputSchema: backendResultSchema,
  isAvailable: () => {
    const database = context.database();
    if (!database) return false;
    try {
      database.prepare("SELECT 1").get();
      return true;
    } catch {
      return false;
    }
  },
  mapInput: ({ requestId }) => ({ idempotency_key: requestId }),
  adapter({ idempotency_key }, { signal }) {
    const database = context.database();
    if (!database) throw new Error("Report provider unavailable");
    signal.throwIfAborted();
    database.exec("BEGIN IMMEDIATE");
    try {
      const counts = database.prepare(`
        SELECT
          COUNT(*) AS total_plants,
          SUM(pea_type = 'shelling') AS shelling_count,
          SUM(pea_type = 'snap') AS snap_count
        FROM pea_plants
      `).get() as {
        total_plants: number;
        shelling_count: number;
        snap_count: number;
      };
      database.prepare(`
        INSERT INTO reports (
          idempotency_key, created_by_instance, total_plants,
          shelling_count, snap_count
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(idempotency_key) DO NOTHING
      `).run(
        idempotency_key,
        context.instanceName,
        counts.total_plants,
        counts.shelling_count,
        counts.snap_count,
      );
      const report = database.prepare(`
        SELECT
          report_id, idempotency_key, created_by_instance, total_plants,
          shelling_count, snap_count
        FROM reports
        WHERE idempotency_key = ?
      `).get(idempotency_key);
      database.exec("COMMIT");
      signal.throwIfAborted();
      return report as z.input<typeof backendResultSchema>;
    } catch (error) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // The original provider error is the useful failure.
      }
      throw error;
    }
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
    return {
      text: [
        `Report ${data.reportId} for request ${data.requestId} was originally created by ${data.createdByInstance}.`,
        `${data.totalPlants} pea plants: ${data.peaTypeCounts.shelling} shelling and ${data.peaTypeCounts.snap} snap.`,
        "Any server instance that reuses this request ID receives this same stored report; it does not create another.",
      ].join("\n"),
      data,
    };
  },
})) satisfies CapabilityModuleFactory<MultiInstanceContext>;
