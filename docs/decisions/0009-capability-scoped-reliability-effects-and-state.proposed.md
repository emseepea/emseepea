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

# Capability-Scoped Reliability, Effects, and State

## Context and Problem Statement

Deadlines, retries, effects, and state interact. A generic distributed-state or
retry layer introduced before a capability needs it would add complexity while
still failing to define ownership of side effects.

## Decision Drivers

- Work must stop when its request is no longer useful.
- Retries must not duplicate effects.
- Transaction ownership belongs with the backend that can guarantee it.
- Distributed state is justified only by an explicit multi-instance claim.

## Considered Options

1. **Capability-scoped reliability and state** - Apply common deadlines and
   cancellation, then add idempotency and atomic providers only where required.
2. **Universal retry and distributed-state framework** - Require shared machinery
   for every capability.
3. **Application-only reliability** - Leave all controls to handlers.

## Decision Outcome

Chosen option: **"Capability-scoped reliability and state"**.

Requests carry absolute deadlines and cancellation through handlers, workflows,
adapters, and outbound calls. Retries are bounded, deadline-aware, and allowed
only for classified transient failures and retry-safe operations. Effectful
operations require explicit idempotency semantics; adapters own transactions
because only they know the backend's atomic boundary.

Process-local state is permitted only under an exact single-instance claim.
Atomic shared providers are added capability by capability when a claimed
cross-instance behavior requires them. Required provider unavailability makes
readiness fail closed for that capability. No generic provider framework is
built in advance.

## Consequences

### Good

- Read-only paths avoid effect and distributed-state machinery.
- Side-effect guarantees align with real backend capabilities.
- Multi-instance claims remain exact.

### Neutral

- Different capabilities may reach distributed operation at different times.

### Bad

- Some adapters cannot offer exactly-once effects and must state a narrower claim.

## Confirmation

- Deadline expiry and disconnect cancellation stop all cooperating downstream work.
- Retry tests prove bounds, deadline adherence, and absence on unsafe effects.
- Idempotency races create at most the documented number of effects.
- Single-instance features are not advertised as multi-instance safe.
- Required shared-provider failure removes readiness before accepting dependent work.

## Pros and Cons of the Options

### Capability-scoped reliability and state

- Good: Adds complexity only where a guarantee needs it.
- Bad: Requires precise per-capability claims.

### Universal retry and distributed-state framework

- Good: Creates one infrastructure story.
- Bad: Is speculative and can hide backend limitations.

### Application-only reliability

- Good: Keeps the framework small.
- Bad: Makes cancellation and effects inconsistent.

## Reassessment Criteria

Reassess when two capabilities need the same proven shared provider boundary or
an adopter requires a stronger effect guarantee than an adapter can supply.
