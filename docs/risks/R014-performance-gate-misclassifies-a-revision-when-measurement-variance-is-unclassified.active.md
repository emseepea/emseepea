# Risk R014: Performance Gate Misclassifies a Revision When Measurement Variance Is Unclassified

**Status**: Active
**Category**: operational
**Identified**: 2026-09-24
**Owner**: Release maintainer
**Last reviewed**: 2026-09-24
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
  Node.js 22 and 24. This produced useful conflicting evidence but did not
  classify which result was representative.
- **Retained run evidence** — Continuous integration retains the failed attempt
  and unchanged rerun result for diagnosis.

These controls preserve the safety target and evidence. They do not control the
observed measurement-classification failure.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 3 (Moderate)
- **Likelihood**: 5 (Almost certain)
- **Residual Score**: 15
- **Residual Band**: High
- **Within appetite?**: No

## Treatment

Mitigate. Add evidence-based repeated-run variance classification that
satisfies ADR-0014 without weakening the 5 ms ceiling, changing the pinned
profile, or hiding failed measurements. One bounded rerun may aid diagnosis,
but it is not an operating control or proof that either result is correct.

The affected publication or release action remains blocked while residual risk
is above the 5-point appetite.

## Monitoring

- **Trigger to re-assess**: Conflicting same-revision measurements, any change
  to benchmark hardware normalization or acceptance semantics, or evidence that
  a true regression passed.
- **Metrics**: Same-revision result conflicts; repeated-run distribution by
  runtime and runner profile; false failures; regressions detected after a pass.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: [Problem 015: Production-Boundary CPU Benchmark Gives Conflicting Results for an Unchanged Revision](../problems/open/015-production-boundary-cpu-benchmark-gives-conflicting-results-for-an-unchanged-revision.md)
- Treatment decision: [ADR-0014: Performance Budget for the Initial JSON HTTP Boundary](../decisions/0014-performance-budget-initial-json-http-boundary.proposed.md)
- Personas affected: release maintainers and adopters relying on qualified
  performance claims

## Change Log

- 2026-09-24: Created after one Quality run failed the Node.js 22 CPU budget and
  the unchanged failed-job rerun passed. Recorded the missing repeated-run
  variance classification and the resulting above-appetite residual risk.
