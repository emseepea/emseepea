import { serveEmseepea } from "@emseepea/server";
import { createMongoExample } from "./app.js";

const uri = process.env.MONGODB_URL ?? "mongodb://127.0.0.1:27017";
const { app } = await createMongoExample({ uri });
const running = await serveEmseepea(app, {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});

console.log(`Em See Pea MongoDB-backed example listening at ${running.url}`);

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
