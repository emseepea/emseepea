import { createEmseepea, discoverCapabilities } from "@emseepea/server";
import { Pool } from "pg";
import { z } from "zod";

export interface MultiInstanceExampleOptions {
  readonly databaseUrl: string;
  readonly instanceName: string;
}

export async function createMultiInstanceExample(options: MultiInstanceExampleOptions) {
  const instanceName = z.string().min(1).max(64).parse(options.instanceName);
  const databaseUrl = z.string().url().refine(
    (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    "databaseUrl must use PostgreSQL",
  ).parse(options.databaseUrl);
  let database: Pool | undefined = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 10_000,
    max: 4,
    query_timeout: 2_000,
    statement_timeout: 1_500,
  });
  database.on("error", () => {
    // Readiness and tool calls report provider failure without stopping unrelated features.
  });

  const app = createEmseepea({
    name: "emseepea-multi-instance-postgres-server",
    version: "0.0.0",
    instructions: "Use create-shared-harvest-report for a stored pea harvest report. Reusing a request ID returns the original report.",
    readiness: async ({ signal }) => {
      if (!database) return false;
      try {
        signal.throwIfAborted();
        await database.query("SELECT 1 FROM reports LIMIT 1");
        signal.throwIfAborted();
        return true;
      } catch {
        return false;
      }
    },
    readinessTimeoutMs: 2_500,
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), {
      database: () => database,
      instanceName,
    }),
  });
  const closeProvider = async () => {
    const activeDatabase = database;
    database = undefined;
    await activeDatabase?.end();
  };
  app.addHook("onClose", closeProvider);
  return { app, closeProvider };
}
