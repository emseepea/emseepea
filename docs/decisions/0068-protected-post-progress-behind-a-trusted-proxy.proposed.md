---
status: "proposed"
date: 2026-09-10
human-oversight: confirmed
oversight-date: 2026-09-10
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-10
supersedes: ["ADR-0030"]
---

# Protected POST Progress Behind a Trusted Proxy

## Context and Problem Statement

Em See Pea supports protected tool calls and supports Model Context Protocol
(MCP) progress from public tools
deployed behind a trusted proxy. It currently rejects a tool that combines both
features in production. A protected tool should be able to report progress after
the framework has authenticated and authorized its POST request.

## Decision Drivers

- Authenticate and authorize before a handler or progress stream begins.
- Preserve the existing trusted-proxy production boundary.
- Keep progress on the admitted POST response and one selected server instance.
- Preserve finite event, byte, time, memory, cancellation, and result limits.
- Avoid a second identity boundary, session state, replay, or distributed claims.

## Considered Options

1. **Allow protected POST progress after framework authentication**: complete
   authentication and authorization, then stream bounded progress and one checked
   final result on the same POST response.
2. **Keep protected progress local-only**: continue rejecting protected
   streaming tools in production.
3. **Trust proxy identity headers**: let the reverse proxy supply identity to
   the tool instead of using the framework authentication contract.

## Decision Outcome

Chosen option: **"Allow protected POST progress after framework authentication"**.

The production-behind-proxy profile allows a protected streaming tool only
after all existing request checks succeed. The framework checks the exact trusted
proxy address, one forwarded client address, forwarded HTTPS, allowed authority,
allowed origin, request size, MCP method and headers, and per-instance rate limit
before authentication or application work.

Framework authentication then validates the token issuer, audience, expiry,
intended resource, and required scopes. Missing, invalid, wrong-resource, or
insufficient credentials return the existing bounded JSON bearer challenge.
They cause zero handler and progress calls. No server-sent events (SSE) response
begins before authentication and authorization finish.

The checked caller identity, called the normalized principal, is fixed to the
admitted POST operation. Bearer tokens, raw provider claims, and provider errors
never reach handlers, events, results, or framework observability. The framework
does not automatically add principal details to emitted data. Any application
that deliberately exposes normalized principal fields owns that disclosure, and
the fields must pass the declared event or result checks. Authentication happens
once after the request checks succeed.
This decision adds no mid-stream reauthentication or token-replay behavior.

One selected server instance owns the authentication context, progress events,
terminal error or final result, and cancellation for the response lifetime.
Progress remains strictly increasing and subject to the existing event-count,
event-byte, final-result-size, pending-work, deadline, verifier-deadline,
slow-reader, disconnect, shutdown, and cancellation limits. No progress can
follow a terminal result. The response retains `X-Accel-Buffering: no`, and the
proxy remains responsible for forwarding rather than collecting frames.

Rate limiting remains per instance. This decision does not add GET streams,
sessions, shared stream state, affinity, recovery, replay, subscriptions, or a
distributed rate-limit claim. Public and protected discovery remain unchanged.
No throughput or latency claim is made for protected progress.

If ratified, this decision replaces ADR-0030's public-only restriction while
retaining its proxy, isolation, resource-control, continuous integration (CI),
and documentation rules. ADR-0010 continues to govern the bounded POST progress
state machine.

## Consequences

### Good

- Protected deployed tools can report useful progress.
- Authentication and streaming keep one checked request boundary.
- No new transport, session service, or identity mechanism is introduced.

### Neutral

- Authentication completes before the first progress event.
- Each process continues to enforce its own request rate limit.

### Bad

- A disconnected stream cannot be recovered or replayed.
- A buffering or misconfigured proxy can still delay progress delivery.

## Confirmation

- Invalid proxy, forwarding, HTTPS, authority, origin, request-size, method,
  header, and rate-limit inputs fail before authentication or application work.
- Missing, invalid, wrong-resource, expired, or insufficient credentials return
  the bounded JSON bearer challenge and cause zero handler and progress calls.
- Authentication and authorization finish before SSE headers or events begin.
- Valid protected calls receive strictly ordered bounded progress and exactly one
  checked final result through a real non-buffering proxy.
- Concurrent calls routed to two server processes never exchange principals,
  events, errors, final results, or cancellation.
- Tests fail on a wrong, missing, duplicate, oversized, or late event.
- Slow readers, operation and verifier deadlines, disconnect, cancellation, and
  shutdown terminate work and leave no detached progress producer.
- Load qualification runs in pull-request and exact-release CI on Node.js 22 and
  24 and enforces the existing sampled resident set size (RSS) and retained-heap
  ceilings.
- The official MCP client and an independent raw HTTP client both complete the
  protected progress journey from clean installs.
- Public documentation claims only protected POST-scoped progress and explicitly
  excludes sessions, subscriptions, replay, recovery, shared stream state, and
  distributed rate limiting.

## Pros and Cons of the Options

### Allow Protected POST Progress After Framework Authentication

- Good: combines two existing checked capabilities without another protocol.
- Bad: increases the production security and load qualification surface.

### Keep Protected Progress Local-Only

- Good: leaves the current production restriction unchanged.
- Bad: deployed protected tools cannot report incremental progress.

### Trust Proxy Identity Headers

- Good: could reduce framework authentication work.
- Bad: creates a second identity boundary and weakens the normalized-principal
  contract.

## Reassessment Criteria

Reassess when MCP changes its progress transport, an adopter needs replay or
cross-instance recovery, or measured evidence supports a protected-stream
performance budget.
