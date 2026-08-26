---
status: "proposed"
date: 2026-08-27
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
---

# Performance Budget for the Initial JSON HTTP Boundary

## Context and Problem Statement

The guide proposes measurable JSON/tools budgets. Without a recorded baseline,
performance can be claimed vaguely or traded against safety. Streaming and
shared-state paths do not yet have enough implementation evidence for budgets.

## Decision Drivers

- Framework overhead must be separated from backend latency.
- Budgets must be reproducible and must not weaken validation or security.
- The first read-only JSON path is the only current measurable boundary.
- Numbers must be replaceable when adopter evidence proves them unsuitable.

## Considered Options

1. **Adopt the guide's provisional JSON/tools budget** - At least 100 requests
   per second, no more than 5 ms p95 framework CPU, no more than 256 KiB p95
   transient allocation, and no more than 2 KiB average telemetry/network overhead.
2. **Defer all budgets until implementation is complete**.
3. **Set budgets for every future capability now**.

## Decision Outcome

Chosen option: **"Adopt the guide's provisional JSON/tools budget"**.

The initial benchmark covers one synthetic read-only tool through the real
Fastify JSON HTTP boundary with a no-op local backend. It measures sustained
throughput, framework-only CPU time, transient allocation, and framework-added
telemetry/network overhead under a pinned machine, runtime, concurrency, payload,
and duration profile.

The provisional release gate is at least 100 requests per second, at most 5 ms
p95 framework CPU per request, at most 256 KiB p95 transient allocation per
request, and at most 2 KiB average framework-added telemetry/network overhead
per request excluding application result data. Invalid-input load must cause no
unbounded allocation, queue, retry, or telemetry-cardinality growth.
Correctness, validation, limits, and security are never removed to meet it.
Streaming, OAuth, effects, and shared-state budgets are deferred until their
own fronts have representative implementations.

## Consequences

### Good

- The first performance claim is measurable and bounded.
- Regressions are detected before optimization becomes guesswork.

### Neutral

- Results are meaningful only with their pinned benchmark profile.

### Bad

- Provisional numbers may not match every adopter's workload or hardware.

## Confirmation

- The benchmark command and environment are committed and reproducible from a clean checkout.
- Results separately report throughput, framework CPU, transient allocation, and added bytes.
- The baseline passes without disabling validation, limits, security, or telemetry redaction.
- Repeated runs include variance and do not hide failed or cancelled requests.
- Invalid-input load shows no unbounded allocation, queue, retry, or cardinality growth.
- No performance claim is made for an unbudgeted capability path.

## Pros and Cons of the Options

### Adopt the guide's provisional JSON/tools budget

- Good: Makes the first runtime claim falsifiable.
- Bad: Requires benchmark discipline before representative adopter data exists.

### Defer all budgets until implementation is complete

- Good: Avoids premature numbers.
- Bad: Allows regressions and vague claims through early releases.

### Set budgets for every future capability now

- Good: Creates a comprehensive table.
- Bad: Invents targets without implementations or workloads.

## Reassessment Criteria

Reassess when repeatable adopter evidence shows a target is irrelevant, hardware
normalization is inadequate, or a new capability path is ready for its own budget.
