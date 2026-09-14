---
status: "proposed"
date: 2026-09-14
human-oversight: confirmed
oversight-date: 2026-09-14
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
reassessment-date: 2026-12-14
supersedes: [0088-always-available-checked-mcp-ping]
---

# No `ping` in Model Context Protocol (MCP) `2026-07-28` Beyond Existing Legacy Compatibility

> Captured with `/wr-architect:capture-adr`. The capturing agent derived the
> section content from the in-session decision context. Tom Howard explicitly
> replaced ADR-0088 with this decision on 2026-09-14.

## Plain English Summary

Em See Pea will not add `ping` to MCP version
`2026-07-28`. That protocol revision removed `ping` from its request registry.
Existing support for earlier protocol revisions remains unchanged.

## Context and Problem Statement

ADR-0088 incorrectly treated the generic `PingRequestSchema`, built-in handler,
and client helper exported by the pinned MCP packages as proof that `ping`
belongs to MCP `2026-07-28`.

The version-specific wire registry is authoritative. Its MCP `2026-07-28`
request-method set excludes `ping`, while its 2025-era registry includes it.
The framework therefore correctly returns method-not-found for MCP `2026-07-28` `ping`
requests and leaves legacy handling to the official software development kit
(SDK).

## Decision Drivers

- Match the pinned MCP `2026-07-28` wire registry exactly.
- Do not restore functionality removed from the active protocol revision.
- Preserve existing legacy compatibility without adding new code.
- Distinguish cross-version package exports from version-specific wire support.
- Avoid creating another health-check API when `/healthz` already exists.

## Considered Options

1. **Keep MCP `2026-07-28` `ping` absent and preserve legacy behavior (chosen)**: make no
   runtime change and document the version boundary.
2. **Force `ping` through the MCP `2026-07-28` request path**: override the wire registry
   and expose behavior removed from MCP `2026-07-28`.
3. **Add another application health operation**: create new configuration and
   semantics alongside the existing `/healthz` endpoint.

## Decision Outcome

Chosen option: **"Keep MCP `2026-07-28` `ping` absent and preserve legacy behavior"**,
because exact protocol support is safer than inferring support from generic
cross-version package exports.

Em See Pea does not admit `ping` through its MCP `2026-07-28` method filter.
MCP `2026-07-28` requests continue to receive the standard method-not-found error. The
framework adds no handler, configuration, capability advertisement,
authentication exception, logging, progress, cache, or state for `ping`.

Supported 2025-era requests retain their existing official SDK behavior. This
decision does not expand, remove, or otherwise change that compatibility path.
It supersedes ADR-0088 before any runtime implementation or release occurred.

## Consequences

### Good

- MCP `2026-07-28` behavior remains aligned with the version-specific wire registry.
- No deprecated functionality or unnecessary health abstraction is added.
- Existing legacy compatibility remains stable.

### Neutral

- Generic SDK schemas and helpers may continue to mention `ping` because the
  packages serve multiple protocol eras.
- `/healthz` remains the server-process health endpoint outside MCP.

### Bad

- A client that sends `ping` after selecting MCP `2026-07-28` receives
  method-not-found.
- Readers must consult version-specific support rather than assume every
  exported SDK method is valid in every protocol revision.

## Confirmation

### Protocol Behavior

- Raw MCP `2026-07-28` `ping` receives method-not-found.
- Two independent official clients pinned to MCP `2026-07-28` observe the same
  rejection.
- Every supported 2025-era revision retains its existing official SDK `ping`
  behavior.

### Safety and Scope

- No application handler or authentication verifier runs for rejected MCP
  `2026-07-28` `ping`.
- No progress, logging, cache, state, capability, or public API is added.
- Client logging, roots, sampling, tasks, sessions, replay, reconnect, and
  runtime catalogue mutation remain outside this decision.

### Qualification

- The pinned dependency's version-specific request registries are checked
  directly rather than inferred from generic exports.
- Existing source, black-box, packed-package, and released-package behavior
  remains unchanged; no package release is required for this documentation-only
  correction.

### Documentation

- Protocol coverage states that `ping` is absent from MCP `2026-07-28` and remains
  legacy-only.
- ADR-0088 is retained as superseded history rather than rewritten.

## Pros and Cons of the Options

### Keep MCP `2026-07-28` `ping` Absent and Preserve Legacy Behavior

- Good, because it requires no runtime code and matches the active registry.
- Bad, because MCP `2026-07-28` clients cannot use the older liveness request.

### Force `ping` Through the MCP `2026-07-28` Request Path

- Good, because older client assumptions might appear to work.
- Bad, because it would knowingly diverge from the selected protocol revision.

### Add Another Application Health Operation

- Good, because an application could define broader health semantics.
- Bad, because `/healthz` already covers process health and no additional job
  has been demonstrated.

## Performance Review

The runtime delta is 0 CPU, 0 transient allocation, and 0 network bytes because
this decision makes no runtime change. Existing method-not-found and legacy
paths remain unchanged.

## Reassessment Criteria

Reassess if a future selected MCP revision restores `ping`, the version-specific
wire registry changes, or adopter evidence shows that `/healthz` cannot cover a
required health job. Do not infer protocol support from generic cross-version
exports.
