---
status: "proposed"
date: 2026-09-11
human-oversight: confirmed
oversight-date: 2026-09-11
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
supersedes: [0005-active-streamable-http-scope-and-adaptive-delivery]
reassessment-date: 2026-12-11
---

# Same-Endpoint Stateless Legacy Protocol Support

## Context and Problem Statement

Em See Pea serves the Model Context Protocol (MCP) `2026-07-28` revision and deliberately rejects
earlier protocol revisions. Current and older MCP clients still use the legacy
`initialize` handshake, so the modern-only boundary limits interoperability
even when those clients need only the framework's existing tools, resources,
and prompts.

The installed MCP software development kit (SDK) can classify and serve both protocol eras from the same
server factory. Em See Pea must decide whether to retain modern-only rejection
or add a bounded legacy compatibility subset without adding sessions, replay,
GET streams, a second endpoint, or a second execution path.

## Decision Drivers

- Interoperate with legacy MCP clients across the SDK-supported revision set.
- Preserve MCP `2026-07-28` as the active protocol target.
- Keep one checked execution kernel for both protocol eras.
- Avoid duplicated capability registration and transport-specific handlers.
- Keep the HTTP boundary POST-only, stateless, bounded, and fail-closed.
- State and test the exact supported revisions instead of claiming open-ended
  legacy compatibility.

## Considered Options

1. **Same-endpoint stateless legacy fallback** - Serve the exact supported
   legacy revisions through the existing `POST /mcp` endpoint and server
   factory.
2. **Retain modern-only rejection** - Continue serving only MCP `2026-07-28`.
3. **Separate stateless legacy endpoint** - Serve legacy requests through a
   second URL while retaining the existing modern endpoint.

## Decision Outcome

Chosen option: **"Same-endpoint stateless legacy fallback"**, because it
provides broad interoperability through the SDK's existing compatibility path
without introducing a second endpoint, dependency, capability registry, or
execution kernel.

Em See Pea supports MCP `2026-07-28` and these legacy protocol revisions:

- `2025-11-25`
- `2025-06-18`
- `2025-03-26`
- `2024-11-05`
- `2024-10-07`

Legacy traffic is classified before modern envelope, protocol-header, and
enabled-method checks. Correctly classified legacy traffic uses the installed
SDK's stateless fallback and the same server factory as modern traffic. Every
legacy request receives a fresh server instance and retains the framework's
authentication, authorization, limits, cancellation, validation, redaction,
and observability boundaries.

The endpoint remains `POST /mcp`. Legacy support does not add transport
sessions, session identifiers, GET streams, DELETE session termination,
resumption, or replay. Unsupported legacy capabilities remain unavailable and
are not advertised.

The active delivery target remains the public MCP `2026-07-28` server-side
Streamable HTTP surface. Releases continue to state their exact qualified
subset and proceed in the smallest adopter-visible safe slices supported by
current dependencies and evidence. Legacy support is a bounded compatibility
subset, not a change to that active target.

## Consequences

### Good

- SDK-supported legacy clients can use the existing framework capabilities.
- Both protocol eras use one capability registry and checked execution kernel.
- No new endpoint, dependency, session store, or replay mechanism is added.
- Modern and legacy claims remain independently testable.

### Neutral

- The compatibility promise is limited to the five named revisions.
- Some modern capabilities have no legacy equivalent and remain modern-only.
- Each accepted legacy request constructs and closes a fresh server instance.

### Bad

- Every claimed legacy revision expands the deterministic qualification matrix.
- Cross-era classification and malformed mixed-era traffic add security and
  regression cases.
- Stateless compatibility does not support legacy clients that require
  sessionful GET or DELETE transport behavior.

## Confirmation

- An independent legacy client completes `initialize`, `tools/list`, and
  `tools/call` through `POST /mcp` for every named legacy revision.
- Existing independent MCP `2026-07-28` discovery, listing, and invocation
  journeys remain unchanged.
- Correctly classified legacy requests bypass only modern-era envelope and
  header requirements. Production proxy, origin, request-size, rate-limit,
  authentication, authorization, cancellation, input/output validation,
  result redaction, and observability gates remain enforced before application
  work.
- Malformed, mixed-era, and unsupported-version requests fail closed and cause
  zero handler or backend calls.
- Tests prove that each legacy request uses a fresh server instance and retains
  no cross-request protocol state.
- `GET`, `DELETE`, `PUT`, `PATCH`, and `OPTIONS /mcp` remain `405 Method Not
  Allowed` with `Allow: POST`.
- No session identifier, session store, replay, resumption, or GET stream is
  introduced.
- Modern-only and unsupported legacy capabilities are not advertised on legacy
  connections.
- The protocol coverage ledger distinguishes the MCP `2026-07-28` surface from
  the exact legacy compatibility subset.
- The existing JSON HTTP performance budget passes for the expanded request
  matrix. No performance claim is made for an unmeasured legacy path.

## Pros and Cons of the Options

### Same-Endpoint Stateless Legacy Fallback

- Good: Reuses the installed SDK and the same checked application path.
- Good: Gives clients one stable MCP URL.
- Bad: Expands protocol classification and qualification work.
- Bad: Cannot serve session-dependent legacy clients.

### Retain Modern-Only Rejection

- Good: Keeps the smallest protocol and test surface.
- Bad: Excludes otherwise compatible legacy clients.

### Separate Stateless Legacy Endpoint

- Good: Makes protocol-era routing explicit at deployment time.
- Bad: Adds routing, documentation, configuration, and operational surface
  without improving the POST-only stateless behavior.

## Reassessment Criteria

Reassess when usage evidence shows that a named legacy revision can be removed,
a real adopter requires sessionful legacy transport behavior, the MCP SDK
changes its supported revision set, or a later MCP revision replaces the active
`2026-07-28` target.
