---
status: "proposed"
date: 2026-09-11
human-oversight: confirmed
oversight-confirmed-date: 2026-09-11
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-11
---

# Atomic Runtime Activation of Startup-Compiled Capabilities

## Context and Problem Statement

Em See Pea currently compiles one immutable capability catalogue before it
serves requests. An application may need to activate or deactivate capabilities
without restarting, while keeping schemas, handlers, access policies, lifecycle
visibility, pagination, and direct dispatch consistent.

This increment decides whether a running process may change only which
startup-compiled capabilities are active. It does not add runtime code loading,
schema compilation, filesystem watching, client notifications, sessions,
subscriptions, replay, or cross-process coordination.

## Decision Drivers

- Preserve startup validation and immutable capability definitions.
- Make runtime catalogue changes explicit and opt-in.
- Apply the complete valid change in one step or keep the previous catalogue.
- Use one catalogue revision for the entire request.
- Preserve lifecycle suppression and permission-shaped discovery as separate
  filters.
- Reject stale pagination cursors without exposing protected information.
- Allow only trusted application code to make the change.
- Avoid a second registration system or per-request catalogue callback.

## Considered Options

1. **Atomic activation of startup-compiled capabilities**: compile one finite
   capability pool at startup, then let trusted application code atomically
   replace only its active subset.
2. **Trusted runtime registration and recompilation**: accept new capability
   definitions and schemas after startup, compile a replacement registry, and
   apply it in one step.
3. **Restart with a new static catalogue**: retain the current behaviour and
   require a process restart for every catalogue change.

## Decision Outcome

Chosen option: **"Atomic activation of startup-compiled capabilities"**,
because it supports uninterrupted catalogue changes without moving schema,
handler, or access-policy compilation into the running request boundary.

Applications opt in with `runtimeCatalogueUpdates: true`. The initial `tools`,
`additionalTools`, `resources`, and `prompts` form one checked finite pool.
Trusted application code may call
`replaceActiveCapabilities(app, capabilities)` with the complete active set,
drawn from the same capability objects. MCP requests cannot reach this function.

The framework validates and compiles the complete proposed subset before one
replacement is applied in one step. Unknown objects, duplicates, invalid combinations, or
use after shutdown throw without changing the live revision. Caller-owned
arrays are copied. The initial revision contains the whole startup pool.

Each request uses one immutable revision before method support, access lookup,
authentication, or authorization. That same revision governs discovery,
listing, pagination, direct dispatch, completion, observability naming, and
result handling until the request ends. Requests already in progress finish on
their pinned revision. Later requests see the replacement.

The framework applies catalogue rules in this order:

1. Select the active subset for the pinned revision.
2. Remove active entries whose static `discoverable` flag is `false` from list
   discovery, while keeping them directly callable.
3. In protected-discovery mode, filter the remaining entries and direct calls
   by the authenticated principal's permissions.

An inactive capability behaves exactly like an unknown capability and causes
zero handler, resource, prompt, completion, or backend work. Lifecycle-hidden
and permission-hidden capabilities retain their existing distinct semantics.

Pagination cursors bind to the list method, page limits, a stable hash of the
exact active catalogue, and the protected permission view. A cursor from another revision or
permission view is invalid. Cursors contain no token, principal, schema,
provider cursor, private metadata, or reversible capability data.

Runtime update mode rejects positive cache lifetimes for discovery, catalogue lists,
and resource reads. Em See Pea does not advertise list-change notifications;
clients learn about a revision only by making a fresh request. Page-size and
page-byte limits remain unchanged.

Activation is process-local. Operators running several processes must apply the
same intended subset to each process and accept that requests can observe
different revisions during rollout. This increment makes no atomic
cross-process, session, notification, replay, or reconnect claim.

## Consequences

### Good

- Applications can activate or deactivate checked capabilities without a
  restart.
- Invalid replacements cannot partially change the live catalogue.
- Startup compilation remains the only way to introduce code, schemas,
  handlers, and access policies.
- In-flight requests cannot mix access policy or dispatch from two revisions.
- Existing discovery suppression, protected discovery, and pagination rules
  remain composable and deterministic.

### Neutral

- Applications submit the complete active set rather than incremental add and
  remove commands.
- A multi-process rollout may temporarily expose different valid revisions.
- Clients must re-list because no change notification is advertised.

### Bad

- The startup pool may contain inactive code and schemas in process memory.
- Positive catalogue and resource cache lifetimes are incompatible with this
  opt-in mode.
- Large activation sets require synchronous validation and compilation outside
  the request path, with no performance claim in this increment.

## Confirmation

- Omitting `runtimeCatalogueUpdates` preserves current behaviour and public
  types other than the new opt-in function.
- The update function accepts only a complete active set drawn from the checked
  startup pool and is not exposed through MCP.
- Valid activation and deactivation cover tools, static resources, resource
  templates, prompts, and inherited completion.
- Duplicate, foreign, or invalid proposed entries throw and leave the previous
  revision unchanged.
- A test pauses an authenticated request, publishes a replacement, and proves
  that the paused request finishes entirely on its old revision while the next
  request uses the new revision.
- Inactive and permission-hidden direct calls return the same safe unknown
  response and cause zero application or backend work.
- Active lifecycle-hidden capabilities remain absent from list discovery but
  directly callable under their unchanged access policy.
- Public and protected discovery apply active selection, lifecycle suppression,
  and permission filtering in the specified order.
- Old-revision, malformed, cross-method, and cross-permission pagination cursors
  fail without application work or protected-data disclosure.
- Runtime update mode rejects positive reuse lifetimes for discovery, all catalogue
  lists, and resource reads.
- Server discovery continues to report `listChanged: false`; documentation says
  no notification, cross-process consistency, session, subscription, or replay
  guarantee is included.
- Existing page-size, page-byte, request, result, timeout, cancellation,
  authentication, authorization, and observability checks still pass.
- Ordinary tests cover the exact boundaries. A released-package journey proves
  activation, deactivation, direct-call rejection, and in-flight isolation.

## Pros and Cons of the Options

### Atomic Activation of Startup-Compiled Capabilities

- Good: Changes one checked projection without adding runtime code loading.
- Bad: Cannot introduce a capability that was absent at startup.

### Trusted Runtime Registration and Recompilation

- Good: Can introduce genuinely new definitions without a restart.
- Bad: Moves compilation and resource-exhaustion failures into a running
  process and conflicts with the existing startup-only trust boundary.

### Restart With a New Static Catalogue

- Good: Keeps the current implementation and one immutable lifetime catalogue.
- Bad: Does not support uninterrupted runtime changes.

## Performance Review

Source: **no data - planning assumptions only**.

Each request adds one immutable snapshot reference read before access lookup.
Planning assumes 0.05 milliseconds of CPU, 1 KiB of transient allocation, and
zero network bytes per request. At 100,000 requests per day, those assumptions
would total 5 CPU-seconds and about 98 MiB of cumulative transient allocation.
They are not measured ceilings. Existing list page and byte bounds add no
network allowance.

Activation compilation is outside the request path and remains unbudgeted. No
runtime-activation or protected-discovery performance claim may be published
until a pinned activation and listing workload is measured.

## Reassessment Criteria

Reassess if applications need definitions that were unavailable at startup,
MCP provides a bounded stateless catalogue-change notification, operators need
cross-process atomic activation, positive cache lifetimes become necessary, or
measured snapshot pinning or activation cost exceeds an adopted budget.
