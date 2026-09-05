import { createEmseepea, discoverCapabilities, serveEmseepea } from "@emseepea/server";

const handler = createEmseepea({
  name: "emseepea-tool-server",
  version: "0.0.0",
  instructions: "Use get-pea-variety for information about a sample pea variety.",
  ...await discoverCapabilities(new URL("./capabilities/", import.meta.url)),
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
