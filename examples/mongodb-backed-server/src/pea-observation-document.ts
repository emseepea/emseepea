import { Ajv } from "ajv";
import type { FromSchema } from "json-schema-to-ts";

export const peaObservationDocumentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["_id", "variety_name", "observed_on", "location", "growth_stage", "notes"],
  properties: {
    _id: { type: "string", minLength: 1, maxLength: 100 },
    variety_name: { type: "string", minLength: 1, maxLength: 100 },
    observed_on: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
    location: { type: "string", minLength: 1, maxLength: 100 },
    growth_stage: { type: "string", minLength: 1, maxLength: 40 },
    notes: { type: "string", maxLength: 500 },
  },
} as const;

export type PeaObservationDocument = FromSchema<typeof peaObservationDocumentSchema>;

const validate = new Ajv({ strict: true })
  .compile<PeaObservationDocument>(peaObservationDocumentSchema);

export function parsePeaObservationDocument(value: unknown): PeaObservationDocument {
  if (!validate(value)) throw new Error("Invalid pea observation document");
  return value;
}
