import { serveEmseepea } from "@emseepea/server";
import { createJsonHttpClient } from "@emseepea/server/http";
import { createBackendExample } from "./app.js";

const client = createJsonHttpClient({
  origin: "https://brewmark.io",
  maxResponseBytes: 128 * 1024,
});
const running = await serveEmseepea(
  await createBackendExample(client),
  { port: Number.parseInt(process.env.PORT ?? "3000", 10) },
);

console.log(`Em See Pea backend no-UI example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
