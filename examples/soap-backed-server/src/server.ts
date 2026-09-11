import { loadDeploymentProfile, serveEmseepea } from "@emseepea/server";
import { createSoapExample } from "./app.js";

const endpoint = process.env.PEA_SOAP_URL ?? "http://127.0.0.1:3999/soap";
const { app } = await createSoapExample(endpoint, { deployment: loadDeploymentProfile() });
const running = await serveEmseepea(app, {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});

console.log(`Em See Pea SOAP-backed example listening at ${running.url}`);

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
