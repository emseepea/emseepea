import { loadDeploymentProfile, serveEmseepea } from "@emseepea/server";
import { createMultiInstanceExample } from "./app.js";

const instanceName = process.env.EMSEEPEA_INSTANCE ?? `instance-${process.pid}`;
const databaseUrl = process.env.DATABASE_URL ?? "postgres://emseepea:emseepea@127.0.0.1:5432/emseepea";
const { app, closeProvider } = await createMultiInstanceExample({ databaseUrl, deployment: loadDeploymentProfile() });
const running = await serveEmseepea(app, {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});

console.log(`Em See Pea multi-instance-postgres-server example ${instanceName} listening at ${running.url}`);
process.send?.({ type: "ready", instanceName, url: running.url.href });
process.on("message", (message) => {
  if (message === "close-provider") {
    void closeProvider().then(() => process.send?.({ type: "provider-closed", instanceName }));
  }
});

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await running.close();
  if (process.connected) process.disconnect();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
