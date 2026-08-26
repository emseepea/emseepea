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

# Active Streamable HTTP Scope and Adaptive Delivery

## Context and Problem Statement

The guide describes a broad MCP server surface and a fixed 110-step sequence.
Em See Pea needs a clear destination and honest partial claims without turning
that sequence into an inflexible release plan.

## Decision Drivers

- The public MCP specification and official schema are authoritative.
- Exact shipped claims must remain within proven behavior.
- Delivery must adapt to evidence and adopter value.
- Deprecated behavior and speculative transports add qualification cost.

## Considered Options

1. **Active surface with adaptive delivery** - Keep the full active surface as
   the destination while choosing the smallest valuable safe slice from evidence.
2. **Fixed 110-release sequence** - Implement every guide row in its written order.
3. **Permanent narrow subset** - Implement only the first useful tool profile.

## Decision Outcome

Chosen option: **"Active surface with adaptive delivery"**.

The target is the public MCP `2026-07-28` server-side Streamable HTTP surface.
Each release states its exact qualified subset. Deprecated behavior, legacy
initialization, stdio, GET streams, sessions, replay, and separately versioned
extensions are excluded unless a later decision adds them.

The guide's 110 outcomes are a coverage and value ledger, not 110 mandatory
releases or an immutable order. Work proceeds in the smallest adopter-visible
safe slices supported by current dependencies and evidence. Removal tests prove
that disabled capabilities disappear cleanly. A second transport requires a
new decision based on a real adopter need.

## Consequences

### Good

- Delivery can reorder or combine guide outcomes without losing coverage.
- Partial releases remain useful and accurately described.

### Neutral

- The coverage ledger must remain current as work is reordered.

### Bad

- Legacy clients and unqualified extensions are intentionally unsupported.

## Confirmation

- Every release names only its currently proven modules and deployment boundary.
- The coverage ledger traces every shipped claim to public requirements and passing evidence.
- Disabled capabilities are absent from discovery and safely rejected.
- Delivery may be reordered without violating recorded dependency gates.
- No deprecated, stdio, GET stream, session, replay, or extension claim appears implicitly.

## Pros and Cons of the Options

### Active surface with adaptive delivery

- Good: Preserves the full objective while responding to evidence.
- Bad: Requires active coverage-ledger maintenance.

### Fixed 110-release sequence

- Good: Is mechanically predictable.
- Bad: Treats a speculative sequence as more important than the objective.

### Permanent narrow subset

- Good: Minimizes implementation.
- Bad: Does not deliver the intended universal framework.

## Reassessment Criteria

Reassess when the authoritative MCP baseline changes, a deprecated behavior is
required by a real adopter, or a second transport has demonstrated value.
