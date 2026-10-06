# Problem 018: Release Retry Reuses Occupied Versions from Divergent Commits

**Status**: Open
**Reported**: 2026-09-30
**Priority**: 9 (Medium) — Impact: 3 × Likelihood: 3
**Origin**: internal
**Effort**: M (medium) — retry planning and verification across Changesets and the release workflow
**WSJF**: 4.5 — Priority 9 × Open multiplier 1.0 / Effort 2
**JTBD**: JTBD-101 — publish installable packages safely
**Persona**: framework-maintainer

## Description

A failed release can publish some immutable npm versions before verification
stops. The next Changesets release pull request can assign those same versions
to package manifests derived from a different commit. A retry then cannot
publish one coherent, provenance-bound package set.

Release PR #132 at commit `1124b5928720d92e9d7ee25cc32c656fcd31b0c2`
encountered 12 changed packages already published from failed release commit
`2bcb6f62d5f8ba94505419ecf6b0a3cd25970888`. Four changed packages were
then published from the new commit. The registry verifier correctly rejected
the mixed provenance. For example, the published
`@emseepea/testing@0.16.6` depends on `@emseepea/server@0.18.1`, while the
current release pull request assigns that same immutable version a dependency
on `@emseepea/server@0.18.2`.

## Symptoms

- [Release build 36529636754](https://github.com/emseepea/emseepea/actions/runs/36529636754)
  failed registry verification: `@emseepea/testing` provenance names the
  earlier commit instead of release PR #132's head.
- Publication under `next` is incomplete as one coherent release; promotion
  to `latest` remains blocked.

## Workaround

Abandon the mixed release candidate. Assign fresh versions to all 16 changed
packages, then publish and verify those versions from one checked release
head. Keep the unchanged `@emseepea/tailwind@0.1.1` on its existing verified
`latest` version. Do not weaken the provenance verifier or promote PR #132.

## Impact Assessment

- **Who is affected**: maintainers preparing a package release and adopters
  waiting for the corrected package guide.
- **Frequency**: observed after two partial release attempts; future partial
  publishes can recreate it until retry planning accounts for occupied versions.
- **Severity**: update delivery stops before promotion; the verifier prevents
  a mixed-source release reaching `latest`.
- **Analytics**: Release build `36529636754` on 2026-09-29.

## Root Cause Analysis

The release planner derives versions from the checked-in Changesets and
manifests without accounting for versions already published by an abandoned
candidate. npm versions cannot be replaced. The provenance check in
`scripts/verify-registry-release.mjs` correctly detects the mismatch after
publication; the earlier release-plan step does not prevent it.

### Investigation Tasks

- [x] Compare the failed release head, registry versions, and provenance.
- [ ] Add a failing retry-planning test for occupied versions from another
      release head.
- [ ] Define a safe way to choose fresh versions before publication.
- [x] Verify a retry with one release head and exact package contents.

### Recovery Evidence: 2026-10-06

The retry used checked source
`90fa62594cdb6b479702cffbcdefb43e2082e34e`, whose
[Quality run 37388530000](https://github.com/emseepea/emseepea/actions/runs/37388530000)
passed. Frozen candidate `62ac79a3153f9f98c488163ff07a2522fb18c67e`
has the same Git tree as officially generated candidate
`dba58275b0cd4d7b2e31c6a571ee31449ca741e5`:
`c1dcc16120f0891d2d636b3e274f6097857d9248`.

All 16 changed versions were observed on `latest`, with exact registry
`gitHead` equal to the frozen candidate. The unchanged tailwind package retained
its earlier version. [Release run 37389531442](https://github.com/emseepea/emseepea/actions/runs/37389531442)
passed on attempt 2; [Publish run 37404060722](https://github.com/emseepea/emseepea/actions/runs/37404060722)
passed all jobs. Trunk merge-back is
`ab8f75fa93fef42a437bfc137b104e092b052bbd`.

This demonstrates recovery of this candidate. The ticket stays Open: a safe
retry does not by itself establish that every future occupied-version planning
case is prevented, and the failing planning-test task remains outstanding.

## Proposed Fix Strategy

Retain the current fresh-version recovery contract and exact package-content
and provenance verification. Add the outstanding occupied-version planning
regression before treating the general planning defect as resolved. Review the
existing recovery implementation before proposing additional release controls.

## Dependencies

- **Blocks**: P007 package-guide release.
- **Blocked by**: (none)
- **Composes with**: R007 release-pipeline supply-chain risk.

## Related

- ADR-0098 documents abandoning immutable npm versions after a failed release,
  but its general retry criterion needs reassessment for this collision.
- P001 concerns missing initializer bumps, not versions already occupied by
  a different published artifact. P003 concerns first-package registration,
  not an existing immutable version. P014 and P016 do not cover publication.
- Fresh-context hang-off check returned `PROCEED_NEW` for those candidates.
- Captured via `/wr-itil:capture-problem` while working P007.
