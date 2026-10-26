---
status: "proposed"
date: 2026-10-26
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2027-01-26
---

# Request-lifetime OpenTelemetry Context

## Context and Problem Statement

[Outcome #186](https://github.com/emseepea/emseepea/issues/186) requires operators
to follow an MCP request into instrumented backend work. The current adapter
creates its span after the response finishes, so its span duration does not
measure the request and backend work cannot inherit it. The duration histogram
already measures the request correctly.

## Decision Drivers

- Measure the request from admission through response completion or disconnect.
- Continue incoming trace context and activate it through asynchronous work.
- Preserve the privacy and failure-isolation requirements of ADR-0065.
- Keep providers, context management, propagation and export application-owned.

## Considered Options

1. Framework-owned request tracing with the existing adapter opt-in.
2. Public adapter lifecycle callbacks for starting and activating spans.
3. Keep spans created after request completion.

## Decision Outcome

Chosen option: **"Framework-owned request tracing"**. The existing `openTelemetry()`
adapter opts into private tracing behavior. Its preserved `emit` function
identifies this behavior across adapter normalization; the public adapter ID
does not grant lifecycle access. Public contract changes remain possible when
they add concrete adopter value. Lifecycle callbacks add ordering and failure
semantics without an established need for this outcome.

Start the server span at the framework's HTTP request hook and continue Fastify
inside its active context. End it once through the existing guarded response
finish/disconnect path, independently of completion-event delivery. The adapter
continues to record metrics from the same redacted completion event.

Extract only bounded `traceparent` and `tracestate` using the application's
propagator, starting with a clean context. Retain only a validated span context;
do not import baggage or arbitrary propagation state. Incoming trace identity
is caller-controlled correlation data and grants no identity or permission.

Protect extraction, span creation, context activation and finalization from
telemetry failures. Fallback must never invoke protocol work twice. Ordinary
adapters continue to receive only the existing redacted completion event.

The application configures its asynchronous context manager, trace propagator,
providers and exporter before creating the adapter. Backend instrumentation is
also application-owned and has its own data-capture policy. The framework's
redaction guarantee applies to framework spans and events.

## Consequences

- Operators can inspect elapsed time and backend child spans in the same trace.
- Existing logging adapters need no request-lifecycle interface.
- Applications must configure context management and propagation to obtain
  connected traces; enabling the adapter alone does not instrument backends.

## Confirmation

- Real HTTP tests cover request timing, incoming parents, asynchronous backend
  children, overlapping requests, missing/invalid context, streamed responses,
  disconnects and throwing telemetry components.
- Existing redaction, disabled behavior and protocol checks remain required.
- The guide includes checked setup and flush responsibilities.
- Repository tests and performance checks determine qualification; the
  Wednesday deadline does not waive them.
