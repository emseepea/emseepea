# Problem 015: Production-Boundary CPU Benchmark Gives Conflicting Results for an Unchanged Revision

**Status**: Open
**Reported**: 2026-09-24
**Priority**: 15 (High) — Impact: 3 × Likelihood: 5 — an observed and uncontrolled measurement conflict disrupted continuous integration and release qualification
**Origin**: internal
**Effort**: M — diagnosis needs repeated same-revision measurements and a control that preserves the approved performance ceiling
**Jobs To Be Done (JTBD)**: JTBD-101 — publish installable packages safely
**Persona**: framework-maintainer

## Description

Quality run `35912998949` gave conflicting production-boundary CPU results for
the same revision. The Node.js 22 job measured accepted-request 95th-percentile
(p95) framework CPU at 7.053 ms against the fixed 5 ms budget and failed.
Node.js 24 passed, and the failed Node.js 22 job passed unchanged on one rerun.

The evidence does not establish whether the failing or passing measurement was
representative. Shared-runner contention, runtime variation, and benchmark
nondeterminism are investigation hypotheses, not established causes.

## Symptoms

- One Node.js 22 measurement exceeded the fixed CPU ceiling.
- The same revision passed on Node.js 24 and on an unchanged Node.js 22 rerun.
- The gate reports a pass or fail from one set of CPU samples without an
  independent variance classification.

## Workaround

One bounded failed-job rerun can show whether an unchanged revision produces a
different result. The rerun is diagnostic evidence only. It does not establish
which result is representative and does not resolve the missing control.

## Impact Assessment

- **Who is affected**: maintainers waiting for continuous integration and
  release qualification.
- **Frequency**: one conflicting same-revision result observed at capture.
- **Severity**: moderate because a result conflict can block or incorrectly
  qualify a release.
- **Analytics**: Quality run `35912998949`; Node.js 22 accepted-request p95 CPU
  7.053 ms on the failed attempt; unchanged failed-job rerun passed.

## Root Cause Analysis

Architecture Decision Record (ADR) 0014 requires repeated benchmark runs to
include variance. The current CPU gate collects 200 request samples during one
benchmark invocation and applies the p95 ceiling directly. It has no independent
repeated-run variance classification for the revision being qualified.

The conflicting result also triggers ADR-0014's reassessment criterion that
hardware normalization may be inadequate. It does not justify weakening the
5 ms ceiling, changing the pinned profile, or reducing correctness or security
checks.

### Investigation Tasks

- [ ] Reproduce same-revision variance across repeated, independently invoked
      benchmark runs on the continuous-integration runner profile.
- [ ] Separate runner, runtime, benchmark, and product-code hypotheses using
      retained measurement evidence.
- [ ] Add a failing behavioural check for the confirmed measurement-control gap.
- [ ] Implement the smallest variance classification that satisfies ADR-0014
      without weakening its fixed CPU ceiling or acceptance semantics.
- [ ] Re-rate the linked standing risk from exact post-control evidence.

## Dependencies

- **Blocks**: affected publication and release qualification while the linked
  residual risk remains above appetite.
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

- Standing risk: [R014: Performance Gate Misclassifies a Revision When Measurement Variance Is Unclassified](../../risks/R014-performance-gate-misclassifies-a-revision-when-measurement-variance-is-unclassified.active.md).
- Decision: [ADR-0014: Performance Budget for the Initial JSON HTTP Boundary](../../decisions/0014-performance-budget-initial-json-http-boundary.proposed.md).
- Job to be done: JTBD-101, publish installable packages safely.
- Captured via `/wr-itil:capture-problem`.
