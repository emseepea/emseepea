# Risk R007: Release Pipeline Publishes the Wrong or Compromised Package

**Status**: Active
**Category**: information security
**Identified**: 2026-08-27
**Owner**: Release maintainer
**Last reviewed**: 2026-09-04
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

- **Publish without long-lived npm passwords** - Routine npm publication uses
  trusted publishing with workflow-scoped OpenID Connect (OIDC). This means the
  workflow gets short-lived permission only when it runs. Implemented in
  `.github/workflows/release.yml`.
- **Test the exact code being published** - Publication depends on tests,
  a pinned Open Source Vulnerabilities (OSV) lockfile scan, performance checks,
  package contents, and AI-understanding evidence for the same commit that will
  be published. Quality runs the scan in `.github/workflows/quality.yml`, and
  Release consumes that exact-commit evidence in `.github/workflows/release.yml`.
- **Use reviewed workflow versions** - Third-party GitHub Actions and the npm
  client use fixed versions. Implemented in `.github/workflows/quality.yml` and
  `.github/workflows/release.yml`.
- **Check a fresh install before publishing** - Install both packed public
  packages outside the monorepo, require their third-party versions to exist in
  the committed repository lockfile, load the testing helpers, and run the
  installed-package checks. Implemented in
  `tests/docs/packed-getting-started.test.mjs`, run by release CI before npm
  publication. A failed dependency graph or package check stops publication.
- **Check the package after npm receives it** - Anonymous npm checks verify the
  version, `latest` tag, source evidence, clean installation, registry signatures,
  public import, and a basic run before the GitHub release
  is created. Implemented in
  `.github/workflows/release.yml`.
- **Check every public file before publishing** - The release job builds before
  packing, each public package builds itself before an ordinary pack, and
  package inspection checks that every public import and command is present.
  Implemented in `.github/workflows/release.yml`,
  `packages/framework/package.json`, and `packages/testing/package.json`.
- **Release artifacts** - The workflow records a checksum, a CycloneDX software
  bill of materials (a list of package ingredients), the exact commit,
  lockfile, supported features, excluded features, and readiness review.
  Implemented in `.github/workflows/release.yml`.

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
- **Metrics**: published package does not match the source commit; missing
  source evidence; missing checksum; missing software bill of materials;
  unexpected `latest` tag changes; long-lived npm write credentials; failed
  clean-install checks.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: `@emseepea/server@0.0.1` and `@emseepea/testing@0.0.1`
  were published without their built files on 2026-08-29. Both versions were
  deprecated before announcement, and no Git tags or GitHub releases were
  created for them.
- Realised-as: both `0.0.2` packages reached npm, but verification failed and
  no GitHub release was created. One test used duplicate resource addresses.
  That run's fresh install also reported six high-severity dependency findings
  from Promptfoo's optional dependencies. See the
  [0.0.2 release run](https://github.com/windyroad/emseepea/actions/runs/33259549290).
  Fresh-install checks now run before npm publication as well as afterward.
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
- 2026-08-30: Recorded the incomplete 0.0.1 packages and added build,
  package-content, registry, and release-order safeguards.
- 2026-08-30: Recorded the blocked 0.0.2 release and added a runnable
  installed-package check plus a fresh-install vulnerability audit.
- 2026-08-31: Clarified that 0.0.2 reached npm before verification failed.
  Added a prepublication fresh-install check for both public packages; retained
  the existing post-publication checks.
- 2026-09-04: Replaced npm vulnerability advisory checks with committed-lockfile
  dependency graph checks and a pinned OSV lockfile scan after repeated advisory
  endpoint timeouts. Retained registry integrity, provenance, signature, and
  clean-install controls.
