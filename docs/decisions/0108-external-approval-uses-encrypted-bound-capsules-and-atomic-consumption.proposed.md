---
status: proposed
date: 2026-10-04
human-oversight: pending
decision-makers: [Tom Howard]
consulted: [Architecture review]
informed: []
reassessment-date: 2027-01-04
---

# External Approval Uses Encrypted Bound Capsules and Atomic Consumption

> Captured via wr-architect:capture-adr from the approved external approval
> direction. Derived substance remains provisional; actual production-use
> evidence is outstanding.

## Context and Problem Statement

An adopter needs an authenticated external page to confirm a tool's exact
effect when its client cannot perform native form elicitation. ADR-0072's
readable signed request state intentionally provides neither confidentiality
nor single-use effect approval. Its confidentiality and replay reassessment
trigger has been reached; the existing signed-state contract remains unchanged.

## Decision Drivers

- Business payloads must not enter persistent approval records or access logs.
- Approval must bind the authenticated person and the exact proposed effect.
- Multiple processes and restarts must not permit double consumption.
- The adopter retains authentication, CSRF, permissions and effect execution.
- Ordinary servers must remain unchanged unless explicitly configured.

## Considered Options

1. **Separate encrypted external-approval broker (chosen).** An explicit
   producer API binds confidential transient proposals and uses an atomic
   hash-only store for decision and consumption.
2. **Reuse signed request state.** Keep the existing readable, replayable
   representation, which cannot meet this adopter's approval boundary.

## Decision Outcome

Chosen option: **separate encrypted external-approval broker**, because signed
request state must not acquire guarantees it does not provide.

The broker uses authenticated encryption, strict version and payload bounds,
and expiry. Its proposal binds principal, organisation scope, tool, normalized
input, computed effect and confirmation schema. The authenticated page records
approval or cancellation atomically. Consumption verifies the same binding
and expiry and succeeds once, or fails closed. Storage contains only hashes,
technical timestamps and decision state, not proposal or submitted form data.

No route, native input response, provider effect, retry or permission is
created by configuring this primitive. The adopter owns the authenticated
page, CSRF, safe fragment transport, effect freshness, permission checks and
idempotent execution. A broker approval is not proof those checks passed.

## Consequences

### Good

- Confidential approval state is distinct from readable protocol request state.
- Durable atomic consumption supports multiple processes without local locks.
- Existing servers incur no runtime work unless they opt into this boundary.

### Neutral

- Adopters provide shared secret management and an atomic storage adapter.

### Bad

- New cryptographic and storage boundaries require additional qualification.
- Storage unavailability prevents approval rather than permitting a write.
- A consumed approval alone cannot establish a provider effect's outcome.

## Confirmation

- Public-interface tests reject tampering, wrong keys and bindings, oversized
  or expired state, cancellation and concurrent replay.
- Shared-store tests prove restart and multiple-instance use, with no business
  payload in approval records.
- Actual adopter production use demonstrates that the same approved effect
  executes only after explicit approval. That evidence is outstanding.

## Pros and Cons of the Options

### Separate encrypted external-approval broker

- Good: supplies the requested confidentiality and one-time decision boundary.
- Bad: adds an opt-in public security contract and durable storage dependency.

### Reuse signed request state

- Good: requires no new API.
- Bad: readable, replayable state cannot establish confidential approval.

## Performance Review

Dormant exports add zero work to existing server requests. Broker operations
add encryption and atomic storage access when explicitly invoked. No measured
workload or performance budget yet covers those operations; no latency or
throughput claim is made.

## Reassessment Criteria

Reassess if native confirmation removes the adopter need, if the MCP standard
defines a compatible verified external channel, or if real use exposes unsafe
replay, retention, expiry or storage behaviour.
