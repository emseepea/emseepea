# Risk R016: Qualification False Negatives Block Safe Releases

**Status**: Active
**Category**: operational
**Identified**: 2026-09-29
**Owner**: Framework maintainer
**Last reviewed**: 2026-09-29
**Next review**: 2027-03-29

## Description

A required qualification check can fail because its test fixture is more
sensitive to scheduler timing than the product behavior it verifies. A false
negative can block a correct revision, encourage repeated reruns, and weaken
confidence that a red release gate identifies a product defect.

The risk affects framework maintainers publishing packages and can delay public
documentation or update delivery even when production behavior is unchanged.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 3 (Moderate)
- **Likelihood**: 4 (Likely)
- **Inherent Score**: 12
- **Inherent Band**: High

## Controls

- **Behavioral deadline coverage** — the feedback package test exercises GitHub
  request, GitHub response-body, PostgreSQL, and Firestore deadline paths in
  `packages/feedback/test/deadlines.test.mjs`.
- **Exact-commit qualification** — `npm run push:qualify` prevents an
  unqualified revision from satisfying the installed push gate.
- **Focused stress reproduction** — repeated execution distinguishes an
  intermittent fixture race from a deterministic product failure before the
  gate is changed.
- **Scheduling-safe fixture margin** — the shared test context allows 250
  milliseconds for backend setup while retaining the same four deadline-path
  assertions. Two hundred consecutive focused runs passed after this change.
- **Full-suite qualification rehearsal** — after refreshing the existing Hono
  lock entry and recording cognitive-review evidence, `npm test` passed all 298
  tests, including the deadline scenario and packed-package fresh install.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 3 (Moderate)
- **Likelihood**: 1 (Rare)
- **Residual Score**: 3
- **Residual Band**: Low
- **Within appetite?**: Yes

## Treatment

Mitigate. The fixture now has enough scheduling margin to exercise the same
four deadline paths reliably. Two hundred focused runs and all 298 tests in the
full suite passed. Exact-commit qualification remains a separate push and
release precondition; a failure there still halts the release.

## Monitoring

- **Trigger to re-assess**: Any deadline-test timing change, another unchanged
  revision that alternates between pass and fail, or a qualification rerun used
  to dismiss a red result.
- **Metrics**: Focused stress-run failures; full qualification failures on an
  unchanged revision; reruns required to obtain a passing gate.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: [Problem 016: Feedback deadline test flakes under qualification load](../problems/open/016-feedback-deadline-test-flakes-under-qualification-load.md)
- Treatment ADRs: no new ADR required; the test-only repair preserves ADR-0009, ADR-0066, ADR-0106
- Personas affected: [Framework maintainer](../jtbd/framework-maintainer/persona.md)
- Job served: [JTBD-101: Publish Installable Packages Safely](../jtbd/framework-maintainer/JTBD-101-publish-installable-packages-safely.proposed.md)

## Change Log

- 2026-09-29: Initial identification after the 25-millisecond fixture produced
  intermittent false negatives during focused and full qualification runs.
- 2026-09-29: Reduced residual likelihood from Likely to Rare after widening
  only the test fixture to 250 milliseconds, retaining all four assertions,
  passing 200 focused runs, and passing all 298 tests in `npm test`.
