import { defineTool, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";

const varietyNames = ["Harbour Gem", "Highland Snap"] as const;
const peaVarietySchema = z.object({
  name: z.enum(varietyNames),
  peaType: z.enum(["shelling", "snap"]),
  growthHabit: z.enum(["bush", "climbing"]),
  daysToMaturity: z.number().int().positive(),
  traits: z.array(z.string()),
});
const varieties: Record<(typeof varietyNames)[number], z.input<typeof peaVarietySchema>> = {
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
  inputSchema: z.object({ name: z.enum(varietyNames) }),
  outputSchema: peaVarietySchema,
  handler: ({ name }) => {
    const data = varieties[name];
    return {
      text: `${data.name} is a ${data.peaType} pea with a ${data.growthHabit} habit. ` +
        `It matures in ${data.daysToMaturity} days and is known for ${data.traits.join(" and ")}.`,
      data,
    };
  },
})) satisfies CapabilityModuleFactory;
