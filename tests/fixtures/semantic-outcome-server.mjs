import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { appendFileSync } from "node:fs";
import { z } from "zod";

const stateFile = process.env.SELECTION_STATE_FILE;
if (!stateFile) throw new Error("SELECTION_STATE_FILE is required");

const tools = [
  defineTool({
    name: "list-candidates",
    access: "public",
    description: "List candidates that may satisfy the request.",
    inputSchema: z.object({}),
    outputSchema: z.object({ ids: z.array(z.string()) }),
    handler: () => ({ data: { ids: ["candidate-1"] } }),
  }),
  defineTool({
    name: "lookup-candidate",
    access: "public",
    description: "Look up one candidate before selection.",
    inputSchema: z.object({ id: z.string().min(1) }),
    outputSchema: z.object({ id: z.string(), eligible: z.boolean() }),
    handler: ({ id }) => ({ data: { id, eligible: true } }),
  }),
  defineTool({
    name: "commit-selection",
    access: "public",
    description: "Persist the selected candidate.",
    inputSchema: z.object({ id: z.string().min(1) }),
    outputSchema: z.object({
      id: z.string(),
      persisted: z.literal(true),
      metadata: z.object({ source: z.literal("fixture") }),
    }),
    handler: ({ id }) => {
      appendFileSync(stateFile, `${JSON.stringify({ id })}\n`);
      return { data: { id, persisted: true, metadata: { source: "fixture" } } };
    },
  }),
];

const app = createEmseepea({ name: "semantic-outcome-fixture", version: "0.0.0", tools });
const running = await serveEmseepea(app, { port: Number.parseInt(process.env.PORT ?? "3000", 10) });

console.log(`Semantic outcome fixture listening at ${running.url}`);

async function shutdown() {
  await running.close();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
