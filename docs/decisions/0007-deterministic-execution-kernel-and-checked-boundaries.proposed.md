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

# Deterministic Execution Kernel and Checked Boundaries

## Context and Problem Statement

Every capability needs the same validation, policy, cancellation, error, and
response guarantees. Allowing handlers or adapters to bypass that lifecycle
would make safety depend on each application.

## Decision Drivers

- Invalid or unauthorized requests must cause zero application calls.
- Public and backend contracts require validation at their own boundaries.
- Domain code must not control protocol or HTTP output.
- Simple calls and multi-step workflows need one bounded kernel.

## Considered Options

1. **One checked execution kernel** - Route mapped adapters and bounded workflows
   through the same deterministic lifecycle.
2. **Capability-owned pipelines** - Let each module choose validation and errors.
3. **Direct handler-to-transport access** - Let applications write responses.

## Decision Outcome

Chosen option: **"One checked execution kernel"**.

The kernel applies parsing, protocol checks, limits, authentication,
authorization, input validation, dispatch, deadline/cancellation, execution,
backend validation, public-result mapping, output validation, and safe emission
in a deterministic order. Failures become stable public errors with internal
details redacted.

Execution supports a mapped-adapter branch and a bounded-workflow branch. Mapping
functions are pure. Backend requests and responses are independently validated.
Callers cannot select modules, adapters, provider destinations, credentials, or
workflow steps. Application code cannot construct raw HTTP, JSON-RPC, or SSE.

## Consequences

### Good

- One boundary enforces safety for every capability.
- New backends do not require protocol-kernel changes.
- Error behavior remains consistent.

### Neutral

- Backend adapters must expose explicit contracts.

### Bad

- Advanced applications cannot bypass checks for convenience.

## Confirmation

- Malformed, unauthenticated, unauthorized, and invalid requests cause zero handler and adapter calls.
- Backend contract failures cannot emit partial or unvalidated public results.
- Two materially different synthetic adapters run without kernel changes.
- A bounded workflow obeys the same deadline, cancellation, and error layers as a mapped call.
- Public APIs expose no raw response or caller-selected destination escape hatch.

## Pros and Cons of the Options

### One checked execution kernel

- Good: Fixes shared behavior once.
- Bad: Requires all integrations to use the kernel.

### Capability-owned pipelines

- Good: Gives modules flexibility.
- Bad: Repeats security and error logic.

### Direct handler-to-transport access

- Good: Is familiar to web developers.
- Bad: Makes framework guarantees unenforceable.

## Reassessment Criteria

Reassess when a public MCP requirement cannot be represented by either execution
branch without weakening the common safety lifecycle.
