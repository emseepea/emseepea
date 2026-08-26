---
status: "proposed"
date: 2026-08-27
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
---

# Clean-Room Source Authority and Provenance

## Context and Problem Statement

Em See Pea must be independently implemented without reading or reconstructing
the archived system on which the design guide was based. The project needs a
clear source hierarchy and exposure response.

## Decision Drivers

- Restricted implementation material must not influence code or tests.
- Public normative sources must override derivative design input.
- Every nontrivial implementation input needs reviewable provenance.
- Process precedent must not become product implementation evidence.

## Considered Options

1. **Pinned clean-room source hierarchy** - Permit the named guide, approved
   amendments, public authorities, open-source dependencies, and synthetic artifacts.
2. **Repository-based reconstruction** - Inspect the archived implementation for behavior.
3. **Unrecorded public-source implementation** - Use public material without provenance.

## Decision Outcome

Chosen option: **"Pinned clean-room source hierarchy"**.

The permitted design input is
`/Users/tomhoward/Projects/mcp-streamable-http-framework-implementation-guide.md`
with SHA-256
`c7940e5bf26abe65915b996ebf0812fabb6f97d91567653a76018717a8e747de`,
plus approved local amendments. Public MCP specifications and official schemas
take precedence, followed by official SDK documentation and other pinned public
dependencies. Conflicts are recorded and resolved before affected code ships.

The archived or restricted implementation is never opened, searched, restored,
or unarchived. Tests, fixtures, services, adapters, and data are independently
created and synthetic. The specifically authorized QA-project inspection is
process precedent only and never implementation, schema, fixture, or test
evidence. Provenance records source, version, digest, license, permitted use, and
the artifact influenced. Suspected exposure quarantines the affected work until
independent review decides whether it must be rebuilt.

## Consequences

### Good

- Independent implementation intent is explicit and auditable.
- Public authority and derivative guidance cannot be confused.
- Exposure has a defined containment action.

### Neutral

- Provenance grows with meaningful external inputs.

### Bad

- Some ambiguities take longer to resolve without inspecting the original system.

## Confirmation

- Provenance identifies every implementation-affecting external source and digest.
- Repository tests and examples use only synthetic services, adapters, and data.
- No restricted path or archived content appears in source, history, or build inputs.
- QA precedent records only generic process lessons, never copied product artifacts.
- An independent clean-room review can trace each shipped claim to permitted evidence.

## Pros and Cons of the Options

### Pinned clean-room source hierarchy

- Good: Enables useful public dependencies without contaminating implementation.
- Bad: Requires disciplined provenance.

### Repository-based reconstruction

- Good: Could answer behavioral questions quickly.
- Bad: Violates the clean-room constraint.

### Unrecorded public-source implementation

- Good: Reduces documentation.
- Bad: Cannot prove source eligibility or precedence.

## Reassessment Criteria

Reassess only if the user changes the clean-room boundary or an exposure review
requires replacement of affected work.
