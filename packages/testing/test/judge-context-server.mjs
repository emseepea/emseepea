import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const running = await serveEmseepea(createEmseepea({
  name: "judge-context-fixture",
  version: "0.0.0",
  ...(process.env.FIXTURE_INSTRUCTIONS ? { instructions: process.env.FIXTURE_INSTRUCTIONS } : {}),
  tools: [defineTool({
    name: "read-report",
    access: "public",
    description: process.env.FIXTURE_DESCRIPTION ?? "Read a synthetic report.",
    inputSchema: z.object({}),
    outputSchema: z.object({ available: z.boolean() }),
    handler: () => ({ data: { available: true } }),
  })],
}), { port: 0 });
console.log(running.url);
process.once("SIGTERM", () => void running.close());
