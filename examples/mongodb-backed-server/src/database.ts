import { MongoClient, type Collection, type Db } from "mongodb";
import type { PeaObservationDocument } from "./pea-observation-document.js";
import type { PeaDocument } from "./pea-document.js";

export const varietyCollectionName = "pea_varieties";
export const observationCollectionName = "pea_observations";
export const databaseName = "emseepea";

export function createDatabase(uri: string) {
  const client = new MongoClient(uri, {
    connectTimeoutMS: 2_000,
    maxPoolSize: 4,
    serverSelectionTimeoutMS: 2_000,
  });
  const selectedDatabaseName = decodeURIComponent(new URL(uri).pathname.slice(1)) || databaseName;
  const database = client.db(selectedDatabaseName);
  return {
    client,
    database,
    varieties: database.collection<PeaDocument>(varietyCollectionName),
    observations: database.collection<PeaObservationDocument>(observationCollectionName),
  };
}

export interface MongoContext {
  readonly varieties: () => Collection<PeaDocument> | undefined;
  readonly observations: () => Collection<PeaObservationDocument> | undefined;
  readonly database: () => Db | undefined;
}
