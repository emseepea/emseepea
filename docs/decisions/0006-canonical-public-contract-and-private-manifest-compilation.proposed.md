---
status: "proposed"
date: 2026-08-27
human-oversight: confirmed
oversight-date: 2026-08-27
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
---

# Canonical Public Contract and Private Manifest Compilation

## Context and Problem Statement

Public MCP shapes, private backend bindings, dispatch, and discovery must not
drift apart. Dynamic interpretation would move contract errors into requests and
could expose private provider details.

## Decision Drivers

- One deterministic source for public validation and capability discovery.
- Strict separation of public models from backend models and destinations.
- Startup failure for invalid or unenforceable registrations.
- Reviewable compatibility changes.

## Considered Options

1. **Compile public contracts and private manifests** - Build immutable registries
   and effective capabilities at startup from separate definitions.
2. **Interpret one combined runtime manifest** - Mix protocol and backend data in
   a dynamically loaded document.
3. **Maintain schemas, dispatch, and capability declarations independently**.

## Decision Outcome

Chosen option: **"Compile public contracts and private manifests"**.

Code-owned public definitions use JSON Schema 2020-12 and remain separate from
private bindings, credentials, backend types, and destinations. Deterministic
compilation creates immutable registries. Startup rejects duplicate names,
invalid or unresolved schemas, missing dependencies, and policies that cannot
be enforced. Serving requests performs no schema or manifest network lookup.

Effective capabilities are the intersection of declared modules, successfully
compiled registrations, and available required dependencies. Compatibility
diffs classify changes as additive, behavior-changing, or breaking; migrations
are explicit and never silently mutate an existing claim.

## Consequences

### Good

- Discovery, validation, and dispatch cannot be configured independently.
- Private backend information stays outside public artifacts.
- Invalid contracts fail before network exposure.

### Neutral

- Contract artifacts and compatibility diffs become build outputs.

### Bad

- Trusted dynamic registration is not available initially.

## Confirmation

- Repeated clean builds produce byte-identical public contract artifacts.
- Duplicate, invalid, unresolved, and dependency-incomplete registrations fail startup.
- Discovery exactly matches the effective registry through real HTTP.
- Public artifacts contain no backend type, credential, destination, or private error detail.
- Compatibility checks reject an unclassified breaking public-contract change.

## Pros and Cons of the Options

### Compile public contracts and private manifests

- Good: Makes drift structurally difficult.
- Bad: Requires deterministic compilation and diff tooling.

### Interpret one combined runtime manifest

- Good: Allows late configuration.
- Bad: Mixes trust domains and delays failures.

### Maintain declarations independently

- Good: Has fewer initial compiler concepts.
- Bad: Makes false capability advertisement likely.

## Reassessment Criteria

Reassess when trusted runtime registration is a demonstrated requirement or
JSON Schema 2020-12 ceases to match the authoritative MCP baseline.
