import { loadDeploymentProfile, serveEmseepea } from "@emseepea/server";
import { createHtmlUiServer } from "./app.js";

const running = await serveEmseepea(await createHtmlUiServer({ deployment: loadDeploymentProfile() }), {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});
console.log(`Em See Pea native UI example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
