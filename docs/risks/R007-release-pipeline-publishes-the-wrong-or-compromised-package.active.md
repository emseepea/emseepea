# Risk R007: Release Pipeline Publishes the Wrong or Compromised Package

**Status**: Active
**Category**: information security
**Identified**: 2026-08-27
**Owner**: Release maintainer
**Last reviewed**: 2026-08-28
**Next review**: 2027-02-28

## Description

Release automation, dependencies, credentials, or package metadata may be
compromised or misconfigured. The pipeline could publish the wrong package,
wrong revision, or unsafe contents.

Because adopters install the published package, this could spread compromised
code beyond the repository.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 5 (Severe)
- **Likelihood**: 3 (Possible)
- **Inherent Score**: 15
- **Inherent Band**: High

## Controls

- **Short-lived publication authority** - Routine npm publication uses trusted
  publishing with workflow-scoped OpenID Connect (OIDC), not a durable npm write
  token. Implemented in `.github/workflows/release.yml`.
- **Exact-commit qualification** - Publication depends on clean-checkout tests,
  audit, performance, package contents, and semantic evidence for the publishing
  commit. Implemented in `.github/workflows/release.yml`.
- **Pinned workflow dependencies** - Third-party GitHub Actions and the npm
  client use fixed versions. Implemented in `.github/workflows/quality.yml` and
  `.github/workflows/release.yml`.
- **Post-publication verification** - Anonymous registry checks verify exact
  version, `next` tag, unchanged `latest`, provenance, clean installation,
  public import, and smoke execution before the GitHub release is created.
  Implemented in `.github/workflows/release.yml`.
- **Release artifacts** - The workflow records a checksum, CycloneDX software
  bill of materials, exact commit, lockfile, supported slice, exclusions, and
  readiness review. Implemented in `.github/workflows/release.yml`.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 5 (Severe)
- **Likelihood**: 1 (Rare)
- **Residual Score**: 5
- **Residual Band**: Low
- **Within appetite?**: Yes

## Treatment

Mitigate. Trusted publishing, immutable workflow pins, exact-commit gates, and
post-publication verification remain mandatory. Any one-off first-package
bootstrap requires its own least-privilege review and immediate credential
removal; it is not a reusable fallback.

## Monitoring

- **Trigger to re-assess**: Any dependency, workflow, credential, package,
  provenance, or publication change.
- **Metrics**: Published package and commit mismatches; missing provenance,
  checksum, software bill of materials, or evidence; unexpected `latest` tag
  changes; durable npm write credentials; failed clean-install smoke checks.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs:
  [ADR-0019: Public Pre-Alpha Releases Through npm Trusted Publishing](../decisions/0019-public-pre-alpha-releases-through-npm-trusted-publishing.superseded.md)
- Personas affected: package consumers, adopters, and maintainers

## Source Evidence (auto-scaffolded 2026-08-27)

Aggregated from 5 `.risk-reports/` entries:

- `.risk-reports/2026-08-26T22-06-14-commit.md`
- `.risk-reports/2026-08-26T22-22-35-commit.md`
- `.risk-reports/2026-08-26T22-27-24-commit.md`
- `.risk-reports/2026-08-27T00-59-47-commit.md`
- `.risk-reports/2026-08-27T06-21-25-commit.md`

These source entries seeded the curated risk. Re-rate when controls, source
evidence, or risk policy change.

## Change Log

- 2026-08-27: Auto-scaffolded from recurring pipeline findings.
- 2026-08-28: Curated controls, ownership, scoring, and treatment from the
  implemented trusted-publishing and release-evidence workflow.
