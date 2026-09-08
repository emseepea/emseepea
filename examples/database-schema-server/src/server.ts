import { serveEmseepea } from "@emseepea/server";
import { createDatabaseSchemaExample } from "./app.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://emseepea:emseepea@127.0.0.1:5432/emseepea";
const { app } = await createDatabaseSchemaExample({ databaseUrl });
const running = await serveEmseepea(app, {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});

console.log(`Em See Pea database-schema-server example listening at ${running.url}`);

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
