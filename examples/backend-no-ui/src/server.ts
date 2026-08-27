import { readFile } from "node:fs/promises";
import { createEmseepea, defineMappedTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const bean = z.object({
  id: z.string(),
  origin: z.string(),
  roast: z.enum(["light", "medium", "dark"]),
});
const inputSchema = z.object({ id: z.string().min(1).max(32) });
const outputSchema = bean;
const mapCommand = ({ id }: { id: string }) => ({ id });
const mapResult = (data: z.output<typeof bean>) => ({
  text: `${data.id}: ${data.origin}, ${data.roast} roast`,
  data,
});

const memory = new Map([["map-bean", {
  id: "map-bean",
  origin: "Synthetic Highlands",
  roast: "medium" as const,
}]]);
const lookupMemoryBean = defineMappedTool({
  name: "lookup-memory-bean",
  access: "public",
  description: "Look up a synthetic in-memory bean.",
  inputSchema,
  outputSchema,
  backendInputSchema: inputSchema,
  backendOutputSchema: bean,
  mapInput: mapCommand,
  adapter: ({ id }) => memory.get(id) ?? { id, origin: "Synthetic Unknown", roast: "dark" as const },
  mapOutput: mapResult,
});

const fileUrl = new URL("../data/beans.json", import.meta.url);
const lookupFileBean = defineMappedTool({
  name: "lookup-file-bean",
  access: "public",
  description: "Look up a synthetic file-backed bean.",
  inputSchema,
  outputSchema,
  backendInputSchema: inputSchema,
  backendOutputSchema: bean,
  mapInput: mapCommand,
  async adapter({ id }, { signal }) {
    const records = JSON.parse(await readFile(fileUrl, { encoding: "utf8", signal })) as unknown;
    return z.record(z.string(), bean).parse(records)[id] ?? {
      id,
      origin: "Synthetic Unknown",
      roast: "dark" as const,
    };
  },
  mapOutput: mapResult,
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
