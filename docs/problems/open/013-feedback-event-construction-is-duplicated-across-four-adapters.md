# Problem 013: Feedback Event Construction Is Duplicated Across Four Adapters

**Status**: Open
**Reported**: 2026-09-23
**Priority**: 6 (Medium) — Impact: 2 × Likelihood: 3 — the copies are currently consistent, but ordinary event-contract changes can leave one adapter behind and create maintainer or adopter friction
**Origin**: internal
**Effort**: M — one package-internal path must replace four source copies and retain adapter-specific behavioural coverage
**JTBD**: JTBD-100
**Persona**: framework-maintainer

## Description

`packages/feedback/src/postgres.ts`, `firestore.ts`, `github.ts`, and
`zendesk.ts` each contain an identical constructor for
`FeedbackBackendEvent`. Each copy derives the event identifier and assigns the
same type, occurrence time, thread, message, and author fields.

The copies match today, but the shared contract has four change sites. A future
event-contract change can update some adapters and not others, producing
inconsistent identity, correlation, author, or occurrence-time semantics. The
problem records the duplication and the need to investigate one
package-internal construction path; it does not pre-select a wider abstraction.

## Symptoms

- The same event-construction function appears four times in one package.
- A contract change requires coordinated edits across every durable and vendor
  adapter.
- Adapter tests can pass independently while their common event semantics
  diverge unless the same expectation is repeated for every adapter.

## Workaround

When changing `FeedbackBackendEvent`, search every adapter and update and test
all four constructors together.

## Impact Assessment

- **Who is affected**: feedback-package maintainers and adopters consuming backend events.
- **Frequency**: possible whenever feedback event fields or identity rules change.
- **Severity**: developer friction while copies match; divergence could break cross-adapter event processing.
- **Analytics**: four identical constructors at capture.

## Root Cause Analysis

### Investigation Tasks

- [ ] Confirm the common event semantics required by every feedback backend.
- [ ] Create a behavioural reproduction that fails when adapters construct different common fields.
- [ ] Identify the smallest package-internal construction path that removes the repeated rule.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

- Standing risk: [R003: Checked Boundaries Fail or Expose Backend Data](../../risks/R003-checked-boundaries-fail-or-expose-backend-data.active.md).
- Hang-off review found this does not belong under Problem 012 because it concerns a separate component and root cause.
- Architecture review found no conflict with ADR-0066 and distinguished this duplication from Problem 009's post-write validation failure.
- Captured via `/wr-itil:capture-problem`.
