import { defineMappedTool, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";
import type { MultiInstanceContext } from "./context.js";

const requestIdSchema = z.string().min(3).max(64).regex(/^[a-z0-9][a-z0-9-]*$/);
const reportInputSchema = z.object({ requestId: requestIdSchema });
const reportOutputSchema = z.object({
  reportId: z.number().int().positive(),
  requestId: requestIdSchema,
  createdByInstance: z.string().min(1).max(64),
  totalBeans: z.number().int().nonnegative(),
  roastCounts: z.object({
    light: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    dark: z.number().int().nonnegative(),
  }),
});
const backendCommandSchema = z.object({ idempotency_key: requestIdSchema });
const backendResultSchema = z.object({
  report_id: z.number().int().positive(),
  idempotency_key: requestIdSchema,
  created_by_instance: z.string().min(1).max(64),
  total_beans: z.number().int().nonnegative(),
  light_count: z.number().int().nonnegative(),
  medium_count: z.number().int().nonnegative(),
  dark_count: z.number().int().nonnegative(),
});

export default ((context) => defineMappedTool({
  name: "create-shared-bean-report",
  access: "public",
  description: "Create or return one stored bean report per request ID. The result identifies its original server instance.",
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
          COUNT(*) AS total_beans,
          SUM(roast = 'light') AS light_count,
          SUM(roast = 'medium') AS medium_count,
          SUM(roast = 'dark') AS dark_count
        FROM beans
      `).get() as {
        total_beans: number;
        light_count: number;
        medium_count: number;
        dark_count: number;
      };
      database.prepare(`
        INSERT INTO reports (
          idempotency_key, created_by_instance, total_beans,
          light_count, medium_count, dark_count
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(idempotency_key) DO NOTHING
      `).run(
        idempotency_key,
        context.instanceName,
        counts.total_beans,
        counts.light_count,
        counts.medium_count,
        counts.dark_count,
      );
      const report = database.prepare(`
        SELECT
          report_id, idempotency_key, created_by_instance, total_beans,
          light_count, medium_count, dark_count
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
      totalBeans: report.total_beans,
      roastCounts: {
        light: report.light_count,
        medium: report.medium_count,
        dark: report.dark_count,
      },
    };
    return {
      text: [
        `Report ${data.reportId} for request ${data.requestId} was originally created by ${data.createdByInstance}.`,
        `${data.totalBeans} beans: ${data.roastCounts.light} light, ${data.roastCounts.medium} medium, ${data.roastCounts.dark} dark.`,
        "Any server instance that reuses this request ID receives this same stored report; it does not create another.",
      ].join("\n"),
      data,
    };
  },
})) satisfies CapabilityModuleFactory<MultiInstanceContext>;
