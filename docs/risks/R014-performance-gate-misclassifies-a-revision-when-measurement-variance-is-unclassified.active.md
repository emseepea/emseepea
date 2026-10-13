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
- **Fixed complete-population classification** — Each invocation collects three
  complete populations; all must pass. Mixed results are INCONCLUSIVE and
  incomplete measurements cannot qualify. Diagnostic files are separately
  named and cannot replace ordinary observations.
- **Complete retained evidence** — Continuous integration retains every cohort
  summary and raw CPU sample. Missing, malformed, failed, or cancelled cohorts
  fail closed.

Quality run `38342282754` exercised these controls on Node.js 22 and 24 for
exact `main` commit `1928f9662d8a2cb7f86cdf0e01e3f71f8e9b30ff` and passed.

## Residual Risk

Impact × Likelihood after controls.

- **Impact**: 3 (Moderate)
- **Likelihood**: 1 (Rare)
- **Residual Score**: 3
- **Residual Band**: Low
- **Within appetite?**: Yes

Independent assessment re-rated the classification-gap risk after exact main
`b63af5b` passed first-attempt Quality `38401142463` on Node 22.23.2 and 24.21.0.
Each runtime retained three complete uninstrumented PASS populations, with
7,200 CPU samples and complete throughput, allocation and wire observations.
Artifact ZIP hashes and every entry hash were verified; classifications were
independently recomputed from raw cohorts. No thresholds changed or measurements
were resampled. See the [bounded verification receipt](../reviews/fixed-population-control-verification-2026-10-13.json).

The original failed population and later diagnostic pass remain valid evidence.
Hardware normalization and the cause of historical variation are not established.
Passing fixed populations do not establish performance equivalence.

## Treatment

Every invocation now collects exactly three complete populations. Each retains
the existing three-cohort calculation and unchanged ADR-0014 limits. Qualification
requires all three complete, uninstrumented populations to pass. Disagreement is
INCONCLUSIVE; missing, malformed, failed or cancelled measurements are INCOMPLETE.
Raw samples, complete checkpoints and bounded incomplete-cohort receipts remain
retained. Diagnostic filenames cannot overwrite ordinary evidence.

Reopen treatment if disagreement or incompleteness is accepted, evidence is
lost, a result-dependent retry qualifies a revision, or a real regression passes.

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

- 2026-10-13: Reopened treatment after main `30d09eb` failed the accepted CPU budget (5.312 ms pooled p95) and one unchanged diagnostic rerun passed. Preserve both complete populations; no threshold or acceptance change is authorized by the conflict.

- 2026-10-13: Verified fixed complete-population classification on exact b63af5b, first-attempt Quality 38401142463. Independent standing risk 3/25; original conflicts and unresolved hardware causation retained.
