# Problem 003: Release Workflow Lacks First-Package Trusted-Publisher Preflight

**Status**: Open
**Reported**: 2026-09-11
**Priority**: 15 (High) — Impact: 3 × Likelihood: 5 — derived at capture because every newly named package reaches the same missing-package state and the failure interrupts publication
**Origin**: internal
**Effort**: S — one release preflight and focused regression coverage should define the missing-package branch
**Jobs To Be Done (JTBD)**: JTBD-101
**Persona**: framework-maintainer

## Description

The release workflow attempted to publish the new
`@emseepea/create-openapi-backed-server@0.0.1` package through npm trusted
publishing before that package existed in the registry. Release workflow run
`34555128253`, attempt 2, failed with npm `E404`. ADR-0019 already records that
npm requires a package to exist before its package-scoped trusted publisher can
be configured, but the release tooling did not detect that state before the
publish attempt or direct the maintainer to the separately governed bootstrap
path.

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

Perform the separately authorized manifest-only bootstrap described by
ADR-0019, configure the trusted publisher, and rerun the failed publish job.

## Impact Assessment

- **Who is affected**: framework maintainers adding a new public package.
- **Frequency**: once for each newly named npm package until a preflight exists.
- **Severity**: publication is interrupted, but the workflow fails closed before
  releasing an untrusted package.
- **Analytics**: release run `34555128253`, attempt 2, failed at the publish step
  with npm `E404`; attempt 3 succeeded after bootstrap.

## Root Cause Analysis

### Investigation Tasks

- [ ] Add a pre-publish check that distinguishes a package missing from npm from
  an existing package that the workflow cannot publish.
- [ ] Emit the exact separately governed bootstrap checklist without creating a
  package or credential automatically.
- [ ] Add a focused regression test for the missing-package result.

## Fix Strategy

**Shape**: internal code and continuous integration. Add the smallest reusable
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

- ADR-0019, Public Pre-Alpha Releases Through npm Trusted Publishing.
- ADR-0071, Separate OpenAPI-Backed Example and Initializer.
- JTBD-101, Publish Installable Packages Safely.
- Captured via `/wr-itil:capture-problem`; the title-only duplicate check found
  Problem 002 (Release Readiness Verifier Only Tests Fixture-Like Stable PASS
  Marker), but that ticket covers a different pre-publication contract.
- The duplicate pre-filter found no open or verification-pending ticket sharing
  the cited decision or workflow path.
