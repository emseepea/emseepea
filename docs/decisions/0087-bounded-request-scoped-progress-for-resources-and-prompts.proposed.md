---
status: "proposed"
date: 2026-09-14
human-oversight: confirmed
oversight-date: 2026-09-14
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
reassessment-date: 2026-12-14
---

# Bounded Request-Scoped Progress for Resources and Prompts

> Captured with `/wr-architect:capture-adr`. The capturing agent derived the
> section content from the in-session decision context. Human oversight was
> confirmed by Tom Howard on 2026-09-14.

## Plain English Summary

When an application is taking time to read a resource or prepare a prompt, it
should be able to send bounded progress updates to a client that asked for
them. Em See Pea should extend its existing progress mechanism to those two
operations without adding sessions, replay, recovery, or mutable catalogues.

## Context and Problem Statement

Model Context Protocol (MCP) 2026-07-28 allows a request to include a progress
token. The server may use that token to send progress notifications before the
request's final result.

Em See Pea already provides bounded request-scoped progress to streaming tool
handlers. Static-resource, resource-template, and prompt handlers cannot use
that established mechanism, even when the current request supplies a progress
token.

The framework should close that gap while preserving the existing transport,
authorization, validation, cancellation, deadline, and safe-error boundaries.

## Decision Drivers

- Support standard request-scoped progress for direct resource reads and prompt
  retrieval.
- Reuse the existing progress reporter and its event-count and event-size
  limits.
- Expose progress only to the handler kinds covered by this decision.
- Use only the progress token supplied by the current request.
- Preserve authorization, deadlines, cancellation, result validation, safe
  errors, and terminal-result ordering.
- Avoid sessions, replay, retry, reconnect recovery, mutable catalogues, and
  deprecated MCP functionality.

## Considered Options

1. **Bounded progress for resources and prompts (chosen)**: add the established
   reporter to static-resource, resource-template, and prompt handler contexts.
2. **Keep progress limited to streaming tools**: leave resource and prompt
   operations without progress reporting.
3. **Add a general session-backed progress subsystem**: persist and replay
   progress across reconnects and requests.

## Decision Outcome

Chosen option: **"Bounded progress for resources and prompts"**, because it
closes the smallest independent non-deprecated protocol gap by reusing an
existing request-scoped mechanism.

Static-resource, resource-template, and prompt handlers receive a
`reportProgress` function only when the current request supplies a progress
token. The public handler types remain narrow; the shared `ClientInputContext`
used by direct tools is not widened.

The implementation reuses `progressReporter`, `maxProgressEvents`, and
`maxProgressEventBytes`. It preserves authentication and authorization before
handler execution, request deadlines, cancellation, result validation, safe
errors, and delivery of progress before the terminal result.

For an input-required prompt flow, every fresh request round may use only that
round's progress token. Tokens are not retained or copied between requests.

This decision does not change mapped tools, completion handlers, notification
POST handling, capability catalogues, client logging, roots, sampling,
sessions, replay, retries, reconnects, or recovery.

## Consequences

### Good

- Resource and prompt work can report progress through the same bounded path as
  streaming tools.
- The change adds no new transport, session state, dependency, or public
  abstraction.
- Existing authorization and failure boundaries remain intact.

### Neutral

- Progress remains optional: clients may omit a token and servers may emit no
  notifications.
- Each handler decides whether useful progress exists to report.

### Bad

- The streaming path remains bounded but has no measured performance budget.
- Handler authors can exhaust the configured event allowance before completing
  work, after which further reports fail under the existing reporter rules.

## Confirmation

### Protocol Behavior

- Static-resource, resource-template, and prompt handlers can report progress
  when the official MCP client pinned to `2026-07-28` supplies a progress token.
- Requests without a progress token expose no reporter and send no progress
  notification.
- Progress notifications use only the current request's token and arrive before
  its terminal result.
- Every fresh input-required round is isolated from earlier progress tokens.

### Safety and Compatibility

- Authentication and authorization occur before protected handlers run.
- Existing cancellation, deadline, result-validation, event-count,
  event-size, and generic safe-error behavior remains unchanged.
- Direct and mapped tool contexts, completion handlers, notification POST
  behavior, and legacy-client behavior remain unchanged.

### Qualification

- Source, type, black-box, packed-package, and benchmark checks pass from clean
  checkouts.
- A released-package journey independently verifies resource and prompt
  progress, token isolation, limit enforcement, and terminal ordering.
- Registry readback independently verifies the released package version,
  integrity, signatures, provenance, and public types.

### Documentation

- Protocol coverage and package guidance describe the new optional behavior and
  its limits without restoring deprecated client-logging guidance.

## Pros and Cons of the Options

### Bounded Progress for Resources and Prompts

- Good, because it reuses the framework's existing bounded request-scoped
  mechanism.
- Bad, because it extends the streaming workload without establishing a new
  measured budget.

### Keep Progress Limited to Streaming Tools

- Good, because it requires no code or public-type change.
- Bad, because resource and prompt handlers cannot expose standard progress for
  potentially long-running work.

### Add a General Session-Backed Progress Subsystem

- Good, because progress could survive reconnects and support replay.
- Bad, because MCP progress is request-scoped and the extra state, recovery,
  authorization, and ordering rules are not required by the current job.

## Performance Review

Source: **no data - worst-case assumption**.

With the current limits, one request can emit at most 32 events of 8 KiB each,
or 256 KiB. At an assumed 100 requests per second, and an assumed 1 ms of CPU
per event, the worst case is 3.2 CPU-seconds per second and 25 MiB per second of
outbound progress, or about 2.11 TiB per day if every request exhausts both
limits. Requests without a progress token add 0 notification bytes.

ADR-0014 excludes streaming work from its performance budget. This decision
makes no performance claim and accepts the existing bounded but unbudgeted
streaming risk. Release qualification must still run the repository's measured
benchmark checks.

## Reassessment Criteria

Reassess if MCP changes progress-token semantics, clients require resumable or
replayed progress, measured streaming overhead threatens service objectives, or
the existing event limits prove unsuitable for resource and prompt workloads.
Any reassessment must preserve per-request token isolation, authorization
before handler execution, bounded output, cancellation, deadlines, terminal
ordering, and safe errors.
