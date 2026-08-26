import { defineTool, createEmseepea, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const lookupBean = defineTool({
  name: "lookup-bean",
  access: "public",
  title: "Coffee Bean Lookup",
  description: "Look up a synthetic coffee bean record by identifier.",
  inputSchema: z.object({
    id: z.string().min(1).max(32),
  }),
  outputSchema: z.object({
    id: z.string(),
    origin: z.string(),
    roast: z.enum(["light", "medium", "dark"]),
  }),
  handler: ({ id }) => {
    const data = { id, origin: "Synthetic Highlands", roast: "medium" as const };
    return {
      text: `${data.id}: ${data.origin}, ${data.roast} roast`,
      data,
    };
  },
});

const handler = createEmseepea({
  name: "emseepea-basic-no-ui",
  version: "0.0.0",
  instructions: "Use lookup-bean for synthetic coffee records.",
  tools: [lookupBean],
});

const running = await serveEmseepea(handler, {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});

console.log(`Em See Pea basic no-UI example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
