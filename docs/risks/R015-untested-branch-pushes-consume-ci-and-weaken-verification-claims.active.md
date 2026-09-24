# Risk R015: Untested Branch Pushes Consume Continuous Integration (CI) and Weaken Verification Claims

**Status**: Active
**Category**: operational
**Identified**: 2026-09-24
**Owner**: Framework maintainer
**Last reviewed**: 2026-09-24
**Next review**: 2027-03-24

## Description

A maintainer can push a branch revision without running the repository's full
deterministic test suite for that exact commit. Remote continuous integration
then becomes the first complete check, consuming a pipeline cycle and reviewer
time for failures that were reproducible locally.

Stale installed dependencies can also make partial local evidence misleading.
A verification claim may name checks that passed without making the omitted full
suite or mismatched dependency state visible.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 3 (Moderate)
- **Likelihood**: 5 (Almost certain)
- **Inherent Score**: 15
- **Inherent Band**: High

## Controls

- **Remote merge qualification** — GitHub Quality runs `npm test` for pull
  requests and blocks an unqualified revision from merging. Implemented in
  `.github/workflows/quality.yml`. This detects the failure after a branch push;
  it does not control the push boundary.
- **Documented manual workaround** — Maintainers can run `npm ci` and `npm test`
  before pushing. Recorded in Problem 005. This is guidance, not an enforced
  control, and Problem 005 shows that it can be missed.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 3 (Moderate)
- **Likelihood**: 5 (Almost certain)
- **Residual Score**: 15
- **Residual Band**: High
- **Within appetite?**: No

## Treatment

Mitigate. The missing control is an enforced check before branch pushes. It
should accept only evidence that `npm ci` and the full test suite passed for
each branch commit being pushed. ADR-0106 was ratified on 2026-09-24. The
residual score remains the same as the inherent score until the decision is
implemented with behavioural coverage and exercised successfully. No
unevidenced reduction is claimed.

## Monitoring

- **Trigger to re-assess**: Any branch-push gate, repository test-contract,
  dependency-installation, Git-hook installation, or pull-request Quality
  workflow change; or another branch whose first full qualification occurs in
  remote continuous integration.
- **Metrics**: branch pushes rejected for missing or stale exact-commit evidence;
  remote Quality failures reproducible by the unchanged local full suite;
  qualification latency; bypassed or missing hook installations.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: [Problem 005: Branch Push Is Ungated, So Untested Changes Reach Continuous Integration](../problems/open/005-branch-push-is-ungated-so-untested-changes-reach-ci.md)
- Treatment ADRs: [ADR-0106: Clean-Install Exact-Commit Branch Push Gate](../decisions/0106-clean-install-exact-commit-branch-push-gate.proposed.md) (ratified 2026-09-24; implementation pending)
- Personas affected: [Framework maintainer](../jtbd/framework-maintainer/persona.md)
- Job served: [JTBD-101: Publish Installable Packages Safely](../jtbd/framework-maintainer/JTBD-101-publish-installable-packages-safely.proposed.md)

## Change Log

- 2026-09-24: Initial identification from the branch-push failure documented in
  Problem 005. Recorded the absent push-boundary control and retained residual
  risk at 15 pending evidenced treatment.
- 2026-09-24: Tom ratified ADR-0106. Retained residual risk at 15 pending
  implementation, behavioural coverage, and a successful real push.
