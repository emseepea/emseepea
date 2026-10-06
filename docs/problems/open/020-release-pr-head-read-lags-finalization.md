# Problem 020: Release PR Head Read Lags Finalization

**Status**: Open
**Reported**: 2026-10-06
**Priority**: 6 (Medium) - Impact: 3 × Likelihood: 2 - release preparation stopped; bounded observations and regression coverage reduce recurrence
**Origin**: internal
**Effort**: S - verify the bounded observation and exact-head checks
**WSJF**: 6.0 - Priority 6 × Open multiplier 1.0 / Effort 1
**JTBD**: JTBD-101 - publish installable packages safely
**Persona**: framework-maintainer

## Description

After recovery finalization updated the release branch, an immediate GitHub PR
head read still returned the earlier head. The workflow treated that lag as a
permanent mismatch and stopped before dispatching the release.

## Symptoms

- Quality run `37384394609` failed after finalization.
- The frozen branch head and the first PR-head observation disagreed.

## Workaround

Use the bounded observation in `b89596804f1a08ad6895f1afa3564b5e2199dee6`.
Wait for the PR view to show the frozen branch head; fail if it never matches
or the branch moves before dispatch.

## Impact Assessment

- **Who is affected**: maintainers preparing a recovery release.
- **Frequency**: observed once after a release-branch update in this session.
- **Severity**: release preparation stops; the exact-head check prevents
  dispatching a mismatched candidate.
- **Analytics**: Quality run `37384394609` and the fix commit below.

## Root Cause Analysis

The workflow made one PR-head observation immediately after updating the
branch. That read could lag branch visibility. The fix permits 12 observations,
five seconds apart, and retains the final exact comparison. It also reads the
branch again before dispatch to detect movement.

### Investigation Tasks

- [x] Identify the single-read visibility assumption.
- [x] Add regression coverage for bounded observation and exact-head comparison.
- [ ] Review subsequent exact-candidate dispatch evidence before lifecycle closure.

## Proposed Fix Strategy

Retain the bounded observation and both exact-head checks. Review the existing
workflow evidence before changing timing or introducing controls. Do not
replace candidate identity with a looser success check.

## Session Evidence

- [Failed Quality run](https://github.com/emseepea/emseepea/actions/runs/37384394609).
- [Fix commit](https://github.com/emseepea/emseepea/commit/b89596804f1a08ad6895f1afa3564b5e2199dee6)
  changes `.github/workflows/quality.yml` and its recovery regression coverage.
- Later [Release run 37389531442](https://github.com/emseepea/emseepea/actions/runs/37389531442)
  passed for frozen candidate `62ac79a3153f9f98c488163ff07a2522fb18c67e`.
  This capture stays Open for later lifecycle review.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: P018

## Related

Captured via `/wr-itil:capture-problem`. Fresh-context hang-off review returned
`PROCEED_NEW`: P001 concerns initializer bumps; P014 dependency ownership;
P016 feedback-test timing; P018 occupied versions; P003 package-name preflight.
None covers an outdated PR-head observation after finalization.
