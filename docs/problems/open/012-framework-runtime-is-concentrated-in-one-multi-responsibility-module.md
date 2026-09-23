# Problem 012: Framework Runtime Is Concentrated in One Multi-Responsibility Module

**Status**: Open
**Reported**: 2026-09-23
**Priority**: 8 (Medium) — Impact: 2 × Likelihood: 4 — the current harm is developer-only review and change friction, while the 4,183-line shared change surface makes that friction likely on ordinary framework work
**Origin**: internal
**Effort**: L — separating established responsibilities without changing the public API spans multiple internal seams and requires broad regression coverage
**JTBD**: JTBD-100
**Persona**: framework-maintainer

## Description

`packages/framework/src/index.ts` is 4,183 lines and combines public contracts,
capability definitions, protocol setup, deployment and authentication,
pagination, schema conversion, request validation, and server lifecycle.
`createEmseepea` alone spans roughly 570 lines.

This concentrates unrelated checked boundaries in one change surface. A local
framework change is harder to review in isolation, investigation requires
understanding distant responsibilities, and an edit can affect an unrelated
runtime path. The problem records the concentration and the need to investigate
stable internal seams; it does not pre-select a particular module split.

## Symptoms

- Changes to one framework concern are reviewed in a file containing most of
  the runtime's other concerns.
- `createEmseepea` constructs protocol catalogues, subscriptions, request
  handling, observability, deployment behaviour, and Fastify routes in one
  function.
- Tests provide broad behavioural coverage, but the source boundary does not
  localise the knowledge needed to change one behaviour.

## Workaround

Use the focused black-box tests for the behaviour being changed and review all
callers and neighbouring runtime paths in `packages/framework/src/index.ts`.

## Impact Assessment

- **Who is affected**: framework maintainers reviewing, changing, or diagnosing the runtime.
- **Frequency**: likely during ordinary framework changes because most runtime behaviour shares the file.
- **Severity**: developer-only friction today; an undetected regression would realise the linked checked-boundary risk.
- **Analytics**: 4,183 lines in the module; approximately 570 lines in `createEmseepea` at capture.

## Root Cause Analysis

### Investigation Tasks

- [ ] Identify cohesive internal seams while preserving the existing public package exports.
- [ ] Measure which framework changes currently touch unrelated regions of the module.
- [ ] Create a behavioural reproduction that protects the first extracted seam before moving code.
- [ ] Determine whether the eventual structural proposal needs a new architecture decision.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

- Standing risk: [R003: Checked Boundaries Fail or Expose Backend Data](../../risks/R003-checked-boundaries-fail-or-expose-backend-data.active.md).
- Architecture review found no conflict with ADR-0006 or ADR-0007 and required the ticket to avoid pre-committing to a module split.
- Captured via `/wr-itil:capture-problem`.
