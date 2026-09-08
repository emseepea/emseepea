---
status: "proposed"
date: 2026-09-08
human-oversight: confirmed
oversight-confirmed-date: 2026-09-08
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
supersedes: [0061-mongodb-json-schema-generated-internal-validation]
reassessment-date: 2026-12-08
---

# Two MongoDB Collection Validation Patterns

## Context and Problem Statement

MongoDB collections may enforce a schema in the database or remain schemaless.
Developers choosing an integration pattern need to see both approaches without
being told that one storage policy fits every existing collection. In either
case, the MCP server must validate data before exposing it.

## Decision Drivers

- Show both common MongoDB collection policies in one initializer.
- Keep the two tools meaningfully different to an AI, rather than exposing the
  storage implementation as a tool-selection concern.
- Derive application types and runtime validation from one schema per stored
  document shape.
- Prove the different database enforcement boundaries honestly.
- Keep IDs, operators, collection choices, and routing details out of the MCP.
- Avoid an object-document mapper and hand-written duplicate interfaces.

## Considered Options

1. **Two validation patterns in one initializer**: keep the schema-enforced pea
   variety collection and add a semantically distinct schemaless pea observation
   collection with application validation on every read and write.
2. **Only the schema-enforced collection**: teach one shared schema enforced by
   MongoDB, Ajv, and TypeScript.
3. **Separate initializers for each policy**: publish one initializer for a
   schema-enforced collection and another for a schemaless collection.

## Decision Outcome

Chosen option: **"Two validation patterns in one initializer"**, because users
can compare both boundaries in one small project and choose the approach that
matches each existing collection.

The public package remains `@emseepea/create-mongodb-backed-server`, maintained
only in `examples/mongodb-backed-server`. The `pea_varieties` collection keeps
its MongoDB `$jsonSchema` validator. Its one portable JSON Schema object also
drives Ajv runtime validation and `FromSchema` TypeScript inference.

A second `pea_observations` collection intentionally has no MongoDB validator.
It has its own single standard JSON Schema object, which drives Ajv strict
runtime validation and `FromSchema` TypeScript inference. The application
validates every observation before a write and every retrieved observation
before public mapping. MongoDB's lack of enforcement for that collection is
explicit and tested.

The collections support different user tasks. Variety tools describe catalogue
entries. Observation tools record and list bounded sightings. No tool asks the
model or caller to choose a storage validation policy. Public Zod schemas are
described and bounded. They expose neither MongoDB IDs nor collection names,
operators, sort documents, or destinations.

Both paths use fixed projections, fixed limits, `maxTimeMS`, bounded connection
pools, bounded selection and connection timeouts, generic public errors, and
schema-declared pass-through for compatible values. The example does not claim
that its MongoDB code works unchanged with Firestore.

Before release, qualification measures both paths. Until then, the planning
budget for each schemaless call is 1 to 5 milliseconds of process CPU, at most
1 MiB of transient memory, and 2 to 32 KiB of network traffic. At 1,000 calls
per day for each collection policy, the combined planning range is 2 to 10 CPU
seconds and 4 to 64 MiB of traffic per day, with at most 4 MiB of concurrent
transient application memory at the fixed pool size of four.

## Consequences

### Good

- One initializer demonstrates both database-enforced and application-enforced
  document validation.
- Tool selection follows the user's task, not the collection's storage policy.
- Schemaless storage does not become unvalidated application data.

### Neutral

- Each distinct document shape has one schema because varieties and
  observations are different domain records.
- Deterministic tests, not semantic tests, prove the storage enforcement
  boundary.

### Bad

- The example is larger than a single-collection MongoDB example.
- The schemaless collection cannot independently reject a write that bypasses
  the application validator.

## Confirmation

- `pea_varieties` retains a MongoDB validator equal to its application schema.
- `pea_observations` has no MongoDB validator.
- Each collection has exactly one `as const` standard JSON Schema object used
  by Ajv strict mode and `FromSchema`, with no copied interface or manual field
  validator.
- An invalid variety write is rejected by MongoDB.
- An invalid observation presented to the application causes zero MongoDB write
  calls, while a test-only direct invalid insert proves the collection itself
  is schemaless.
- Invalid stored documents from either collection fail application validation
  and never reach public output.
- Compatible unseen string values pass through both paths without translation
  maps or an application release.
- Variety and observation tools have distinct task semantics and do not expose
  the validation policy, MongoDB IDs, collection selectors, operators, sorts,
  or destinations.
- Fixed projections, limits, timeouts, generic failures, readiness, and clean
  shutdown are tested for both paths.
- Semantic evaluation covers model-visible variety and observation behavior at
  the minimum useful model cost. It does not claim to test database enforcement.
- The initializer creates a private standalone project and passes ordinary,
  semantic, pack, clean-install, OSV, licence, software-bill-of-materials,
  provenance, registry, accessibility, and documentation checks.
- Measured process CPU, memory, and network evidence for both paths replaces the
  planning assumptions before release.

## Pros and Cons of the Options

### Two Validation Patterns in One Initializer

- Good: Users can compare both boundaries in one runnable project.
- Bad: More concepts must be explained and tested in one example.

### Only the Schema-Enforced Collection

- Good: It is the smallest and strongest database boundary.
- Bad: It does not help users whose existing collection must remain schemaless.

### Separate Initializers for Each Policy

- Good: Each project teaches only one policy.
- Bad: It duplicates MongoDB setup and makes comparison harder.

## Reassessment Criteria

Reassess if MongoDB gains portable database enforcement for existing schemaless
collections without migration, if the two domain tasks no longer remain clear,
or if measured cost makes the combined initializer unsuitable.
