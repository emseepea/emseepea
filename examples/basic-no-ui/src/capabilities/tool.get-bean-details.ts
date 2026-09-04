import { defineTool, type CapabilityModuleFactory } from "@emseepea/server";
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
    origin: "Sample Coast",
    variety: "Caturra",
    process: "washed",
    roast: "light",
    tastingNotes: ["citrus", "honey"],
  },
  "Highland Bloom": {
    name: "Highland Bloom",
    origin: "Sample Highlands",
    variety: "Bourbon",
    process: "natural",
    roast: "medium",
    tastingNotes: ["berry", "cocoa"],
  },
};

export default (() => defineTool({
  name: "get-bean-details",
  access: "public",
  title: "Coffee Bean Details",
  description: "Get origin, processing, roast, and tasting details for a sample coffee bean.",
  inputSchema: z.object({ name: z.enum(beanNames) }),
  outputSchema: beanDetailsSchema,
  handler: ({ name }) => {
    const data = beans[name];
    return {
      text: `${data.name} is a ${data.roast} ${data.process} ${data.variety} from ` +
        `${data.origin}, with notes of ${data.tastingNotes.join(" and ")}.`,
      data,
    };
  },
})) satisfies CapabilityModuleFactory;
