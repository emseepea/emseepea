---
status: "proposed"
date: 2026-09-09
human-oversight: confirmed
oversight-confirmed-date: 2026-09-09
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
supersedes: [0012-typed-operations-and-opentelemetry-boundary]
reassessment-date: 2026-12-09
---

# Typed Operations with Framework-Redacted Observability Adapters

## Context and Problem Statement

Logging, metrics, and tracing are independent of an MCP server's application
shape. OpenTelemetry is useful, but making it the only framework boundary does
not let a generated project send safe structured events directly to another
logging system. Letting arbitrary logging plugins inspect requests would expose
tokens, arguments, results, URLs, and backend failures that the framework has
promised to keep private.

## Decision Drivers

- Compose observability with every initializer without creating variants.
- Let adopters use OpenTelemetry, structured logs, or both.
- Keep redaction and bounded event shape under framework control.
- Prevent observability adapters from changing protocol results.
- Prevent general lifecycle hooks from bypassing the checked request kernel.
- Bound event cardinality, size, delivery, shutdown, and flush behaviour.

## Considered Options

1. **Framework-redacted observability adapters**: emit typed, immutable, safe
   events to explicitly configured adapters, including OpenTelemetry as one
   adapter.
2. **OpenTelemetry-only boundary**: retain the current boolean telemetry option
   and require every sink to use an OpenTelemetry provider.
3. **Raw logger and middleware plugins**: expose request lifecycle objects to
   arbitrary plugins.
4. **Application-owned logging**: remove framework observability and let each
   capability log its own work.

## Decision Outcome

Chosen option: **"Framework-redacted observability adapters"**, because one
safe event boundary supports common destinations without giving adapters access
to sensitive request or backend data.

`createEmseepea` accepts a typed observability extension list. Each adapter has
a unique identifier and receives only framework-created immutable structured
events. Multiple adapters with unique identifiers may coexist. Duplicate
identifiers fail during startup.

Safety configuration is parsed once into typed immutable values with explicit
defaults and bounds. Missing, invalid, or out-of-range safety configuration
fails startup or readiness. Liveness reports process health. Readiness reports
whether the enabled profile can honour its claims. Neither endpoint exposes
application data or backend details.

The event schema contains only allowlisted, bounded, low-cardinality fields
such as the MCP method, public capability name when applicable, normalized
outcome, valid HTTP status, and bounded duration. Adapters never receive request
or response objects, bodies, headers, arguments, results, tokens, credentials,
URLs, raw errors, provider claims, or backend details. The framework performs
redaction before adapter dispatch, so a destination adapter cannot opt out.

OpenTelemetry remains supported as an observability adapter. A structured-log
adapter can forward the same safe events to a caller-supplied sink. The
framework does not provide a generic lifecycle plugin capable of changing
authentication, authorization, validation, dispatch, or protocol output.

Adapter exceptions and exporter failures never change protocol status or body.
Delivery and flush operations are bounded. Shutdown stops admission, completes
or cancels request work within its existing deadline, drains outstanding work
within the configured bound, and gives each configured adapter a bounded flush
opportunity without allowing one adapter to block the others indefinitely.

The overall qualified HTTP path remains within the existing 5 millisecond p95
CPU, 256 KiB p95 transient allocation, and 2 KiB average telemetry and network
overhead limits. Any separate adapter claim requires a pinned reproducible
profile and stated percentile before publication.

## Consequences

### Good

- Any initializer can add safe logging, metrics, or tracing independently.
- OpenTelemetry remains available without being the only destination.
- Redaction is consistent because adapters never see sensitive source data.
- Multiple sinks can consume one framework-owned event contract.

### Neutral

- Adopters configure the destination and its credentials outside Em See Pea.
- Existing telemetry configuration is replaced during the pre-alpha period.

### Bad

- Custom log enrichment is limited to fields the safe event contract permits.
- Each adapter needs bounded failure and flush qualification.
- The framework owns a small public event schema that must remain compatible.

## Confirmation

- Every maintained initializer documents and tests optional observability
  composition without maintaining another template variant.
- OpenTelemetry and structured logging adapters consume the same safe event
  contract.
- Two adapters with unique identifiers receive the expected event once and in
  stable order.
- Duplicate adapter identifiers fail during startup.
- Invalid, missing, and out-of-range safety configuration fails closed.
- Liveness and readiness expose no application data and reflect the exact
  enabled profile and dependency state.
- Tests prove adapters never receive bodies, headers, arguments, results,
  tokens, credentials, URLs, raw errors, provider claims, or backend details.
- Adapter and exporter failures leave protocol status and body unchanged.
- Slow or failed flush operations remain bounded and cannot prevent other
  adapters from receiving their flush opportunity.
- Shutdown tests prove admission stops and outstanding work drains or cancels
  within the configured deadline before bounded adapter flushing finishes.
- No public adapter can register lifecycle hooks or bypass authentication,
  authorization, validation, limits, cancellation, or safe errors.
- README, website, API reference, standalone generated-project checks, semantic
  evaluation where model-visible behaviour changes, software bills of
  materials, provenance, registry checks, and exact-release checks reflect the
  adapter model.
- Measured CPU, allocation, and event-size evidence meets the existing
  whole-request performance budget and any separately published adapter claim
  before release.

## Pros and Cons of the Options

### Framework-Redacted Observability Adapters

- Good: Supports multiple destinations while preserving one enforceable privacy
  boundary.
- Bad: Cannot offer unrestricted request logging or arbitrary enrichment.

### OpenTelemetry-Only Boundary

- Good: Reuses one established ecosystem standard.
- Bad: Makes direct structured logging unnecessarily difficult.

### Raw Logger and Middleware Plugins

- Good: Gives adapters complete flexibility.
- Bad: Exposes sensitive data and permits ordering or kernel-bypass errors.

### Application-Owned Logging

- Good: Removes framework adapter code.
- Bad: Duplicates logging across capabilities and cannot support framework-wide
  redaction or request lifecycle evidence.

## Reassessment Criteria

Reassess if OpenTelemetry or MCP defines a safe structured event contract that
fully replaces this boundary, or if measured adapter cost exceeds the qualified
performance budget.
