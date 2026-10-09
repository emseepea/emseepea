import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const records = {
  north: { route: "north", departure: "08:10" },
  east: { route: "east", departure: "09:20" },
  south: { route: "south", departure: "10:30" },
  west: { route: "west", departure: "11:40" },
};
const app = createEmseepea({
  name: "synthetic-timetable", version: "0.0.0",
  tools: [defineTool({
    name: "read-departure", access: "public",
    description: "Read the authoritative departure time for one route.",
    inputSchema: z.object({ route: z.enum(["north", "east", "south", "west"]) }),
    outputSchema: z.object({ route: z.string(), departure: z.string() }),
    handler: ({ route }) => ({ data: records[route] }),
  })],
});
const running = await serveEmseepea(app, { port: Number(process.env.PORT ?? 3000) });
console.log(`Synthetic timetable listening at ${running.url}`);
process.once("SIGINT", () => void running.close());
process.once("SIGTERM", () => void running.close());
