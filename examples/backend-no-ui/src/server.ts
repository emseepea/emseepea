import { readFile } from "node:fs/promises";
import { createEmseepea, defineMappedTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const roastSchema = z.enum(["light", "medium", "dark"]);
const reportInputSchema = z.object({
  roast: roastSchema.optional(),
});
const reportBeanSchema = z.object({
  name: z.string(),
  origin: z.string(),
  variety: z.string(),
  roast: roastSchema,
  tastingNotes: z.array(z.string()),
});
const reportSchema = z.object({
  title: z.string(),
  beanCount: z.number().int().nonnegative(),
  beans: z.array(reportBeanSchema),
});

const roastCodeSchema = z.enum(["L", "M", "D"]);
const backendCommandSchema = z.object({
  roast_codes: z.array(roastCodeSchema).max(1),
});
const backendBeanSchema = z.object({
  bean_name: z.string(),
  growing_region: z.string(),
  variety_name: z.string(),
  roast_code: roastCodeSchema,
  tasting_notes: z.array(z.string()),
});
const backendResultSchema = z.object({
  selection: z.union([roastCodeSchema, z.literal("ALL")]),
  rows: z.array(backendBeanSchema),
});

const publicToBackendRoast = { light: "L", medium: "M", dark: "D" } as const;
const backendToPublicRoast = { L: "light", M: "medium", D: "dark" } as const;
const fileUrl = new URL("../data/beans.json", import.meta.url);
const createBeanReport = defineMappedTool({
  name: "create-bean-report",
  access: "public",
  description: "Create a read-only report about synthetic coffee beans, optionally filtered by roast.",
  inputSchema: reportInputSchema,
  outputSchema: reportSchema,
  backendInputSchema: backendCommandSchema,
  backendOutputSchema: backendResultSchema,
  mapInput: ({ roast }) => ({
    roast_codes: roast ? [publicToBackendRoast[roast]] : [],
  }),
  async adapter({ roast_codes }, { signal }) {
    const source = JSON.parse(await readFile(fileUrl, { encoding: "utf8", signal })) as unknown;
    const records = z.array(backendBeanSchema).parse(source);
    const selection: z.output<typeof backendResultSchema>["selection"] = roast_codes[0] ?? "ALL";
    return {
      selection,
      rows: selection === "ALL"
        ? records
        : records.filter(({ roast_code }) => roast_code === selection),
    };
  },
  mapOutput: ({ selection, rows }) => {
    const beans = rows.map((row) => ({
      name: row.bean_name,
      origin: row.growing_region,
      variety: row.variety_name,
      roast: backendToPublicRoast[row.roast_code],
      tastingNotes: row.tasting_notes,
    }));
    const title = selection === "ALL"
      ? "All synthetic coffee beans"
      : `${backendToPublicRoast[selection]} roast synthetic coffee beans`;
    const data = { title, beanCount: beans.length, beans };
    const lines = beans.map(({ name, origin, roast }) => `- ${name}: ${roast}, ${origin}`);
    return {
      text: [title, `${beans.length} bean${beans.length === 1 ? "" : "s"}`, ...lines].join("\n"),
      data,
    };
  },
});

const running = await serveEmseepea(createEmseepea({
  name: "emseepea-backend-no-ui",
  version: "0.0.0",
  instructions: "Use create-bean-report for a read-only report on synthetic coffee beans.",
  tools: [createBeanReport],
}), { port: Number.parseInt(process.env.PORT ?? "3000", 10) });

console.log(`Em See Pea backend no-UI example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
