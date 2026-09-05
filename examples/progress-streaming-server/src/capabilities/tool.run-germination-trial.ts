import { setTimeout as delay } from "node:timers/promises";
import { defineStreamingTool, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";

export default (() => defineStreamingTool({
  name: "run-germination-trial",
  access: "public",
  description: "Run a sample pea germination trial with bounded progress.",
  inputSchema: z.object({ tray: z.literal("sample-tray") }),
  outputSchema: z.object({
    tray: z.literal("sample-tray"),
    status: z.literal("complete"),
    germinatedSeeds: z.literal(8),
    totalSeeds: z.literal(10),
    stages: z.tuple([z.literal("soak"), z.literal("sow"), z.literal("sprout")]),
  }),
  async handler({ tray }, { reportProgress, signal }) {
    const stages: ["soak", "sow", "sprout"] = ["soak", "sow", "sprout"];
    for (const [index, stage] of stages.entries()) {
      await reportProgress({ progress: index + 1, total: stages.length, message: stage });
      await delay(150, undefined, { signal });
    }
    const data = { tray, status: "complete" as const, germinatedSeeds: 8 as const, totalSeeds: 10 as const, stages };
    return { text: `${tray} completed with 8 of 10 pea seeds germinated`, data };
  },
})) satisfies CapabilityModuleFactory;
