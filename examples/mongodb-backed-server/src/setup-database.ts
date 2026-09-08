import { MongoServerError } from "mongodb";
import {
  observationCollectionName,
  varietyCollectionName,
  createDatabase,
} from "./database.js";
import { parsePeaObservationDocument } from "./pea-observation-document.js";
import { peaDocumentSchema, type PeaDocument } from "./pea-document.js";

const uri = process.env.MONGODB_URL ?? "mongodb://127.0.0.1:27017";
const { client, database, observations, varieties } = createDatabase(uri);

try {
  await client.connect();
  const validator = { $jsonSchema: peaDocumentSchema };
  try {
    await database.createCollection(varietyCollectionName, { validator });
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.codeName !== "NamespaceExists") throw error;
    await database.command({ collMod: varietyCollectionName, validator });
  }
  try {
    await database.createCollection(observationCollectionName);
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.codeName !== "NamespaceExists") throw error;
    const [collection] = await database.listCollections(
      { name: observationCollectionName },
      { nameOnly: false },
    ).toArray();
    if (!collection) throw new Error(`${observationCollectionName} was not found`);
    if (collection.options?.validator !== undefined) {
      throw new Error(`${observationCollectionName} must not have a MongoDB validator`);
    }
  }
  const seeds: PeaDocument[] = [
    {
      _id: "green-arrow",
      name: "Green Arrow",
      pea_type: "shelling",
      growth_habit: "climbing",
      days_to_maturity: 68,
      notes: "Long pods with sweet peas.",
    },
    {
      _id: "sugar-ann",
      name: "Sugar Ann",
      pea_type: "snap",
      growth_habit: "bush",
      days_to_maturity: 56,
      notes: "Compact plants with edible pods.",
    },
  ];
  for (const seed of seeds) {
    await varieties.replaceOne({ _id: seed._id }, seed, { upsert: true });
  }
  await observations.replaceOne(
    { _id: "sugar-ann-flowering" },
    parsePeaObservationDocument({
      _id: "sugar-ann-flowering",
      variety_name: "Sugar Ann",
      observed_on: "2026-08-30",
      location: "North bed",
      growth_stage: "flowering",
      notes: "First flowers opened.",
    }),
    { upsert: true },
  );
} finally {
  await client.close();
}
