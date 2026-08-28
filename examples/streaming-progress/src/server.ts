import { setTimeout as delay } from "node:timers/promises";
import { createEmseepea, defineStreamingTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const roastBatch = defineStreamingTool({
  name: "roast-sample-batch",
  access: "public",
  description: "Run a sample coffee-roasting batch with bounded progress.",
  inputSchema: z.object({ batch: z.literal("sample-batch") }),
  outputSchema: z.object({
    batch: z.literal("sample-batch"),
    status: z.literal("complete"),
    roastedGrams: z.literal(820),
    stages: z.tuple([z.literal("charge"), z.literal("first crack"), z.literal("cool")]),
  }),
  async handler({ batch }, { reportProgress, signal }) {
    const stages: ["charge", "first crack", "cool"] = ["charge", "first crack", "cool"];
    for (const [index, stage] of stages.entries()) {
      await reportProgress({ progress: index + 1, total: stages.length, message: stage });
      await delay(150, undefined, { signal });
    }
    const data = { batch, status: "complete" as const, roastedGrams: 820 as const, stages };
    return { text: `${batch} completed at 820 roasted grams`, data };
  },
});

const running = await serveEmseepea(createEmseepea({
  name: "emseepea-streaming-progress",
  version: "0.0.0",
  instructions: "Use roast-sample-batch for the sample roast run.",
  tools: [roastBatch],
}), { port: Number.parseInt(process.env.PORT ?? "3000", 10) });

console.log(`Em See Pea streaming-progress example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
