# Risk R014: Performance Gate Misclassifies a Revision When Measurement Variance Is Unclassified

**Status**: Active
**Category**: operational
**Identified**: 2026-09-24
**Owner**: Release maintainer
**Last reviewed**: 2026-10-13
**Next review**: 2027-03-24

## Description

The performance gate may classify a revision incorrectly when repeated
measurements vary and the gate does not classify that variance. A false failure
can stop a healthy release. A false pass can qualify a real performance
regression.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 3 (Moderate)
- **Likelihood**: 5 (Almost certain)
- **Inherent Score**: 15
- **Inherent Band**: High

The likelihood is 5 because the failure mode has occurred and the variance
classification control is absent.

## Controls

- **Fixed performance contract** — Architecture Decision Record (ADR) 0014
  retains the 5 ms 95th-percentile (p95) framework CPU ceiling and prohibits
  weakening correctness, validation, limits, security, or telemetry redaction
  to meet it.
- **Multiple runtime jobs** — Quality runs the production-boundary benchmark on
  Node.js 22 and 24.
- **Fixed repeated-run population** — Every request class always runs three
  independent cohorts with a fresh server process and unique trace identity.
  The gate applies the unchanged ADR-0014 limits to the complete pooled sample
  population rather than accepting a failure-triggered retry.
- **Complete retained evidence** — Continuous integration retains every cohort
  summary and raw CPU sample. Missing, malformed, failed, or cancelled cohorts
  fail closed.

Quality run `38342282754` exercised these controls on Node.js 22 and 24 for
exact `main` commit `1928f9662d8a2cb7f86cdf0e01e3f71f8e9b30ff` and passed.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 3 (Moderate)
- **Likelihood**: 1 (Rare)
- **Residual Score**: 3
- **Residual Band**: Low
- **Within appetite?**: Yes

## Treatment

Maintain the fixed three-cohort classification and unchanged ADR-0014 limits.
Re-open treatment if retained evidence shows a same-revision conflict under the
complete pooled population, a missing cohort is accepted, or a true regression
passes.

## Monitoring

- **Trigger to re-assess**: Conflicting same-revision measurements, any change
  to benchmark hardware normalization or acceptance semantics, or evidence that
  a true regression passed.
- **Metrics**: Same-revision result conflicts; repeated-run distribution by
  runtime and runner profile; false failures; regressions detected after a pass.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: [Problem 015: Production-Boundary CPU Benchmark Gives Conflicting Results for an Unchanged Revision](../problems/closed/015-production-boundary-cpu-benchmark-gives-conflicting-results-for-an-unchanged-revision.md)
- Treatment decision: [ADR-0014: Performance Budget for the Initial JSON HTTP Boundary](../decisions/0014-performance-budget-initial-json-http-boundary.proposed.md)
- Personas affected: release maintainers and adopters relying on qualified
  performance claims

## Change Log

- 2026-09-24: Created after one Quality run failed the Node.js 22 CPU budget and
  the unchanged failed-job rerun passed. Recorded the missing repeated-run
  variance classification and the resulting above-appetite residual risk.
- 2026-10-13: Reduced residual risk after commit `808520fb` added fixed
  three-cohort classification and Quality run `38342282754` passed the control
  on Node.js 22 and 24 for exact `main` commit `1928f966` without changing
  ADR-0014's thresholds.
