---
status: "proposed"
date: 2026-09-11
human-oversight: confirmed
oversight-date: 2026-09-11
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-11
supersedes: [0070-openapi-generated-backend-types-and-runtime-validation]
---

# Separate OpenAPI-Backed Example and Initializer

## Context and Problem Statement

The existing API-backed example teaches how to integrate an HTTP JSON API when
no usable machine-readable specification is available. Replacing its
hand-written backend schemas with generated schemas would remove that useful
fallback journey.

OpenAPI and Swagger users need a distinct starting point that demonstrates
contract conversion, generation, drift checking, generated TypeScript, and
runtime validation without making the simpler no-spec example carry two setup
paths.

## Decision Drivers

- Preserve a clear no-spec API integration journey.
- Give specification users an explicit, discoverable initializer.
- Keep each runnable example focused on one setup path.
- Avoid separate examples for OpenAPI 3 and Swagger 2 when both produce the
  same runtime design.
- Retain the qualified generator, converter, local-reference, and checked
  boundary decisions.
- Keep every additional public initializer independently releasable and
  verifiable.

## Considered Options

1. **Separate OpenAPI-backed example and initializer** - Keep the existing
   no-spec example and add one specification-driven example with Swagger 2 as
   an import fixture.
2. **Convert the existing API-backed example** - Replace its hand-written
   backend schemas with OpenAPI-generated schemas.
3. **Documentation recipe only** - Keep the existing example and describe
   specification generation without a runnable initializer.

## Decision Outcome

Chosen option: **"Separate OpenAPI-backed example and initializer"**, because
the spec-driven and no-spec journeys begin from materially different developer
inputs even though they share the same checked runtime boundary.

`examples/api-backed-server` and
`@emseepea/create-api-backed-server` remain the hand-written backend-schema
journey for APIs without a usable specification.

`examples/openapi-backed-server` becomes the sole maintained source for the new
`@emseepea/create-openapi-backed-server` initializer. It keeps a local canonical
OpenAPI 3 contract and generates the selected operation's TypeScript declarations
and Zod 4 runtime schemas with `typed-openapi@4.0.1`.

Swagger 2 is an input format inside that same example, not another example or
initializer. A local Swagger 2 fixture is parsed with `yaml@2.9.0`, upgraded to
OpenAPI 3.0.4 with `@scalar/openapi-upgrader@0.2.15`, and then follows the same
generation path. The generation script rejects every `$ref` except a
fragment-only JSON Pointer beginning `#/` before conversion and generation.

The generated project commits its canonical contract, generated TypeScript and
Zod schemas, generation command, and drift check. Build, start, and request
handling do not fetch specifications or generate code. The public MCP input and
output schemas remain separately hand-authored, described, bounded, and checked.

The provider contract does not control the backend origin, selected operation,
credentials, pagination ceiling, deadline, response-size limit, redirect
policy, redaction, or public field selection. These remain explicit application
policy enforced through the existing mapped-tool boundary.

This decision replaces the earlier assignment of specification generation to
the existing API-backed example while retaining its qualified toolchain and
trust boundaries.

## Consequences

### Good

- Developers can choose a clearly named initializer based on whether they have
  a usable API specification.
- The existing no-spec teaching path remains intact.
- The OpenAPI example can demonstrate generation and drift checks without
  complicating the basic API example.
- Swagger 2 support reuses the OpenAPI runtime path.

### Neutral

- Both examples use the same framework mapping and runtime validation boundary.
- Some documentation must explain which of the two API examples to choose.

### Bad

- One more example and public initializer adds tests, documentation, release,
  provenance, and registry-verification work.
- Shared API-boundary guidance must not drift between the two examples.
- The specification-driven example has more setup and generated files than the
  no-spec example.

## Confirmation

- `npm init @emseepea/openapi-backed-server -- <directory>` creates the new
  standalone specification-driven project.
- The existing API-backed initializer retains hand-written backend schemas and
  its current no-spec behavior.
- The OpenAPI-backed project contains one canonical OpenAPI 3 contract, selects
  one operation, and commits generated TypeScript declarations and Zod schemas.
- Clean offline regeneration produces no diff.
- The generation command uses `typed-openapi@4.0.1` with Zod 4, strict
  validation, an operation-ID filter, and no generated HTTP client.
- A committed Swagger 2 fixture upgrades through
  `@scalar/openapi-upgrader@0.2.15` to the same canonical generation path.
- Local fragment `$ref` values are accepted; URL and relative-file references
  are rejected before conversion or generation.
- Changing a required field, optional field, primitive category, or supported
  value constraint changes generated types or runtime acceptance as applicable.
- Invalid mapped backend requests cause zero HTTP calls, and invalid provider
  responses never reach public mapping or emission.
- Callers cannot select the backend origin, operation, credentials, redirects,
  limits, deadline, or contract location.
- Public MCP schemas remain separate and prevent undeclared provider fields or
  private backend details from reaching output.
- Both examples and generated projects independently install, lint, build, run
  ordinary tests, and pass their minimum semantic qualification.
- The new initializer passes accessibility, licence, lockfile vulnerability,
  SBOM, packed-project, provenance, registry, and exact-release checks.
- The canonical public-package list and template comparison documentation
  include the new initializer.

## Pros and Cons of the Options

### Separate OpenAPI-Backed Example and Initializer

- Good: Keeps the spec and no-spec journeys explicit and runnable.
- Bad: Adds a public package and its full maintenance surface.

### Convert the Existing API-Backed Example

- Good: Adds no example or package.
- Bad: Removes the maintained no-spec starting point and combines two setup
  stories in one template.

### Documentation Recipe Only

- Good: Adds no package or runnable example.
- Bad: Does not prove generation, drift detection, or standalone installation.

## Reassessment Criteria

Reassess if adopter evidence shows the two initializers are indistinguishable,
the extra release surface creates disproportionate maintenance cost, or APIs
without usable specifications cease to be a meaningful supported journey.
