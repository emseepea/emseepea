import {
  createEmseepea,
  discoverCapabilities,
  serveEmseepea,
} from "@emseepea/server";

const running = await serveEmseepea(createEmseepea({
  name: "emseepea-resources-prompts",
  version: "0.0.0",
  ...await discoverCapabilities(new URL("./capabilities/", import.meta.url)),
}), { port: Number.parseInt(process.env.PORT ?? "3000", 10) });

console.log(`Em See Pea resources and prompts example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
