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

Apply the bounded error-status mapping below to framework spans. Preserve
expected cancellation and existing completion-event contracts.

## Error classification amendment

[Outcome #219](https://github.com/emseepea/emseepea/issues/219) requires genuine
tool failures to appear in ordinary trace error filters. Apply this precedence
to the framework span when the response ends:

1. A disconnected response keeps its status unset and has no `error.type`.
2. A finished HTTP 5xx response sets ERROR and uses its finite status-code
   string as `error.type`.
3. Another finished tool error sets ERROR and `error.type: tool_error`, unless
   it is an HTTP 4xx response or admitted work was cancelled through the SDK
   request signal or the existing invocation/shutdown signal.
4. Success, expected cancellation and remaining client/protocol outcomes keep
   their status unset, without `error.type`.

A real local observation found that orderly shutdown and deadline expiry can
both finish HTTP 200 with the existing `tool_error` outcome. Keep a private
cancellation boolean in request observability state, derived from the existing
source signals in the tool catch. Do not inspect exception names, messages or
abort reasons. The framework's separate deadline controller remains a genuine
failure; an uncancelled handler-thrown `AbortError` is also a tool failure.

Keep public completion events and their outcome, metric and log schemas
unchanged. Error metadata belongs only to the framework span; never decorate
the application's parent. Omit status descriptions and exception events.
Protect error attributes, status and span finalization independently so a broken
telemetry component cannot suppress another signal or protocol work.

This amends classification within the existing HTTP request lifetime. It does
not claim full MCP operation semantic-convention compliance or introduce a new
operation timer. This decision remains proposed.

## Exported span naming amendment

Name the framework span from the existing normalized completion event at its
finish/disconnect boundary. A known MCP method with a registered capability
uses `tools/call read-status`; a known method without a registered capability
uses the method alone, such as `tools/call` or `tools/list`. An unknown or
unparsed method keeps `mcp.request`. Never copy unknown caller-supplied names
or raw resource URIs into span names.

The initial name remains `mcp.request` until completion. Head sampling therefore
cannot select on the final operation name. Only the framework span is renamed;
parent ownership, kind, identity, HTTP lifetime and error classification remain
unchanged. Public completion fields, the `mcp.request` log event and metric
names retain their existing meanings.

Protect `span.updateName` independently so a broken renamer cannot suppress
error decoration, finalization, adapter delivery or protocol execution. Update
exact generic-name queries to use the exported operation name or existing
attributes. This amendment remains proposed.

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
