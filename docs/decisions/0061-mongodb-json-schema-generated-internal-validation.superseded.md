---
status: "proposed"
date: 2026-09-08
human-oversight: confirmed
oversight-date: 2026-09-08
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-08
---

# MongoDB JSON Schema Generated Internal Validation

## Context and Problem Statement

The examples need a NoSQL integration that does not present schemaless data as
unvalidated data. Where the database supports an authoritative collection
schema, the same contract should govern stored documents, runtime validation,
and TypeScript types.

## Decision Drivers

- Use one schema for database and application validation.
- Demonstrate a recognizable NoSQL database without an object-document mapper.
- Let structurally compatible backend values pass through public schemas without
  closed translation maps.
- Keep public MCP schemas separate, described, and deliberately bounded.
- Avoid hand-maintained duplicate TypeScript interfaces.

## Considered Options

1. **MongoDB JSON Schema with Ajv and json-schema-to-ts**: keep one portable
   JSON Schema subset, apply it as collection validation, compile it with Ajv,
   and infer TypeScript types from the same object.
2. **Mongoose application schema**: make an object-document mapper schema the
   source of database and application types.
3. **Schemaless documents with manual checks**: accept MongoDB documents and
   validate selected fields inside each capability.

## Decision Outcome

Chosen option: **"MongoDB JSON Schema with Ajv and json-schema-to-ts"**, because
MongoDB can enforce the schema and the application can reuse the same contract
without introducing an object-document mapper.

The public package is `@emseepea/create-mongodb-backed-server`, maintained in
`examples/mongodb-backed-server`. It uses the official MongoDB Node.js driver,
Ajv for runtime checks, and `FromSchema` from `json-schema-to-ts` for TypeScript
inference. The schema stays within the JSON Schema keywords supported by both
MongoDB and Ajv. It is one `as const` standard JSON Schema object accepted by
Ajv strict mode and `FromSchema`. The example excludes `bsonType` and other
MongoDB-only schema features. A small adapter wraps that exact object in
MongoDB's `$jsonSchema` container; there is no second document schema or copied
serialization.

Public MCP input and output remain described Zod schemas. They define the model
contract and expose only deliberate fields. The collection schema defines the
internal document contract.

Queries use fixed field projections, a fixed result limit, and `maxTimeMS`.
Connections use bounded pool, selection, and connection timeouts. Inputs contain
domain values only and cannot select operators, collections, sort documents, or
destinations. Public responses and generic failures expose neither connection
details nor MongoDB `_id` values.

The provisional per-call budget is 1 to 5 milliseconds of process CPU, at most
1 MiB of transient application memory, and 2 to 32 KiB of network traffic,
assuming at most 1,000 calls per day. Qualification measures these paths before
release and records whether they remain within 1 to 5 CPU-seconds and 2 to 32
MiB of daily traffic at that assumed volume.

## Consequences

### Good

- MongoDB rejects invalid writes and the application rejects invalid reads using
  the same schema.
- TypeScript types change when the schema object changes.
- The example remains close to the official driver and database concepts.

### Neutral

- The shared schema uses the intersection of MongoDB and standard JSON Schema
  features.
- MongoDB remains required for integration and semantic tests.

### Bad

- Ajv and json-schema-to-ts add dependencies beyond the MongoDB driver.
- MongoDB-specific BSON types outside the portable subset need an explicit
  adapter or a future decision.

## Confirmation

- Collection setup applies the identical `as const` schema object used by Ajv
  strict mode and `FromSchema` inference.
- A compatibility test proves every schema keyword used is accepted by MongoDB,
  Ajv strict mode, and `FromSchema`.
- Tests prove MongoDB rejects invalid writes, application validation rejects an
  invalid document inserted through test-only `bypassDocumentValidation`, and
  compatible new string values pass through.
- The public MCP schemas contain descriptions and do not expose MongoDB IDs or
  routing details unless the user task requires them.
- Tests prove fixed projections, bounded results and timeouts, generic errors,
  and rejection of caller-provided MongoDB operators, collection names, sorts,
  and destinations.
- Measured process CPU, memory, and network evidence is recorded before release.
- The initializer creates a private standalone project and passes ordinary,
  semantic, package, provenance, registry, accessibility, and documentation
  checks.

## Pros and Cons of the Options

### MongoDB JSON Schema with Ajv and json-schema-to-ts

- Good: One schema governs storage, runtime validation, and TypeScript.
- Bad: The usable vocabulary is the intersection of two schema dialects.

### Mongoose Application Schema

- Good: One mature library provides modeling and application validation.
- Bad: It adds an object-document mapper and makes application code the source
  instead of the database collection contract.

### Schemaless Documents with Manual Checks

- Good: It has the fewest dependencies.
- Bad: It repeats checks and fails to demonstrate schema-driven integration.

## Reassessment Criteria

Reassess if MongoDB and Ajv no longer share a sufficient JSON Schema subset, or
if the example needs BSON-specific values that cannot retain one source of truth.
