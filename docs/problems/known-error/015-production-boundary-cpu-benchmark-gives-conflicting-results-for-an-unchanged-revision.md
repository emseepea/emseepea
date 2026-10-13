# Problem 015: Production-Boundary CPU Benchmark Gives Conflicting Results for an Unchanged Revision

**Status**: Known Error (reopened 2026-10-13 on same-revision conflict)
**Reported**: 2026-09-24
**Priority**: 15 (High) — Impact: 3 × Likelihood: 5
**Origin**: internal
**Effort**: M — diagnosis needs repeated same-revision measurements and a control that preserves the approved performance ceiling
**WSJF**: 15.0 — Priority 15 × Known Error multiplier 2.0 / Effort 2
**Jobs To Be Done (JTBD)**: JTBD-101 — publish installable packages safely
**Persona**: framework-maintainer

An observed and uncontrolled measurement conflict disrupted continuous
integration and release qualification.

## Reopened evidence

Exact main `30d09eba29605c13f0e95ed14ef43e6a6b239752` failed Quality
run `38382578560` attempt 1 on Node 22.23.2. Accepted-request pooled 95th-percentile (p95) process CPU per request
was 5.312 ms against the unchanged 5 ms limit; all three cohorts and
600 samples were retained. The single unchanged failed-job diagnostic rerun
passed on attempt 2. Both results remain evidence; the favourable rerun does
not establish which population represents the revision or erase the failure.

The earlier closure evidence below remains historical evidence. The fixed
three-cohort control exists, but does not resolve disagreement between complete
invocations. Garbage collection, allocation and runtime effects are hypotheses;
the old trace clocks do not prove exact overlap with measured CPU windows.

The next investigation adds bounded diagnostic records using one Node
performance clock for garbage collection (GC) and CPU-reading intervals. It leaves
all budgets, cohorts and ordinary CPU calculations unchanged. Profiled results
are nonqualifying. No new package release is selected by this instrumentation.
<!-- no-changeset-reference -->

Require complete ordered CPU windows, finite nested bounds and complete GC
records before interpretation. Overflow or an unfinished window prevents
absence claims. Preserve every failure and the earlier closure evidence; do
not retry measurements until a favourable result appears.

## Proposed complete-population control

Every invocation will collect exactly three complete populations, each retaining
the existing three-cohort calculation. All must pass to qualify; disagreement
is INCONCLUSIVE and an incomplete population is INCOMPLETE. The budgets stay
unchanged. No result-dependent retry or pooling across populations is allowed.

The control retains raw samples and incomplete-cohort checkpoints, cancels
subsequent measurements after external interruption and terminates child
listeners. A fixed verification invocation must be declared before collection.
This proposed control does not close the problem or establish equivalence.

## Original description

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

## Original root cause analysis

Architecture Decision Record (ADR) 0014 requires repeated benchmark runs to
include variance. The current CPU gate collects 200 request samples during one
benchmark invocation and applies the p95 ceiling directly. It has no independent
repeated-run variance classification for the revision being qualified.

The conflicting result also triggers ADR-0014's reassessment criterion that
hardware normalization may be inadequate. It does not justify weakening the
5 ms ceiling, changing the pinned profile, or reducing correctness or security
checks.

### Original investigation tasks

- [x] Reproduce same-revision variance across repeated, independently invoked
      benchmark runs on the continuous-integration runner profile.
- [x] Separate runner, runtime, benchmark, and product-code hypotheses using
      retained measurement evidence.
- [x] Add a failing behavioural check for the confirmed measurement-control gap.
- [x] Implement the smallest variance classification that satisfies ADR-0014
      without weakening its fixed CPU ceiling or acceptance semantics.
- [x] Re-rate the linked standing risk from exact post-control evidence.

## Fix Strategy

Run exactly three independent cohorts for every request class, each with a
fresh server process and unique trace identity. Classify the complete pooled
sample population against ADR-0014's unchanged thresholds, retain every cohort
summary and raw CPU sample, and fail closed when any cohort is missing,
malformed, failed, or cancelled.

The benchmark control is repository qualification infrastructure and does not
publish an npm package. <!-- no-changeset-reference -->

## Prior fix released

Released to `main` in commit `808520fb0445c12266ba69dba5509921fe2c3c51`
on 2026-10-13. Quality run `38335751990` passed for the then-current `main` commit
`11a70ef07844c8bbed432218e590225b9a164d6d`, including the governed
production-boundary budget on Node.js 22 and 24.

## Prior closure evidence

Verification completed on exact `main` commit
`1928f9662d8a2cb7f86cdf0e01e3f71f8e9b30ff`. Quality run
`38342282754` passed, including the governed production-boundary budget on
Node.js 22 and 24.

## Dependencies

- **Blocks**: further package release qualification while the same-revision
  measurement conflict remains unresolved. A diagnostic-only investigation
  slice can be independently reviewed; its green pipeline does not close this problem.
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

- Standing risk: [R014: Performance Gate Misclassifies a Revision When Measurement Variance Is Unclassified](../../risks/R014-performance-gate-misclassifies-a-revision-when-measurement-variance-is-unclassified.active.md).
- Decision: [ADR-0014: Performance Budget for the Initial JSON HTTP Boundary](../../decisions/0014-performance-budget-initial-json-http-boundary.proposed.md).
- Job to be done: JTBD-101, publish installable packages safely.
- Captured via `/wr-itil:capture-problem`.
