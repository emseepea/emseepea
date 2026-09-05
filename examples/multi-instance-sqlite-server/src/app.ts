import { DatabaseSync } from "node:sqlite";
import { createEmseepea, discoverCapabilities } from "@emseepea/server";
import { z } from "zod";

export interface MultiInstanceExampleOptions {
  readonly databasePath: string;
  readonly instanceName: string;
}

export async function createMultiInstanceExample(options: MultiInstanceExampleOptions) {
  const instanceName = z.string().min(1).max(64).parse(options.instanceName);
  let database: DatabaseSync | undefined;
  let candidate: DatabaseSync | undefined;
  try {
    candidate = new DatabaseSync(options.databasePath);
    candidate.exec(`
      PRAGMA busy_timeout = 2000;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS pea_plants (
        name TEXT PRIMARY KEY,
        pea_type TEXT NOT NULL CHECK (pea_type IN ('shelling', 'snap'))
      ) STRICT;
      INSERT OR IGNORE INTO pea_plants (name, pea_type) VALUES
        ('Harbour Gem', 'shelling'),
        ('Highland Snap', 'snap'),
        ('Meadow Sweet', 'snap'),
        ('Garden Pearl', 'shelling');
      CREATE TABLE IF NOT EXISTS reports (
        report_id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT NOT NULL UNIQUE,
        created_by_instance TEXT NOT NULL,
        total_plants INTEGER NOT NULL,
        shelling_count INTEGER NOT NULL,
        snap_count INTEGER NOT NULL
      ) STRICT;
    `);
    database = candidate;
  } catch {
    try {
      candidate?.close();
    } catch {
      // Independent server features must still start when provider cleanup fails.
    }
  }

  const app = createEmseepea({
    name: "emseepea-multi-instance-sqlite-server",
    version: "0.0.0",
    instructions: "Use create-shared-harvest-report for a stored pea harvest report. Reusing a request ID returns the original report.",
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), {
      database: () => database,
      instanceName,
    }),
  });
  const closeProvider = () => {
    const activeDatabase = database;
    database = undefined;
    activeDatabase?.close();
  };
  app.addHook("onClose", async () => closeProvider());
  return { app, closeProvider };
}
