import { randomUUID } from "node:crypto";
import { defineTool, type CapabilityModuleFactory } from "@emseepea/server";
import type { MongoContext } from "../database.js";
import { parsePeaObservationDocument } from "../pea-observation-document.js";
import { observationSchema } from "../pea-observation.js";

const inputSchema = observationSchema;
const outputSchema = observationSchema;

export default ((context) => defineTool({
  name: "record-pea-observation",
  access: "public",
  description: "Record one dated observation of a pea plant.",
  inputSchema,
  outputSchema,
  async handler(observation, { signal }) {
    const collection = context.observations();
    if (!collection) throw new Error("Observation provider unavailable");
    signal.throwIfAborted();
    const document = parsePeaObservationDocument({ _id: randomUUID(), ...observation });
    await collection.insertOne(document, { maxTimeMS: 1_500 });
    signal.throwIfAborted();
    return { data: observation };
  },
})) satisfies CapabilityModuleFactory<MongoContext>;
