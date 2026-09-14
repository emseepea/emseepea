---
status: "proposed"
date: 2026-09-14
human-oversight: confirmed
oversight-date: 2026-09-14
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
reassessment-date: 2026-12-14
---

# Always-Available Checked Model Context Protocol (MCP) Ping

> Captured with `/wr-architect:capture-adr`. The capturing agent derived the
> section content from the in-session decision context. Human oversight was
> confirmed by Tom Howard on 2026-09-14.

## Plain English Summary

Clients should be able to check whether an Em See Pea server is responsive by
sending the standard Model Context Protocol (MCP) `ping` request. The framework
should admit that request through its existing checked HTTP boundary and let the
official MCP server implementation return the standard empty result. It should
not add an application hook, authentication call, state, logging, or another
health-check design.

## Context and Problem Statement

The active MCP 2026-07-28 request vocabulary includes `ping`, and the installed
official server implementation already registers the standard handler. Em See
Pea's modern request filter currently admits only methods derived from configured
application capabilities, so a valid `ping` is rejected before it reaches that
handler.

This decision calls MCP version `2026-07-28` modern and calls earlier supported
protocol revisions legacy.

This leaves a small core protocol gap. Closing it should preserve every existing
transport and validation boundary while avoiding a second implementation of
behavior already supplied by the installed dependency.

## Decision Drivers

- Support the standard MCP liveness request on every modern Em See Pea server.
- Reuse the installed official MCP server's existing handler and result shape.
- Keep `ping` independent of registered tools, resources, prompts, and discovery
  visibility.
- Preserve origin, protocol-version, header, envelope, and body-size checks.
- Avoid application callbacks, authentication, mutable state, logging,
  progress, caching, and capability advertisement.
- Preserve existing legacy SDK behavior without extending deprecated features.

## Considered Options

1. **Always admit the official MCP ping handler (chosen)**: include `ping` in
   the modern framework method set and otherwise reuse the existing request
   path.
2. **Keep rejecting ping**: leave the framework's modern method filter
   unchanged.
3. **Add an application-configured health handler**: define new configuration,
   callback, state, and response behavior for an operation the installed MCP
   server already implements.

## Decision Outcome

Chosen option: **"Always admit the official MCP ping handler"**, because one
framework admission change exposes behavior already implemented by the pinned
official dependency without creating another public abstraction.

Every modern server admits a valid `ping` request after the normal HTTP and MCP
request checks. The installed MCP server supplies the standard empty result.
The request does not require or advertise an application capability.

`ping` invokes no application handler, authentication verifier, authorization
decision, progress reporter, client-logging path, cache, or mutable state. This
remains true when permission-shaped protected discovery is configured. The
request receives no special bypass for origin, protocol-version, `Accept`,
content type, custom-header, JSON-envelope, or request-size enforcement.

Legacy protocol requests retain their existing official-SDK behavior. This
decision does not change legacy compatibility rules and does not add client
logging, roots, sampling, tasks, sessions, list-change notifications, runtime
catalogue mutation, replay, reconnect, or a generic notification endpoint.

## Consequences

### Good

- Every modern server gains the standard protocol liveness operation.
- The implementation reuses the pinned dependency rather than duplicating its
  handler or result construction.
- Ping cannot expose application data or invoke application-owned work.

### Neutral

- The response proves that this MCP request path is responsive; it does not
  prove downstream dependency or application health.
- Protected-discovery configuration does not make ping an authenticated
  operation.

### Bad

- Ping creates an additional valid request path that clients may call at an
  unknown frequency.
- No existing performance budget specifically covers ping, so ratification
  accepts a bounded but initially unmeasured runtime risk.

## Confirmation

### Protocol Behavior

- A raw MCP `2026-07-28` `ping` request returns the official handler's checked empty
  result.
- Two independent clients using the official package pinned to MCP 2026-07-28
  complete the same operation.
- Ping succeeds when an application registers no tools, resources, or prompts.
- Protected-discovery configuration causes zero verifier, authorization, and
  application-handler calls for ping.

### Safety and Compatibility

- Invalid origin, protocol version, `Accept`, content type, custom headers,
  JSON-RPC envelope, and oversized body remain rejected by their existing
  checks.
- Ping emits no progress, logging, or cache activity and mutates no application
  state.
- Explicit qualification records the unchanged behavior of every supported
  legacy protocol revision.
- No deprecated or speculative protocol capability is added.

### Qualification

- Source, black-box, packed-package, and measured MCP `2026-07-28` performance checks pass from
  clean checkouts.
- A released-package journey independently verifies MCP `2026-07-28` `ping`, zero
  application and verifier calls, boundary rejection, and legacy behavior.
- Registry readback independently verifies the released package version,
  integrity, signatures, provenance, and downloaded-package behavior.

### Documentation

- Protocol coverage and package guidance describe ping as a core request, not
  as application health or a configurable capability.
- Deprecated client-logging, roots, and sampling guidance remains absent.

## Pros and Cons of the Options

### Always Admit the Official MCP Ping Handler

- Good, because it is the smallest change and relies on the pinned official
  implementation.
- Bad, because it opens a request path whose production call frequency is not
  yet known.

### Keep Rejecting Ping

- Good, because it requires no source change.
- Bad, because a valid core MCP request remains unavailable on modern servers.

### Add an Application-Configured Health Handler

- Good, because applications could define broader health semantics.
- Bad, because those semantics are not required for MCP ping and would add API,
  security, failure, and state decisions without a demonstrated need.

## Performance Review

Frequency source: **no data - worst-case assumption**.

The ratification assumptions are at most 5 ms added CPU, 256 KiB transient
allocation, and 0 added response bytes per request compared with today's
method-not-found response. At an assumed 100 requests per second, the aggregate
is at most 0.5 CPU-seconds per second, 25 MiB per second of transient allocation,
and 0 added outbound bytes per second.

These figures are conservative planning assumptions, not measured claims. No
existing performance budget specifically covers ping. Ratification accepts this
bounded ungoverned risk only until confirmation measures the MCP `2026-07-28` ping path;
no performance claim may be made before that profile is recorded.

## Reassessment Criteria

Reassess if the MCP ping contract changes, official-server behavior no longer
supplies the standard result, measured cost exceeds the ratified assumptions,
production frequency threatens service objectives, clients require downstream
health semantics, or protected ping requires authentication. Any reassessment
must preserve the checked request boundary and avoid exposing application data
by default.
