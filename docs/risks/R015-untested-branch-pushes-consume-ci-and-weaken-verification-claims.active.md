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
- **Exact-commit qualification** — `npm run push:qualify` starts only from a
  clean committed checkout, runs `npm ci` followed by the existing `npm test`,
  and records evidence only if the same `HEAD` remains clean afterwards.
- **Native push-boundary enforcement** — the tracked `pre-push` hook checks
  every non-deletion outgoing tip for evidence bound to its exact commit.
  Behavioural tests cover missing and stale evidence, multiple tips, deletion
  pushes, and installation in a fresh clone or worktree.
- **Exercised control** — the installed hook accepted governed push commit
  `0c28ae0cf68c345c3ca64f6cdafba497c06b0116`, and GitHub Quality run
  [`35964172151`](https://github.com/emseepea/emseepea/actions/runs/35964172151)
  passed for that exact commit.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 3 (Moderate)
- **Likelihood**: 2 (Unlikely)
- **Residual Score**: 6
- **Residual Band**: Medium
- **Within appetite?**: No

## Treatment

Mitigate. ADR-0106's exact-commit gate is implemented, covered by behavioural
tests, and exercised by a governed push whose remote Quality run passed for the
same commit. Likelihood is now Unlikely because the installed hook rejects
ordinary unqualified pushes. It is not Rare: installation remains explicit in
each clone or worktree, and Git permits an intentional `--no-verify` bypass.
The active residual therefore remains above appetite and continues to be
monitored rather than being treated as eliminated.

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
- Realised-as: [Problem 005: Branch Push Is Ungated, So Untested Changes Reach Continuous Integration](../problems/closed/005-branch-push-is-ungated-so-untested-changes-reach-ci.md)
- Treatment ADRs: [ADR-0106: Clean-Install Exact-Commit Branch Push Gate](../decisions/0106-clean-install-exact-commit-branch-push-gate.proposed.md) (ratified and implemented 2026-09-24)
- Personas affected: [Framework maintainer](../jtbd/framework-maintainer/persona.md)
- Job served: [JTBD-101: Publish Installable Packages Safely](../jtbd/framework-maintainer/JTBD-101-publish-installable-packages-safely.proposed.md)

## Change Log

- 2026-09-24: Initial identification from the branch-push failure documented in
  Problem 005. Recorded the absent push-boundary control and retained residual
  risk at 15 pending evidenced treatment.
- 2026-09-24: Tom ratified ADR-0106. Retained residual risk at 15 pending
  implementation, behavioural coverage, and a successful real push.
- 2026-09-24: Reduced residual risk from 15 to 6 after behavioural coverage,
  the installed hook's governed push of exact commit `0c28ae0`, and successful
  Quality run `35964172151`. Retained Active status because explicit hook
  installation and Git's intentional hook bypass keep likelihood above Rare.
