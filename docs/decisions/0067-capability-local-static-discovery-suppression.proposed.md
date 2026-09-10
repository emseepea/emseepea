---
status: "proposed"
date: 2026-09-10
human-oversight: confirmed
oversight-date: 2026-09-10
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-10
---

# Capability-Local Static Discovery Suppression

## Context and Problem Statement

Some marketplaces approve and publish a server version against the capability
catalogue submitted for review. Removing a capability before the replacement
version is approved can break clients still using the approved version, while
leaving the capability discoverable means a newly approved version continues to
advertise it and cannot complete its retirement.

Em See Pea therefore needs a backwards-compatible intermediate lifecycle state:
a tool, static resource, resource template, or prompt remains registered and
callable for compatibility, but is omitted from MCP list discovery. A safe
retirement can then publish a visible version, submit and publish a
hidden-but-callable version, and only later publish a version in which the
capability is removed and no longer callable.

This lifecycle suppression is distinct from disabling a capability and from
permission-shaped discovery. Disabled capabilities are absent and rejected.
Permission-hidden capabilities are unavailable to that principal. A
lifecycle-hidden capability remains callable by a client that already knows its
name or URI, subject to its unchanged access policy.

## Decision Drivers

- Preserve current discovery behaviour unless an adopter explicitly opts out.
- Keep discovery and invocation derived from one immutable startup compilation.
- Make the retirement state explicit beside the capability being retired.
- Apply identical semantics to explicit and filesystem-discovered capabilities.
- Cover tools, static resources, resource templates, prompts, and completion.
- Preserve authentication and authorization for direct calls.
- Keep list ordering, pagination, and cursors deterministic.
- Avoid runtime response filtering, callbacks, and duplicate manifests.

## Considered Options

1. **Capability-local static discovery flag**: add `discoverable?: boolean` to
   each capability definition, default it to `true`, and compile separate
   immutable discovery and invocation projections from the same definitions.
2. **Server-level typed suppression set**: add a validated suppression set of
   typed capability identities to `createEmseepea`, reject unknown or duplicate
   identities at startup, and compile the two projections from it.
3. **Explicit suppression wrapper**: add
   `suppressFromDiscovery(capability)` to mark an already-defined capability
   before startup compilation.

## Decision Outcome

Chosen option: **"Capability-local static discovery flag"**, because it is the
smallest public API, keeps retirement intent with the definition, and avoids
repeating capability identities in deployment composition.

Tool, resource, resource-template, and prompt definitions accept
`discoverable?: boolean`. Omission and `true` preserve current behaviour;
`false` selects the hidden-but-callable lifecycle state. The flag is static for
the server version and is compiled before the server accepts requests.

Startup compilation derives two immutable projections from the same checked
definitions. The callable registry retains every registered capability and
continues to drive method support, dispatch, validation, authentication, and
authorization. The effective discovery catalogue contains only capabilities
whose flag is not `false` and drives `tools/list`, `resources/list`,
`resources/templates/list`, and `prompts/list`.

`server/discover` continues to advertise a protocol category when the callable
registry supports it, even if every capability in that category is hidden. Its
corresponding list method returns an empty catalogue. This lets an already-known
tool, resource, resource template, or prompt remain callable without exposing
its identity through list discovery.

Completion for a known hidden prompt or resource template remains callable and
inherits that capability's existing access policy. Suppression grants no new
access: public capabilities remain public, protected capabilities still require
their declared scopes, and authentication and authorization happen before any
handler or completion callback.

Lifecycle suppression applies in both public and protected discovery.
Permission filtering is applied after lifecycle suppression only when protected
discovery is configured. A lifecycle-hidden capability remains directly
callable under its access policy; a capability hidden from a principal by
permissions remains unavailable to that principal. Direct-call errors must not
leak or bypass either boundary.

The effective discovery catalogue is precomputed, deterministically ordered,
and used to compile pagination and cursors. Explicitly registered and
filesystem-discovered definitions use the same flag and compilation path. No
per-request callback, middleware, clock, randomness, or external input may
alter lifecycle visibility.

The retirement sequence is:

1. Publish the capability as visible and callable.
2. Set `discoverable: false`, submit that version for marketplace approval, and
   publish it after approval. The capability is hidden but remains callable.
3. After the hidden version is the supported marketplace version, remove the
   capability and publish a version in which it is neither discoverable nor
   callable.

## Consequences

### Good

- Marketplace review no longer traps obsolete capabilities in discovery.
- Existing clients can continue direct calls during the compatibility window.
- The default is source-compatible and behaviour-compatible.
- One definition remains the source for discovery and invocation projections.
- Retirement intent is visible in explicit and filesystem-discovered modules.

### Neutral

- The same capability has separate discovery and invocation lifecycle states.
- Hidden capabilities still count when advertising callable protocol support.
- Operators decide when marketplace adoption is sufficient to remove a hidden
  capability.

### Bad

- A hidden capability remains an intentionally supported and secured API until
  the later removal release.
- A client that already knows an identifier can continue to call it, so this is
  not a secrecy or authorization control.
- Tests and documentation must distinguish lifecycle-hidden,
  permission-hidden, disabled, and unknown capabilities.

## Confirmation

- Omitting `discoverable` and setting it to `true` produce the current catalogue
  and direct-call behaviour byte for byte.
- Setting `discoverable: false` omits the exact entry from `tools/list`,
  `resources/list`, `resources/templates/list`, or `prompts/list` while its
  direct call, read, or get still succeeds under the unchanged access policy.
- Completion for a known hidden prompt or resource template remains available
  and retains the parent capability's access policy.
- Public and protected lifecycle-hidden capabilities remain subject to their
  existing authentication and authorization rules, with zero handler or
  completion calls after an authorization failure.
- Protected discovery first removes lifecycle-hidden entries and then applies
  principal permission filtering without exposing either hidden set.
- A category containing only lifecycle-hidden capabilities remains advertised
  by `server/discover`; its list method returns the correct empty result while a
  known direct call succeeds.
- Tools, static resources, resource templates, and prompts have ordinary tests
  for visible, hidden-but-callable, and removed states.
- Explicit arrays and deterministic filesystem discovery produce identical
  lifecycle suppression, ordering, public contracts, and invocation behaviour.
- Paginated discovery never includes hidden entries, and its stable cursors are
  compiled from the effective discovery catalogue.
- Startup still rejects duplicate or invalid registrations independently of
  their discovery flag.
- An end-to-end compatibility check proves the sequence visible and callable,
  then hidden but callable, then removed and uncallable.
- Published documentation states that discovery suppression is a retirement
  mechanism, not an authorization or secrecy mechanism.

## Pros and Cons of the Options

### Capability-Local Static Discovery Flag

- Good: Uses one optional field, defaults safely, and keeps intent beside the
  capability without another identity list or abstraction.
- Bad: Widens each public capability-definition type with a lifecycle concern.

### Server-Level Typed Suppression Set

- Good: Centralizes the deployment's retirement policy and leaves definition
  shapes unchanged.
- Bad: Repeats identities away from their definitions and adds startup checks
  for stale, unknown, or incorrectly typed entries.

### Explicit Suppression Wrapper

- Good: Leaves definition object shapes unchanged and can wrap any capability
  kind uniformly.
- Bad: Adds an abstraction, can obscure intent in discovered modules, and makes
  accidental double wrapping another state to define and validate.

## Reassessment Criteria

Reassess if MCP standardizes capability lifecycle visibility, a marketplace
provides a reliable retirement handshake that removes the compatibility window,
adopters demonstrate a need to vary lifecycle visibility without publishing a
new server version, or the capability-local flag cannot express a newly added
discoverable MCP primitive.
