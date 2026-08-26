---
status: "proposed"
date: 2026-08-27
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
---

# POST-Scoped Streaming, Progress, and Subscriptions

## Context and Problem Statement

Streaming adds partial emission, slow consumers, cancellation, and state. The
framework needs one bounded state machine without implying unsupported GET
streams, sessions, or replay.

## Decision Drivers

- Final results remain validated before completion.
- Queues and memory stay bounded under slow readers.
- Disconnects cancel useful work promptly.
- Subscription claims match their local or shared-state guarantees.

## Considered Options

1. **POST-scoped SSE with bounded state** - Stream progress and final results on
   the originating POST and add subscription routes only when qualified.
2. **Session and replay transport** - Add GET streams, resumability, and replay.
3. **Unbounded event buffering** - Preserve every event regardless of readers.

## Decision Outcome

Chosen option: **"POST-scoped SSE with bounded state"**.

Streaming uses POST-scoped SSE only. A checked state machine governs progress,
terminal errors, and the single validated final result. GET streams, transport
sessions, event replay, and implicit resumption are excluded.

Per-request queues, event sizes, heartbeat behavior, and lifetimes are bounded.
Overflow closes predictably and requires a fresh request rather than silently
dropping events. Disconnect and expiry cancel remaining work. Subscription
families begin with explicit process-local routing; shared atomic routing is
introduced only for a claimed multi-instance family.

## Consequences

### Good

- Streaming shares the request's authorization and cancellation boundary.
- Slow consumers cannot grow memory without bound.
- The claim does not imply replay semantics.

### Neutral

- Clients reconnect with a fresh request after overflow or interruption.

### Bad

- Durable resumable streams are not initially supported.

## Confirmation

- JSON and SSE paths produce the same validated final domain result.
- Slow-reader tests prove queue bounds and deterministic overflow termination.
- Disconnect, expiry, and cancellation stop downstream work.
- Progress cannot appear after a terminal result or error.
- Local subscriptions are never described as cross-instance or replayable.

## Pros and Cons of the Options

### POST-scoped SSE with bounded state

- Good: Adds streaming without a second session protocol.
- Bad: Has no replay after interruption.

### Session and replay transport

- Good: Supports resumability.
- Bad: Adds a large state and compatibility surface without current need.

### Unbounded event buffering

- Good: Avoids deliberate event loss.
- Bad: Is unsafe under slow or abandoned clients.

## Reassessment Criteria

Reassess when a real adopter requires durable replay or public MCP requirements
mandate a different stream lifecycle.
