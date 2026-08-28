import { join } from "node:path";
import { tmpdir } from "node:os";
import { serveEmseepea } from "@emseepea/server";
import { createMultiInstanceExample } from "./app.js";

const instanceName = process.env.EMSEEPEA_INSTANCE ?? `instance-${process.pid}`;
const databasePath = process.env.EMSEEPEA_DATABASE ??
  join(tmpdir(), `emseepea-multi-instance-${process.pid}.sqlite`);
const { app, closeProvider } = createMultiInstanceExample({ databasePath, instanceName });
const running = await serveEmseepea(app, {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});

console.log(`Em See Pea multi-instance example ${instanceName} listening at ${running.url}`);
process.send?.({ type: "ready", instanceName, url: running.url.href });
process.on("message", (message) => {
  if (message === "close-provider") {
    closeProvider();
    process.send?.({ type: "provider-closed", instanceName });
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
