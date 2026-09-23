# Problem 003: Release Workflow Lacks First-Package Trusted-Publisher Preflight

The release found a missing npm package name only after publication began.

**Status**: Known Error
**Reported**: 2026-09-11
**Priority**: 15 (High) — Impact: 3 × Likelihood: 5 — derived at capture because every newly named package reaches the same missing-package state and the failure interrupts publication
**Origin**: internal
**Effort**: S — one release preflight and focused regression coverage should define the missing-package branch
**Weighted Shortest Job First (WSJF)**: 30.0 — severity 15 × Known Error multiplier 2.0 ÷ S effort 1
**Jobs To Be Done (JTBD)**: JTBD-101
**Persona**: framework-maintainer

## Description

The release workflow attempted to publish the new
`@emseepea/create-openapi-backed-server@0.0.1` package through npm trusted
publishing before that package existed in the registry. Release workflow run
`34555128253`, attempt 2, failed with npm `E404`. Architecture Decision Record
(ADR) 0019 already records that
npm requires a package to exist before its package-scoped trusted publisher can
be configured. That decision is historical context, not current implementation
authority. The release tooling did not detect the state before the publish
attempt or direct the maintainer to the separately governed bootstrap path.

The authorized recovery created a manifest-only `0.0.0` placeholder, configured
the exact GitHub Actions trusted publisher, reran the workflow successfully,
deprecated the placeholder, removed its temporary distribution tag and local
credential, and disabled token-based package publishing. Those actions repaired
this release but did not add a reusable first-package preflight.

## Symptoms

- The publish job failed only after the release workflow had completed its
  earlier qualification work.
- The registry error did not distinguish a missing package bootstrap from a
  permission failure.

## Workaround

Use a separately authorized manifest-only bootstrap, configure the exact
trusted publisher required by the current release workflow, remove the
bootstrap credential, and rerun the failed publish job.

## Impact Assessment

- **Who is affected**: framework maintainers adding a new public package.
- **Frequency**: once for each newly named npm package until a preflight exists.
- **Severity**: publication is interrupted, but the workflow fails closed before
  releasing an untrusted package.
- **Analytics**: release run `34555128253`, attempt 2, failed at the publish step
  with npm `E404`; attempt 3 succeeded after bootstrap.

## Root Cause Analysis

The registry capture treated a package-name `404` as ordinary unpublished
version state. It recorded that the target version was absent, but did not stop
when the package name itself was absent. The first operation that distinguished
those states was `npm publish`, after the earlier release checks had passed.

### Investigation Tasks

- [x] Add a pre-publish check that distinguishes a package missing from npm from
  an existing package that the workflow cannot publish.
- [x] Emit the exact separately governed bootstrap checklist without creating a
  package or credential automatically.
- [x] Add focused regression tests for the missing-package result, existing
  packages, non-404 registry failures, and workflow ordering.

## Fix Strategy

**Shape**: internal code and continuous integration (CI). Add the smallest reusable
registry preflight to the existing release verification path and call it from
`.github/workflows/release.yml` before publication. Keep bootstrap state changes
manual and authorization-bound; the check should only stop with an actionable
diagnostic. Evidence: workflow run `34555128253`, attempt 2, reached npm publish
and failed with `E404` for the absent package.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

- ADR-0019, Public Pre-Alpha Releases Through npm Trusted Publishing
  (historical context only; not current implementation authority).
- ADR-0071, Separate OpenAPI-Backed Example and Initializer.
- ADR-0098, Publish on Merge to a Publish Branch.
- ADR-0100, Trunk Push and Watch Under a Publish Branch.
- ADR-0101, Vulnerability Scanning Without a Release Workflow.
- ADR-0105, Bounded Stage-Only Token for npm Promotion.
- [Risk R013: Release Reaches Publication Before Registry Prerequisites Are
  Verified](../../risks/R013-release-reaches-publication-before-registry-prerequisites-are-verified.active.md).
- JTBD-101, Publish Installable Packages Safely.
- Captured via `/wr-itil:capture-problem`; the title-only duplicate check found
  Problem 002 (Release Readiness Verifier Only Tests Fixture-Like Stable PASS
  Marker), but that ticket covers a different pre-publication contract.
- The duplicate pre-filter found no open or verification-pending ticket sharing
  the cited decision or workflow path.
