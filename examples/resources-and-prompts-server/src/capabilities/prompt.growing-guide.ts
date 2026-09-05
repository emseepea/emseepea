import { definePrompt, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";

const topics = ["sowing-depth", "plant-spacing", "trellis-support"];

export default (() => definePrompt({
  name: "growing-guide",
  title: "Pea growing guide",
  description: "Create a prompt for a sample pea-growing topic.",
  argsSchema: z.object({ topic: z.string().min(1) }),
  complete: {
    topic: (value) => topics.filter((topic) => topic.startsWith(value)),
  },
  handler: ({ topic }) => ({
    description: `Guide for ${topic}`,
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Explain ${topic} for a home gardener. Distinguish any commonly confused concepts.`,
      },
    }],
  }),
})) satisfies CapabilityModuleFactory;
