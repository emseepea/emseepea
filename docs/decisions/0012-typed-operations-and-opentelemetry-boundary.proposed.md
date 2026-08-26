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

# Typed Operations and OpenTelemetry Boundary

## Context and Problem Statement

Configuration, health, shutdown, and telemetry are part of framework behavior.
They must fail closed where safety depends on them without allowing observability
failure or sensitive data to affect application results.

## Decision Drivers

- Invalid safety configuration must prevent readiness.
- Operators need standard traces, metrics, and structured logs.
- Telemetry must not leak inputs, tokens, secrets, or backend details.
- Shutdown must stop admission and bound outstanding work.

## Considered Options

1. **Typed configuration and isolated OpenTelemetry boundary**.
2. **Loose environment access and bespoke metrics**.
3. **No framework operations surface**.

## Decision Outcome

Chosen option: **"Typed configuration and isolated OpenTelemetry boundary"**.

Configuration is parsed once into typed immutable values with explicit defaults
and bounds. Missing or invalid safety-critical values fail startup or readiness.
Liveness reports process health; readiness reports ability to honor enabled
claims without exposing application data.

OpenTelemetry is the framework telemetry boundary. Logs, metrics, and traces use
bounded low-cardinality attributes and default redaction. Application payloads,
tokens, credentials, and private backend errors are excluded. Exporter failure
does not change protocol results. Graceful shutdown stops admission, cancels or
drains within a deadline, flushes bounded telemetry, and terminates.

## Consequences

### Good

- Operations use maintained standards and fail predictably.
- Telemetry can fail without corrupting requests.
- Readiness reflects the exact enabled profile.

### Neutral

- Adopters configure an OpenTelemetry exporter if they want external telemetry.

### Bad

- Strict configuration rejects permissive legacy deployment habits.

## Confirmation

- Invalid, missing, and out-of-range safety configuration fails closed.
- Liveness and readiness expose no application data and reflect dependency failure.
- Redaction tests cover tokens, secrets, inputs, URLs, and backend errors.
- Exporter failure leaves protocol status and body unchanged.
- Shutdown tests prove admission stops and work ends within the configured deadline.

## Pros and Cons of the Options

### Typed configuration and isolated OpenTelemetry boundary

- Good: Reuses an ecosystem standard with enforceable redaction.
- Bad: Adds an optional operational dependency surface.

### Loose environment access and bespoke metrics

- Good: Is quick to start.
- Bad: Spreads parsing and creates proprietary instrumentation.

### No framework operations surface

- Good: Has no operational code.
- Bad: Prevents a supportable deployment claim.

## Reassessment Criteria

Reassess when OpenTelemetry cannot represent a required signal or a supported
deployment needs materially different health semantics.
