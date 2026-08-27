import { defineTool, createEmseepea, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const beanNames = ["Harbour Dawn", "Highland Bloom"] as const;
const beanDetailsSchema = z.object({
  name: z.enum(beanNames),
  origin: z.string(),
  variety: z.string(),
  process: z.string(),
  roast: z.enum(["light", "medium", "dark"]),
  tastingNotes: z.array(z.string()),
});
const beans: Record<(typeof beanNames)[number], z.input<typeof beanDetailsSchema>> = {
  "Harbour Dawn": {
    name: "Harbour Dawn",
    origin: "Synthetic Coast",
    variety: "Caturra",
    process: "washed",
    roast: "light",
    tastingNotes: ["citrus", "honey"],
  },
  "Highland Bloom": {
    name: "Highland Bloom",
    origin: "Synthetic Highlands",
    variety: "Bourbon",
    process: "natural",
    roast: "medium",
    tastingNotes: ["berry", "cocoa"],
  },
};

const getBeanDetails = defineTool({
  name: "get-bean-details",
  access: "public",
  title: "Coffee Bean Details",
  description: "Get origin, processing, roast, and tasting details for a synthetic coffee bean.",
  inputSchema: z.object({
    name: z.enum(beanNames),
  }),
  outputSchema: beanDetailsSchema,
  handler: ({ name }) => {
    const data = beans[name];
    return {
      text: `${data.name} is a ${data.roast} ${data.process} ${data.variety} from ` +
        `${data.origin}, with notes of ${data.tastingNotes.join(" and ")}.`,
      data,
    };
  },
});

const handler = createEmseepea({
  name: "emseepea-basic-no-ui",
  version: "0.0.0",
  instructions: "Use get-bean-details for information about a synthetic coffee bean.",
  tools: [getBeanDetails],
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
