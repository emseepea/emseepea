---
status: "proposed"
date: 2026-09-04
human-oversight: confirmed
oversight-date: 2026-09-04
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-04
---

# Optional Deterministic Filesystem Discovery

## Context and Problem Statement

Em See Pea currently requires adopters to assemble central arrays of tools,
resources, and prompts. As a server grows, those arrays can drift from the
modules that implement its capabilities. The framework needs an optional way to
discover code-owned capability definitions without creating another manifest,
schema language, or runtime registration path.

## Decision Drivers

- Keep capability definitions and focused tests close to their implementation.
- Preserve explicit code-native registration for small and unusual servers.
- Compile one deterministic, immutable registry before serving requests.
- Preserve the existing checked execution kernel and Zod schema contracts.
- Make development source and built package discovery behave consistently.
- Avoid generator frameworks, watcher services, and duplicate template trees.

## Considered Options

1. **Optional deterministic startup discovery (chosen)**: discover supported
   modules from a configured directory once at startup and feed them into the
   existing registry.
2. **Explicit registration arrays only**: retain the current requirement for
   every capability to appear in a central array.
3. **Generated or declarative manifests**: introduce a generator or separate
   manifest that describes capability modules.

## Decision Outcome

Chosen option: **"Optional deterministic startup discovery"**, because it
removes repetitive registration and catalogue drift while preserving explicit
registration and the existing execution and validation boundaries.

Discovery is opt-in and runs before the server begins accepting requests. It
loads supported code-owned modules from one configured root, applies one
documented file convention, sorts results deterministically, and feeds the
result into the same immutable tool, resource, and prompt registries used by
explicit registration. It is not trusted dynamic registration and cannot add or
replace capabilities after startup.

Filesystem discovery, TypeScript checking, and runtime schema validation remain
separate guarantees. The existing concrete Zod schema types continue through
handlers and mapping callbacks at compile time. The existing kernel continues
to validate untrusted input, backend values, and public output at runtime.

## Consequences

### Good

- The filesystem can be the capability catalogue without a parallel manifest.
- Invalid, incomplete, or conflicting modules fail before network exposure.
- Explicitly registered and discovered capabilities receive identical runtime
  validation, authorization, cancellation, and safe error handling.
- Examples demonstrate the convention directly and remain the sole initializer
  template source.

### Neutral

- Adopters choose between explicit arrays and the documented file convention.
- Development may discover TypeScript source while published applications
  discover emitted JavaScript.

### Bad

- File and directory names become part of the adopter-facing convention.
- Moving a module can change its derived identity.
- Startup performs bounded filesystem reads and module imports.

## Confirmation

- Repeated discovery returns capabilities in the same order and produces
  byte-identical public contract output.
- Effective MCP discovery exactly matches the compiled registry.
- Duplicate normalized identities, malformed names, missing declarations,
  unsupported exports, out-of-root paths, and source plus build collisions fail
  deterministically without first-match selection.
- Development source and built output each work without double registration.
- Discovered calls use the existing checked kernel, so invalid external input
  never reaches application code and invalid backend or public output is never
  emitted.
- Compile-time checks prove that undeclared input access and schema-invalid
  mapped output do not type-check, while valid mapping code does.
- Every maintained example and generated initializer uses the convention and
  retains its existing lint, ordinary, semantic, and accessibility tests.
- Explicit registration remains supported and filesystem discovery remains
  opt-in.

## Pros and Cons of the Options

### Optional deterministic startup discovery

- Good, because it removes the central catalogue while reusing existing
  definitions, schemas, and registries.
- Bad, because it establishes a public filename convention and adds startup
  filesystem work.

### Explicit registration arrays only

- Good, because control flow stays fully visible in one source file.
- Bad, because the central catalogue repeats information and can drift from the
  implementation modules.

### Generated or declarative manifests

- Good, because a manifest can be inspected without importing modules.
- Bad, because it creates another maintained contract, extra tooling, and new
  drift opportunities.

## Reassessment Criteria

Reassess if startup discovery becomes measurably expensive, an adopter requires
capabilities to change after startup, emitted JavaScript cannot be mapped
reliably without build integration, or the filename convention cannot represent
required MCP capabilities without special cases.
