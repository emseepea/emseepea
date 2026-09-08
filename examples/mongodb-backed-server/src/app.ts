import { createEmseepea, discoverCapabilities } from "@emseepea/server";
import type { Collection, Db } from "mongodb";
import { z } from "zod";
import { createDatabase } from "./database.js";
import type { PeaObservationDocument } from "./pea-observation-document.js";
import type { PeaDocument } from "./pea-document.js";

export interface MongoExampleOptions { readonly uri: string }

export async function createMongoExample({ uri }: MongoExampleOptions) {
  const parsedUri = z.string().url().refine(
    (value) => ["mongodb:", "mongodb+srv:"].includes(new URL(value).protocol),
    "uri must use MongoDB",
  ).parse(uri);
  const connected = createDatabase(parsedUri);
  let database: Db | undefined = connected.database;
  let varieties: Collection<PeaDocument> | undefined = connected.varieties;
  let observations: Collection<PeaObservationDocument> | undefined = connected.observations;
  const app = createEmseepea({
    name: "emseepea-mongodb-backed-server",
    version: "0.0.0",
    instructions: "Read and add pea varieties, and record and review pea observations.",
    readiness: async ({ signal }) => {
      if (!database) return false;
      try {
        signal.throwIfAborted();
        await database.command({ ping: 1 }, { timeoutMS: 1_500 });
        signal.throwIfAborted();
        return true;
      } catch {
        return false;
      }
    },
    readinessTimeoutMs: 2_500,
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), {
      database: () => database,
      observations: () => observations,
      varieties: () => varieties,
    }),
  });
  const closeProvider = async () => {
    observations = undefined;
    varieties = undefined;
    database = undefined;
    await connected.client.close();
  };
  app.addHook("onClose", closeProvider);
  return { app, closeProvider };
}
