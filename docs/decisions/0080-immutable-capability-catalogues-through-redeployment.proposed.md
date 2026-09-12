---
status: "proposed"
date: 2026-09-12
human-oversight: confirmed
oversight-confirmed-date: 2026-09-12
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-12
---

# Immutable Capability Catalogues Through Redeployment

> Captured via /wr-architect:capture-adr (foreground-lightweight aside-invocation per ADR-032, derived-substance amendment 2026-07-06 / RFC-045). Section content was derived by the capturing agent from the in-session decision context and ratified by the decision-maker on 2026-09-12.

## Context and Problem Statement

MCP 2026-07-28 defines optional tools, resources, and prompts list-change
notifications. Em See Pea uses immutable deployments: each process compiles
one checked capability catalogue at startup, and catalogue changes are shipped
as a new deployment.

ADR-0069 rejected runtime activation and named a bounded protocol notification
as a reason to reassess. That trigger has now been evaluated. Although the
protocol supplies an optional notification, there is no demonstrated Em See
Pea need to change a catalogue within one running process. Adding a runtime
replacement API only to exercise the notification would add state and failure
modes that the deployment model does not require.

This decision leaves ADR-0069 as rejected history and decides how catalogue
changes are delivered under the immutable deployment model.

## Decision Drivers

- Preserve immutable deployments and startup-only catalogue compilation.
- Advertise only protocol behavior the server actually supports.
- Avoid a runtime mutation API without a demonstrated operational use case.
- Keep catalogue rollout, rollback, and process replacement in the deployment layer.
- Preserve permission filtering, discovery suppression, and pagination behavior.
- Avoid implying replay, reconnect recovery, or cross-process atomicity.

## Considered Options

1. **Immutable catalogues through redeployment (chosen)**: compile the catalogue once at process startup, advertise `listChanged: false`, and deliver changes through a new deployment and fresh MCP initialization.
2. **Atomic startup-pool replacement with list-change notifications**: let trusted application code replace the active subset within a running process and notify affected clients.
3. **Explicit notification without catalogue replacement**: emit list-change notifications while the framework catalogue remains unchanged.

## Decision Outcome

Chosen option: **"Immutable catalogues through redeployment"**, because Em See
Pea has no demonstrated need to mutate a checked capability catalogue inside a
running process.

Each process compiles its tools, additional tools, resources, resource
templates, and prompts once at startup. Neither the public API nor MCP can
replace that catalogue. Modern discovery continues to advertise
`listChanged: false`, and the server emits no tools, resources, or prompts
list-change notifications.

A catalogue change requires a new deployment. Clients observe it after a fresh
MCP initialization and list request against the new process. The old process
retains its original catalogue until shutdown. During a rolling deployment,
different processes may temporarily expose different complete catalogues.

Existing resource-update subscriptions remain bounded by their current
process and end with it. This decision introduces no session transfer, replay,
persistence, reconnect recovery, or cross-process coordination guarantee.
Legacy protocol behavior remains unchanged.

## Consequences

### Good

- Startup remains the only point where capability code, schemas, handlers, and access policies enter the catalogue.
- Catalogue changes use the existing deployment, rollback, and process-isolation model.
- No runtime replacement API, revision state, or subscriber comparison is added.
- `listChanged: false` remains a truthful protocol claim.

### Neutral

- MCP list-change notifications remain intentionally unsupported.
- Clients discover a changed catalogue through a fresh connection to a new process.
- Rolling deployments may temporarily expose different complete catalogues.

### Bad

- Catalogue changes cannot be delivered within one uninterrupted process lifetime.
- Clients that do not reconnect after process replacement cannot observe the new catalogue.

## Confirmation

- Capability catalogues are compiled once at startup and cannot be replaced through a public or MCP API.
- Modern discovery advertises `listChanged: false`; no tools, resources, or prompts list-change notifications are emitted.
- Two separately started deployments with different checked definitions expose their respective catalogues only after fresh MCP initialization and listing.
- The old process retains its original catalogue until shutdown.
- Rolling deployments may temporarily expose different catalogues across processes.
- Existing subscriptions end with their process; no reconnect, replay, or recovery guarantee is introduced.
- Raw HTTP, official-client, protected-discovery, pagination, legacy, packed-package, documentation, and released-package checks preserve these boundaries.
- Documentation states that catalogue changes require redeployment and fresh MCP initialization.

## Pros and Cons of the Options

### Immutable Catalogues Through Redeployment

- Good, because it matches the deployment model and adds no runtime mutation path.
- Bad, because it does not support catalogue changes within one process lifetime.

### Atomic Startup-Pool Replacement With List-Change Notifications

- Good, because connected clients could discover a catalogue change without process replacement.
- Bad, because it adds runtime state, a public mutation API, revision rules, and per-subscriber comparison without a demonstrated need.

### Explicit Notification Without Catalogue Replacement

- Good, because it would add little API surface.
- Bad, because clients would re-list an unchanged catalogue and the notification would be misleading.

## Performance Review

No runtime behavior is added, so this decision introduces no new runtime
performance budget or claim.

## Reassessment Criteria

Reassess if a demonstrated application requirement needs capability changes
without process replacement, immutable deployment becomes unavailable, or MCP
makes list-change support mandatory rather than optional. Any reassessment must
still preserve startup validation, permission-shaped discovery, and truthful
capability advertising.
