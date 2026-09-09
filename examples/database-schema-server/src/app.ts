import {
  createEmseepea,
  discoverCapabilities,
  type AccessPolicy,
  type EmseepeaExtensions,
} from "@emseepea/server";
import { Pool } from "pg";
import { z } from "zod";

export interface DatabaseSchemaExampleOptions extends EmseepeaExtensions {
  readonly databaseUrl: string;
  readonly access?: AccessPolicy;
}

export async function createDatabaseSchemaExample(options: DatabaseSchemaExampleOptions) {
  const { access = { access: "public" }, authentication, observability } = options;
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
    // Readiness and tool calls report provider failure without exposing details.
  });

  const app = createEmseepea({
    name: "emseepea-database-schema-server",
    version: "0.0.0",
    instructions: "Read, add, and summarize pea varieties in a database-backed catalogue.",
    readiness: async ({ signal }) => {
      if (!database) return false;
      try {
        signal.throwIfAborted();
        await database.query("SELECT 1 FROM pea_variety_catalog LIMIT 1");
        signal.throwIfAborted();
        return true;
      } catch {
        return false;
      }
    },
    readinessTimeoutMs: 2_500,
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), {
      database: () => database,
      access,
    }),
    authentication,
    observability,
  });
  const closeProvider = async () => {
    const activeDatabase = database;
    database = undefined;
    await activeDatabase?.end();
  };
  app.addHook("onClose", closeProvider);
  return { app, closeProvider };
}
