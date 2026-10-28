---
status: "proposed"
date: 2026-10-28
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2027-01-28
---

# Coexistence with Application HTTP Instrumentation

## Context and Problem Statement

[Outcome #208](https://github.com/emseepea/emseepea/issues/208) requires an
application with existing HTTP instrumentation to add Em See Pea without
another SERVER span obscuring its trace. ADR-0128 starts a framework SERVER
span from HTTP headers. Standard HTTP instrumentation also creates a SERVER
span, so those spans become siblings under the incoming parent.

## Decision Drivers

- Keep one transport SERVER span and a coherent framework/backend trace.
- Follow active local OpenTelemetry context without requiring extra configuration.
- Import only validated local trace identity, with no ambient baggage or other
  application context data.
- Preserve application ownership of transport spans, providers and shutdown.

## Considered Options

1. Reuse valid active local context by default, with an explicit opt-out.
2. Require an explicit declaration of application-owned HTTP instrumentation.
3. Retain two independent SERVER spans.

## Decision Outcome

Chosen option: **"Reuse valid active local context by default"**.
Following the user-approved correction in
[outcome #215](https://github.com/emseepea/emseepea/issues/215),
`openTelemetry()` uses the active local span as its parent. This follows the
application's active context; it does not establish which instrumentation
created that span. `useActiveSpan: false` explicitly selects HTTP-header
extraction instead.

`useActiveSpan` defaults to true. The deprecated `httpInstrumentation` alias
retains explicit true/false behavior when `useActiveSpan` is omitted. When both
are supplied, `useActiveSpan` takes precedence.

At request admission, project validated local trace ID, span ID and flags into
ROOT_CONTEXT and create an INTERNAL `mcp.request` child. Exclude baggage,
opaque trace state and arbitrary context entries. Preserve unsampled local
parents. Never modify, decorate or end the application's transport span.

If active context is missing, remote, invalid or unavailable, use the existing
bounded HTTP-header extraction and SERVER fallback. The explicit opt-out retains that
same behavior. Telemetry failures cannot suppress or repeat protocol work.

Keep backend work under the framework span. Metrics and optional completion
logs correlate with that framework span's validated local identity. Timing
continues to describe framework HTTP lifetime, not a separate MCP operation.

This decision amends only ADR-0128's unconditional parent selection and span
kind. Its request lifecycle, privacy and failure-isolation requirements remain.
No public adapter lifecycle API or framework-owned SDK is introduced.

## Consequences

- Applications can retain HTTP instrumentation and see a useful framework
  INTERNAL child instead of another SERVER span.
- The application must enable instrumentation before loading the HTTP server.
- Transport instrumentation has its own capture policy; framework redaction
  does not cover its attributes.
- The framework cannot verify the provenance of an arbitrary active local span.

## Confirmation

- Real standard HTTP instrumentation exports one transport SERVER span, a
  framework INTERNAL child and an asynchronous backend descendant.
- Controlled incoming parents, default reuse, explicit opt-outs, alias precedence, fallback, context isolation and
  unsampled parent behavior are checked at the public HTTP boundary.
- The installed-package guide exports traces, HTTP metrics and correlated logs
  and retains application-owned shutdown.
- Required source, release and live website checks establish delivery; the
  Wednesday-afternoon deadline does not waive them.
