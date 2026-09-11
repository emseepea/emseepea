---
status: "proposed"
date: 2026-09-11
human-oversight: confirmed
oversight-date: 2026-09-11
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-11
---

# Opt-In Integrity-Protected Request State

## Context and Problem Statement

MCP 2026-07-28 allows an `input_required` result to carry `requestState` so a
client can return state on a later request. Em See Pea currently rejects that
standard result shape.

The returned value passes through the client and is therefore untrusted. The
protocol requires integrity protection when the state affects authorization,
resource access, or business logic. This increment decides whether Em See Pea
should support that protocol behavior and, if so, where its safety boundary
belongs.

This decision does not add retries, circuit breakers, sessions, replay
prevention, reconnect recovery, or effect idempotency.

## Decision Drivers

- Complete the next smallest missing part of MCP 2026-07-28.
- Make the safe path straightforward without inventing cryptography.
- Preserve the current stateless behavior by default.
- Authenticate and authorize every request round.
- Keep application data validation and effect safety application-owned.

## Considered Options

1. **Opt-in signed request state using the MCP SDK** - Add bounded request-state
   configuration and direct-handler context APIs backed by the installed SDK's
   HMAC codec.
2. **Keep rejecting request state** - Continue supporting stateless
   `input_required` results only.
3. **Pass through raw request state** - Let handlers receive and return the
   client-controlled string without framework verification.

## Decision Outcome

Chosen option: **"Opt-in signed request state using the MCP SDK"**.

Em See Pea adds one optional, immutable server setting containing an
operator-supplied key of at least 32 bytes, an explicit positive lifetime, and
a maximum wire size. It reuses the installed MCP SDK's HMAC request-state codec.
When the setting is absent, the existing stateless API and rejection remain
unchanged.

Direct tool, static-resource, resource-template, and prompt handlers gain the
ability to mint state and read verified decoded state. Both protocol-valid
`input_required` shapes are supported: state with input requests, and state
without input requests. Mapped tools, streaming tools, list methods,
completions, and subscriptions remain unchanged.

Em See Pea binds signed state to the MCP method and capability identity. For a
protected capability, it also binds the state to the normalized authenticated
principal. The same key must be available to every process that may receive a
later round.

The framework verifies state before application handler work. Malformed,
expired, oversized, or incorrectly bound state receives the SDK's fixed safe
Invalid Params response. The application handler sees only the verified decoded
value and remains responsible for validating its schema and version before use.

Signed state is readable by the client; it is not encrypted. It must not contain
secrets, credentials, private backend data, or authority to perform an effect.
Every round is authenticated and authorized normally. Signing and expiry do not
make state single-use, so applications must still protect effects against
duplicate execution where their use case requires it.

## Consequences

### Good

- Em See Pea supports the active protocol's stateful `input_required` shape.
- Default servers keep their current stateless behavior.
- Integrity, expiry, and request binding reuse the installed MCP SDK.
- Applications receive verified data without gaining false effect authority.

### Neutral

- Applications choose the state payload and validate its runtime shape.
- Multi-process deployments must share the configured key.

### Bad

- Stateful requests add key management and another bounded public API surface.
- Signed payloads are visible to clients and may be replayed until expiry.
- Stateful paths require additional security and interoperability tests.

## Confirmation

- With no request-state setting, current stateless behavior and public types do
  not change.
- Configured direct tools, static resources, resource templates, and prompts can
  return and resume both protocol-valid request-state shapes.
- The implementation uses the installed MCP SDK codec rather than custom
  cryptography.
- Keys shorter than 32 bytes and invalid lifetimes or size limits fail at
  startup.
- Tampered, expired, oversized, wrong-method, wrong-capability, wrong-principal,
  and wrong-key state fails before the handler runs with no sensitive detail.
- Protected handlers authenticate and authorize every round.
- Handlers receive verified decoded state and examples validate its application
  schema before use.
- Tests cover restart and multi-process use with the same configured key.
- Official-client and raw-HTTP tests pass from a packed clean install.
- Documentation states that signing is not encryption or replay prevention and
  that retry, circuit-breaker, and effect-idempotency behavior is application
  owned.

## Pros and Cons of the Options

### Opt-In Signed Request State Using the MCP SDK

- Good: Implements the standard behavior with an existing safe primitive.
- Bad: Requires configuration, handler APIs, and qualification.

### Keep Rejecting Request State

- Good: Adds no code or operational key.
- Bad: Leaves an active MCP result shape unsupported.

### Pass Through Raw Request State

- Good: Adds the smallest apparent API surface.
- Bad: Makes an attacker-controlled value easy to mistake for trusted state and
  fails the intended integrity boundary.

## Performance Review

Source: **no data - planning assumptions only**.

Assuming a 4 KiB state token and 100,000 stateful round trips per day, signing
and verification are provisionally estimated at 0.5 milliseconds of CPU and
16 KiB of transient allocation per round trip, plus about 8 KiB of network for
the emitted and echoed token. That is about 50 CPU-seconds, 1.53 GiB of
cumulative transient allocation, and 0.76 GiB of network per day.

These are workload assumptions, not measured ceilings or performance claims.
The stateful path remains unbudgeted until a pinned workload is measured.

## Reassessment Criteria

Reassess if the MCP protocol changes the request-state contract, the SDK codec
no longer meets it, measured limits are unsuitable for real applications, or
adopters demonstrate a need for confidentiality or replay prevention.
