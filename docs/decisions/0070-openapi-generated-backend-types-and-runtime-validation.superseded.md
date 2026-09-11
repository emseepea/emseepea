---
status: "superseded"
date: 2026-09-11
human-oversight: confirmed
oversight-date: 2026-09-11
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-11
---

# OpenAPI-Generated Backend Types and Runtime Validation

Superseded by ADR-0071, which keeps this toolchain in a separate example and
initializer instead of changing the existing API-backed example.

## Context and Problem Statement

The API-backed example currently copies a provider's request and response
shapes into hand-written Zod schemas. Many APIs already publish an OpenAPI 3
or Swagger 2 contract. Copying that contract into TypeScript creates a second
backend model that can drift, while TypeScript types alone cannot validate the
provider response at runtime.

The example needs one repeatable way to use an existing API contract for
backend types and validation without turning the provider contract into the
public MCP contract or making normal builds and requests depend on a remote
specification.

## Decision Drivers

- Make the provider contract authoritative for backend operation shapes.
- Generate TypeScript and runtime validation from the same source.
- Support older Swagger 2 contracts without maintaining two generation paths.
- Keep public MCP schemas separate, described, bounded, and deliberate.
- Preserve fixed destinations, limits, deadlines, redirect policy, and safe
  errors outside provider control.
- Make contract changes deterministic, reviewable, and testable offline.
- Use maintained open-source generators rather than project-owned codegen.

## Considered Options

1. **Canonical OpenAPI 3 with generated TypeScript and Zod** - Normalize
   Swagger 2 during explicit generation, then generate the selected operation's
   TypeScript types and Zod validators from one local OpenAPI 3 contract.
2. **OpenAPI-generated TypeScript with hand-written Zod** - Generate compile-time
   types but continue copying the provider contract into runtime validators.
3. **Hand-written TypeScript and Zod** - Keep the current API-backed example.

## Decision Outcome

Chosen option: **"Canonical OpenAPI 3 with generated TypeScript and Zod"**,
because one local contract can govern both compile-time and runtime backend
checks while Swagger 2 remains an import format rather than a second internal
model.

The API-backed example keeps a local canonical OpenAPI 3 document. An explicit
generation command parses local JSON or YAML with `yaml@2.9.0`, converts a
local Swagger 2 input to OpenAPI 3.0.4 with
`@scalar/openapi-upgrader@0.2.15` when needed, then invokes
`typed-openapi@4.0.1` with `--runtime zod --validation strict
--no-include-client --endpoint <operationId>`. This generates the selected
endpoint and its required schemas without an HTTP client implementation. The
generator, upgrader, and YAML parser are pinned development dependencies.
Generated TypeScript declarations and Zod schemas are committed.

Only one local contract file participates in generation. Before conversion and
again before generation, the script recursively rejects every `$ref` that is
not a fragment-only JSON Pointer beginning `#/`. Provider contracts obtained
from a URL and any cross-file references must therefore be vendored into that
single file first. Build, start, and request handling neither fetch
specifications nor generate code.

Generated operation parameter and response schemas supply the provider-owned
parts of `backendInputSchema` and `backendOutputSchema`. Small application-owned
Zod objects continue to enforce the fixed HTTP envelope where necessary. The
mapper compiles against generated types without casts, duplicate backend
interfaces, or hand-written duplicate provider validators.

The provider contract does not control the backend origin, selected operation,
credentials, pagination ceiling, deadline, response-size limit, redirect
policy, logging, redaction, or public field selection. Those remain explicit
application policy. Public MCP input and output remain hand-authored Zod
schemas with model-useful descriptions and are independently validated by the
checked execution kernel.

A bounded compatibility check on 2026-09-11 converted the Swagger 2 Petstore
contract to OpenAPI 3.0.4, selected one operation, generated TypeScript and Zod
4 schemas without an HTTP client, accepted a conforming response, rejected a
response with an invalid field type, and checked path-parameter coercion. The
generated runtime module was 1,682 bytes and its declaration file was 1,196
bytes. The 78-package installed tree had no npm audit findings. Direct
`typed-openapi` use on Swagger 2 degraded the used request and response schemas
to `unknown`, proving that explicit conversion is necessary. Release
qualification still owns licence, lockfile vulnerability, packed-initializer,
and performance evidence.

## Consequences

### Good

- Provider contract changes produce reviewable generated type and validator
  changes.
- Compile-time and runtime backend checks cannot drift independently.
- Swagger 2 support adds no second application model.
- Generated code contains schemas only, not an unused generated HTTP client.
- Ordinary builds, starts, and calls remain deterministic and offline with
  respect to the provider specification.

### Neutral

- A remote provider specification must be deliberately vendored and reviewed
  before regeneration.
- Application policy remains hand-authored because a provider contract cannot
  authorize MCP trust-boundary choices.

### Bad

- Generated files and three pinned development packages add repository and
  dependency weight.
- OpenAPI features not preserved by conversion or generation require an
  explicit qualification failure rather than a hand-written workaround.
- Provider specifications can be incomplete or inaccurate even when generation
  succeeds.

## Confirmation

- One committed canonical OpenAPI 3 document drives generated TypeScript and
  runtime Zod validation for the selected operation's parameters and response.
- A committed Swagger 2 fixture normalizes deterministically during the explicit
  generation step; generation does not occur during build, start, or requests.
- Clean offline regeneration produces no diff. Local fragment `$ref` values are
  accepted; an `https:` `$ref` and a relative-file `$ref` are rejected before
  conversion or generation.
- Changing a required field, optional field, or primitive category changes the
  generated types and runtime acceptance. Changing a supported value constraint
  changes runtime acceptance even when the TypeScript shape does not change.
- Mapper inputs and outputs compile against generated types without casts,
  duplicate backend interfaces, or hand-written duplicate provider validators.
- An invalid mapped backend request causes zero HTTP calls. An invalid provider
  response never reaches public mapping or emission.
- Public MCP schemas remain separately hand-authored, described, bounded, and
  contain no backend destinations, credentials, private errors, or undeclared
  provider fields.
- A structurally valid new provider string value in an approved public field
  passes through unchanged; malformed values fail; undeclared fields do not
  reach public output.
- Callers cannot select the backend origin, operation, credentials, redirects,
  pagination ceiling, deadline, response-size limit, or contract location.
- The pinned generator, upgrader, and YAML parser pass licence, lockfile
  vulnerability, software bill of materials, packed standalone initializer,
  and provenance checks.
- Qualification records runtime-validator CPU and transient memory cost before
  release and does not weaken validation to meet the JSON boundary budget.

## Pros and Cons of the Options

### Canonical OpenAPI 3 with generated TypeScript and Zod

- Good: One backend contract drives compile-time and runtime checks.
- Good: Swagger 2 becomes a deterministic import concern.
- Bad: Adds generated files and pinned development dependencies.

### OpenAPI-generated TypeScript with hand-written Zod

- Good: Provides compile-time feedback with less generator integration.
- Bad: Runtime validators can still drift from the provider contract.

### Hand-written TypeScript and Zod

- Good: Adds no generation tooling.
- Bad: Duplicates provider contracts and relies on manual synchronization.

## Reassessment Criteria

Reassess if the selected tools cannot represent a required OpenAPI feature,
Swagger conversion changes the meaning of a used operation, a provider contract
proves too inaccurate to govern runtime acceptance, or measured generation or
runtime-validation cost exceeds the applicable budgets.
