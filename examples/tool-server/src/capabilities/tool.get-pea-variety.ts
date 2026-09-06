import { defineTool, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";

const varietyNames = ["Harbour Gem", "Highland Snap"] as const;
const inputSchema = z.object({
  name: z.enum(varietyNames).describe("Sample pea variety to look up."),
});
const outputSchema = z.object({
  name: z.enum(varietyNames).describe("Name of the pea variety."),
  peaType: z.enum(["shelling", "snap"]).describe("Whether the variety is grown for shelled peas or edible pods."),
  growthHabit: z.enum(["bush", "climbing"]).describe("Whether the plant grows as a compact bush or a climbing vine."),
  daysToMaturity: z.number().int().positive().describe("Approximate days from sowing until the first harvest."),
  traits: z.array(z.string()).describe("Notable growing or eating qualities of the variety."),
});
const varieties: Record<(typeof varietyNames)[number], z.input<typeof outputSchema>> = {
  "Harbour Gem": {
    name: "Harbour Gem",
    peaType: "shelling",
    growthHabit: "bush",
    daysToMaturity: 62,
    traits: ["compact", "sweet peas"],
  },
  "Highland Snap": {
    name: "Highland Snap",
    peaType: "snap",
    growthHabit: "climbing",
    daysToMaturity: 70,
    traits: ["edible pods", "needs support"],
  },
};

export default (() => defineTool({
  name: "get-pea-variety",
  access: "public",
  title: "Pea Variety Details",
  description: "Get the type, growth habit, maturity time, and traits of a sample pea variety.",
  inputSchema,
  outputSchema,
  handler: ({ name }) => {
    const data = varieties[name];
    return {
      text: `${data.name} is a ${data.peaType} pea with a ${data.growthHabit} habit. ` +
        `It matures in ${data.daysToMaturity} days and is known for ${data.traits.join(" and ")}.`,
      data,
    };
  },
})) satisfies CapabilityModuleFactory;
