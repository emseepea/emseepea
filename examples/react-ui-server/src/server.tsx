import { serveEmseepea } from "@emseepea/server";
import { createReactUiServer } from "./app.js";

const running = await serveEmseepea(await createReactUiServer(), {
  port: Number.parseInt(process.env.PORT ?? "3001", 10),
});
console.log(`Em See Pea React UI example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
