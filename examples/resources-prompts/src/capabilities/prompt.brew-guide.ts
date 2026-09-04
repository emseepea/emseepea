import { definePrompt, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";

const topics = ["brew-ratio", "grind-size", "water-temperature"];

export default (() => definePrompt({
  name: "brew-guide",
  title: "Brew guide",
  description: "Create a prompt for a sample brewing topic.",
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
        text: `Explain ${topic} for a home brewer. Distinguish any commonly confused concepts.`,
      },
    }],
  }),
})) satisfies CapabilityModuleFactory;
