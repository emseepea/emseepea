import { createEmseepea, discoverCapabilities, serveEmseepea } from "@emseepea/server";

const running = await serveEmseepea(createEmseepea({
  name: "emseepea-progress-streaming-server",
  version: "0.0.0",
  instructions: "Use run-germination-trial for the sample pea germination trial.",
  ...await discoverCapabilities(new URL("./capabilities/", import.meta.url)),
}), { port: Number.parseInt(process.env.PORT ?? "3000", 10) });

console.log(`Em See Pea progress-streaming-server example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
