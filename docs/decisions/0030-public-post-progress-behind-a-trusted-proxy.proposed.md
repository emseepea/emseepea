---
status: "proposed"
date: 2026-08-30
human-oversight: confirmed
oversight-date: 2026-08-31
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-30
supersedes: ["ADR-0002"]
---

# Public POST Progress Behind a Trusted Proxy

## Context and Problem Statement

Em See Pea already supports bounded Model Context Protocol (MCP) progress
updates for local servers. The
current production profile rejects all streaming because the first production
decision covered only one anonymous server behind a trusted HTTPS proxy.

The framework is for adopters to build deployable MCP servers. A public tool
should be able to send progress through a normal reverse proxy, and separate
server instances should be able to handle separate requests without sharing
stream state. This must not imply session recovery, shared rate limits, replay,
subscriptions, or signed-in streaming.

The change also needs realistic load evidence. Local measurements are useful
for diagnosis, but the qualifying load test must run through continuous
integration (CI) in GitHub Actions. It must run on every supported Node.js
version and on the exact release revision.

## Decision Drivers

- Let adopters deploy public tools that send progress updates.
- Keep every POST request owned by one selected server instance from start to
  finish.
- Preserve exact proxy, authority, origin, HTTPS, request-limit, deadline, and
  cancellation checks.
- Prove that concurrent streams remain separate through a real reverse proxy.
- Run correctness and load qualification in CI on Node.js 22 and 24.
- Avoid shared state, session affinity, replay, and new infrastructure until a
  demonstrated use case requires them.
- Keep tools that require sign-in non-streaming until that path has its own
  security evidence.

## Considered Options

1. **Public POST progress through a trusted proxy** - Allow bounded progress for
   public tool calls while one selected instance owns each request.
2. **Keep progress local only** - Retain the current production restriction.
3. **Enable every streaming mode** - Also enable signed-in streaming,
   subscriptions, replay, and recovery.
4. **Build a shared streaming service** - Add distributed stream state before
   allowing any production progress.

## Decision Outcome

Chosen option: **"Public POST progress through a trusted proxy"**, because a
POST-scoped stream does not require shared state. A reverse proxy can select an
instance and that instance can own the response until it ends.

The `production-behind-proxy` profile may enable bounded progress only for
public tool calls. Tools that require sign-in remain non-streaming in that
profile until separately designed and qualified.

All existing production boundary checks remain. The connected proxy must be
trusted by exact address. The framework checks forwarded HTTPS and the public
address before application code runs. It also checks the request's origin,
limits, deadline, and cancellation state.

Each POST request is handled from start to finish by one server instance. A
load balancer may choose a different instance for the next request. Instances
do not exchange progress events, and Em See Pea does not promise recovery or
replay after a connection ends.

The framework's request limiter remains per instance. Adopters that need a
limit shared across instances must enforce it at the proxy or provide shared
infrastructure. This decision does not make a distributed rate-limit claim.

The existing event count, event size, final response size, deadline, and
cancellation limits apply. This decision does not enable GET streams or
`subscriptions/listen`.

The qualifying load scenario runs in GitHub Actions on Node.js 22 and 24. It
sends concurrent progress requests through a real local reverse proxy to two
independent server processes and checks every stream. A local run does not
replace this CI evidence.

This decision replaces the no-streaming and single-instance limits in the
earlier trusted-proxy decision. Its trust rules and narrow anonymous production
boundary remain in force.

## Consequences

### Good

- Public tools can report useful progress in normal proxy deployments.
- Separate requests can use separate instances without a shared stream store.
- CI checks the real proxy path under concurrent load on every supported Node
  version.
- The deployment claim stays smaller than sessions, replay, subscriptions, or
  signed-in streaming.

### Neutral

- The proxy owns request routing and keeps each response connected to its
  selected instance.
- Rate limits are still per instance unless the adopter enforces a wider limit.
- The load scenario proves bounded behavior and isolation, not a general
  throughput promise for every deployment.

### Bad

- A broken proxy that buffers streaming responses can still harm progress
  delivery.
- A lost connection loses its in-progress events.
- Signed-in tools cannot use production progress yet.
- Two-instance qualification does not prove arbitrary distributed topologies.

## Confirmation

- Configuration rejects production progress for tools that require sign-in.
- Black-box tests start a real reverse proxy and two independent Em See Pea
  server processes.
- The proxy selects instances across requests while one instance owns each
  response until completion.
- Concurrent public calls receive their own ordered progress events and final
  result without events crossing between calls or instances.
- The proxy receives the no-buffering response instruction and forwards the
  streamed response without collecting it first.
- Invalid forwarding data is rejected before any tool handler runs.
- Client disconnection cancels work in the selected instance.
- Event count, event size, final response size, deadline, and cancellation
  limits remain enforced under load.
- The proxy load scenario runs in the pull-request and exact-release workflows.
- The scenario runs on Node.js 22 and 24.
- Every request completes correctly and memory stays within the limit printed
  by the test.
- The job fails if an event appears in the wrong request stream, is missing,
  appears twice, arrives after the final result or cancellation, or exceeds its
  size limit.
- The existing performance limits for ordinary JSON requests remain unchanged
  and continue to run in the same CI jobs.
- Public documentation describes only POST-scoped public progress and passes
  cognitive accessibility review.
- No session, replay, shared-rate-limit, signed-in-streaming, GET-streaming, or
  subscription capability is advertised.

## Pros and Cons of the Options

### Public POST Progress Through a Trusted Proxy

- Good: Delivers the needed deployment behavior with no shared state.
- Bad: Does not recover a stream after disconnection.

### Keep Progress Local Only

- Good: Requires no change to the first production boundary.
- Bad: Makes the streaming example unsuitable for real proxy deployments.

### Enable Every Streaming Mode

- Good: Exposes the broadest feature set immediately.
- Bad: Combines distinct security and resource-control problems without
  evidence.

### Build a Shared Streaming Service

- Good: Could support recovery and coordinated distributed behavior later.
- Bad: Adds infrastructure that POST-scoped progress does not need.

## Reassessment Criteria

Reassess when an adopter needs signed-in production progress, reconnect and
replay, GET streams, subscriptions, a globally shared rate limit, more complex
proxy routing, or a formal streaming throughput promise.
