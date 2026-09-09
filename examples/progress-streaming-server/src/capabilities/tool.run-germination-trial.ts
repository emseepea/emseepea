import { setTimeout as delay } from "node:timers/promises";
import {
  defineStreamingTool,
  type AccessPolicy,
  type CapabilityModuleFactory,
  type StreamingToolContext,
} from "@emseepea/server";
import { z } from "zod";

export default ((access) => defineStreamingTool({
  name: "run-germination-trial",
  ...access,
  description: "Run a sample pea germination trial with bounded progress.",
  inputSchema: z.object({
    tray: z.literal("sample-tray").describe("Sample germination tray to test."),
  }),
  outputSchema: z.object({
    tray: z.literal("sample-tray").describe("Germination tray that was tested."),
    status: z.literal("complete").describe("Final state of the germination trial."),
    germinatedSeeds: z.literal(8).describe("Number of seeds that germinated."),
    totalSeeds: z.literal(10).describe("Total number of seeds in the trial."),
    stages: z.tuple([z.literal("soak"), z.literal("sow"), z.literal("sprout")])
      .describe("Trial stages completed in order."),
  }),
  async handler({ tray }, { reportProgress, signal }: StreamingToolContext) {
    const stages: ["soak", "sow", "sprout"] = ["soak", "sow", "sprout"];
    for (const [index, stage] of stages.entries()) {
      await reportProgress({ progress: index + 1, total: stages.length, message: stage });
      await delay(150, undefined, { signal });
    }
    const data = { tray, status: "complete" as const, germinatedSeeds: 8 as const, totalSeeds: 10 as const, stages };
    return { data };
  },
})) satisfies CapabilityModuleFactory<AccessPolicy>;
