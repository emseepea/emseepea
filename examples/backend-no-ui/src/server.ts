import { readFile } from "node:fs/promises";
import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const beanSchema = z.object({
  id: z.string(),
  origin: z.string(),
  roast: z.enum(["light", "medium", "dark"]),
});
const beanLookupInput = z.object({ id: z.string().min(1).max(32) });
const beanResult = (data: z.output<typeof beanSchema>) => ({
  text: `${data.id}: ${data.origin}, ${data.roast} roast`,
  data,
});

const memory = new Map([["map-bean", {
  id: "map-bean",
  origin: "Synthetic Highlands",
  roast: "medium" as const,
}]]);
const lookupMemoryBean = defineTool({
  name: "lookup-memory-bean",
  access: "public",
  description: "Look up a synthetic in-memory bean.",
  inputSchema: beanLookupInput,
  outputSchema: beanSchema,
  handler: ({ id }) => beanResult(
    memory.get(id) ?? { id, origin: "Synthetic Unknown", roast: "dark" as const },
  ),
});

const fileUrl = new URL("../data/beans.json", import.meta.url);
const lookupFileBean = defineTool({
  name: "lookup-file-bean",
  access: "public",
  description: "Look up a synthetic file-backed bean.",
  inputSchema: beanLookupInput,
  outputSchema: beanSchema,
  async handler({ id }, { signal }) {
    const records = JSON.parse(await readFile(fileUrl, { encoding: "utf8", signal })) as unknown;
    return beanResult(
      z.record(z.string(), beanSchema).parse(records)[id] ?? {
        id,
        origin: "Synthetic Unknown",
        roast: "dark" as const,
      },
    );
  },
});

const running = await serveEmseepea(createEmseepea({
  name: "emseepea-backend-no-ui",
  version: "0.0.0",
  instructions: "Use a lookup tool for synthetic coffee records.",
  tools: [lookupMemoryBean, lookupFileBean],
}), { port: Number.parseInt(process.env.PORT ?? "3000", 10) });

console.log(`Em See Pea backend no-UI example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
