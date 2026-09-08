import { Ajv } from "ajv";
import type { FromSchema } from "json-schema-to-ts";

export const peaDocumentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["_id", "name", "pea_type", "growth_habit", "days_to_maturity", "notes"],
  properties: {
    _id: { type: "string", minLength: 1, maxLength: 100 },
    name: { type: "string", minLength: 1, maxLength: 100 },
    pea_type: { type: "string", minLength: 1, maxLength: 40 },
    growth_habit: { type: "string", minLength: 1, maxLength: 40 },
    days_to_maturity: { type: "number", multipleOf: 1, minimum: 1, maximum: 365 },
    notes: { type: "string", maxLength: 500 },
  },
} as const;

export type PeaDocument = FromSchema<typeof peaDocumentSchema>;

const validate = new Ajv({ strict: true }).compile<PeaDocument>(peaDocumentSchema);

export function parsePeaDocument(value: unknown): PeaDocument {
  if (!validate(value)) throw new Error("Invalid pea document");
  return value;
}
