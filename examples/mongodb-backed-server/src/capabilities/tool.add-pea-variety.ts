import { randomUUID } from "node:crypto";
import { defineTool, type CapabilityModuleFactory } from "@emseepea/server";
import { parsePeaDocument } from "../pea-document.js";
import { varietySchema } from "../pea-variety.js";
import type { MongoContext } from "../database.js";

const inputSchema = varietySchema;
const outputSchema = varietySchema;

export default ((context) => defineTool({
  name: "add-pea-variety",
  access: "public",
  description: "Add one pea variety to the catalogue.",
  inputSchema,
  outputSchema,
  async handler(variety, { signal }) {
    const collection = context.varieties();
    if (!collection) throw new Error("Variety provider unavailable");
    signal.throwIfAborted();
    const document = parsePeaDocument({ _id: randomUUID(), ...variety });
    await collection.insertOne(document, { maxTimeMS: 1_500 });
    signal.throwIfAborted();
    return { data: variety };
  },
})) satisfies CapabilityModuleFactory<MongoContext>;
