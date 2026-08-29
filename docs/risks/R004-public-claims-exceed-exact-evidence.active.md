# Risk R004: Public Claims Exceed Exact Evidence

**Status**: Active
**Category**: brand
**Identified**: 2026-08-27
**Owner**: Documentation and release maintainer
**Last reviewed**: 2026-08-30
**Next review**: 2027-02-28

## Description

Documentation, release notes, package metadata, or architecture records may
claim more than the exact revision has proved. Proposed behaviour may also be
mistaken for working or released capability.

Adopters could rely on behaviour, security, or compatibility that does not
exist.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 5 (Severe)
- **Likelihood**: 4 (Likely)
- **Inherent Score**: 20
- **Inherent Band**: Very High

## Controls

- **Test the exact code being published** - Quality and release workflows build, test,
  benchmark, and audit a clean checkout of the exact commit. Implemented in
  `.github/workflows/quality.yml` and `.github/workflows/release.yml`.
- **Say only what the release proves** - Release evidence names the supported features and
  exclusions instead of implying full conformance. Implemented in
  `.github/workflows/release.yml`.
- **Keep a release-readiness record** - Publication requires a version-matched readiness record
  with exact pass markers. Implemented in `.github/workflows/release.yml` and
  `docs/reviews/0.0.2-release-readiness.md`.
- **Remove claims when checks fail** - A failed or drifting check withdraws the affected
  claim until a later exact revision restores it. Defined in `QUALITY.md`.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 5 (Severe)
- **Likelihood**: 1 (Rare)
- **Residual Score**: 5
- **Residual Band**: Low
- **Within appetite?**: Yes

## Treatment

Mitigate. Public content must say what has been tested, what has not been
tested, and whether a feature is only planned or already released.

## Monitoring

- **Trigger to re-assess**: Any public claim, package version, release, or
  capability-status change.
- **Metrics**: Public claims with exact-revision evidence; unsupported claims;
  release attempts lacking the required review record or qualification result.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: The 0.0.1 readiness record did not catch that the published
  packages lacked the files needed to run. The README also kept linking to that
  record after 0.0.1 was deprecated. Both claims were corrected before a public
  release announcement.
- Treatment ADRs:
  [ADR-0005: Active Streamable HTTP Scope and Adaptive Delivery](../decisions/0005-active-streamable-http-scope-and-adaptive-delivery.proposed.md)
  and
  [ADR-0019: Public Pre-Alpha Releases Through npm Trusted Publishing](../decisions/0019-public-pre-alpha-releases-through-npm-trusted-publishing.superseded.md)
- Personas affected: adopters, contributors, and maintainers

## Source Evidence (auto-scaffolded 2026-08-27)

Aggregated from 4 `.risk-reports/` entries:

- `.risk-reports/2026-08-26T22-13-38-commit.md`
- `.risk-reports/2026-08-26T22-22-35-commit.md`
- `.risk-reports/2026-08-27T02-05-01-commit.md`
- `.risk-reports/2026-08-27T11-59-09-commit.md`

These source entries seeded the curated risk. Re-rate when controls, source
evidence, or risk policy change.

## Change Log

- 2026-08-27: Auto-scaffolded from recurring pipeline findings.
- 2026-08-28: Curated controls, ownership, scoring, and treatment from the
  exact-commit quality and release gates.
- 2026-08-30: Recorded the incomplete 0.0.1 package claim, linked the corrected
  0.0.2 readiness record, and added package-content checks.
