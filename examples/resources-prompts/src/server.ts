import {
  createEmseepea,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";

const guideUri = "guide://coffee/getting-started";
const methods = ["aeropress", "espresso", "pour-over"];
const topics = ["brew-ratio", "grind-size", "water-temperature"];

const guide = defineResource({
  name: "getting-started",
  uri: guideUri,
  title: "Coffee getting started",
  description: "A sample guide exposed as an MCP resource.",
  mimeType: "text/markdown",
  handler: () => ({
    contents: [{
      uri: guideUri,
      mimeType: "text/markdown",
      text: "# Brew clearly\n\nStrength is concentration; extraction is how much material left the grounds. They are related, but not interchangeable.\n",
    }],
  }),
});

const methodGuide = defineResourceTemplate({
  name: "method-guide",
  uriTemplate: "guide://coffee/method/{method}",
  title: "Coffee method guide",
  description: "A sample guide selected by brewing method.",
  mimeType: "text/markdown",
  complete: {
    method: (value) => methods.filter((method) => method.startsWith(value)),
  },
  handler: ({ uri, variables }) => ({
    contents: [{
      uri,
      mimeType: "text/markdown",
      text: `# ${String(variables.method)}\n`,
    }],
  }),
});

const brew = definePrompt({
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
});

const running = await serveEmseepea(createEmseepea({
  name: "emseepea-resources-prompts",
  version: "0.0.0",
  resources: [guide, methodGuide],
  prompts: [brew],
}), { port: Number.parseInt(process.env.PORT ?? "3000", 10) });

console.log(`Em See Pea resources and prompts example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
