import {
  createEmseepea,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";

const guideUri = "guide://coffee/getting-started";

const guide = defineResource({
  name: "getting-started",
  uri: guideUri,
  title: "Coffee getting started",
  description: "A synthetic guide exposed as an MCP resource.",
  mimeType: "text/markdown",
  handler: () => ({
    contents: [{ uri: guideUri, mimeType: "text/markdown", text: "# Brew safely\n" }],
  }),
});

const methodGuide = defineResourceTemplate({
  name: "method-guide",
  uriTemplate: "guide://coffee/method/{method}",
  title: "Coffee method guide",
  description: "A synthetic guide selected by brewing method.",
  mimeType: "text/markdown",
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
  description: "Create a prompt for a synthetic brewing topic.",
  argsSchema: z.object({ topic: z.string().min(1) }),
  handler: ({ topic }) => ({
    description: `Guide for ${topic}`,
    messages: [{ role: "user", content: { type: "text", text: `Explain ${topic}.` } }],
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
