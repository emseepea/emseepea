# Risk R007: Release Pipeline Publishes the Wrong or Compromised Package

**Status**: Active
**Category**: information security
**Identified**: 2026-08-27
**Owner**: Release maintainer
**Last reviewed**: 2026-09-23
**Next review**: 2027-02-28

## Description

Release automation, dependencies, credentials, or package metadata may be
compromised or misconfigured. The pipeline could publish the wrong package,
wrong revision, or unsafe contents. It may instead fail only when publication
starts, after earlier qualification has passed, because a new package name does
not yet exist in the registry.

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
- **Stop before publishing an unregistered package name** - The anonymous
  registry capture distinguishes a missing package-name response from an absent
  target version and from other registry failures. It stops before `npm publish`
  with the manual bootstrap boundary, the exact trusted-publisher workflow, and
  the promotion-token limit. Implemented in
  `scripts/verify-registry-release.mjs` and `.github/workflows/release.yml`;
  exercised by `tests/docs/verify-registry-release.test.mjs` and
  `tests/llm/release-workflow.test.mjs`.
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

Problem 003 exposed a missing control: registry capture did not stop when the
package name itself was absent. The read-only package-name preflight is now an
operating control, supported by focused tests and workflow-order evidence. It
reduces this failure mode without claiming that an existing package has a valid
trusted-publisher configuration. The broader residual score remains 5 because
this control does not reduce the severe impact of the other publication and
supply-chain failures covered by this risk.

## Monitoring

- **Trigger to re-assess**: Any dependency, workflow, credential, package,
  provenance, or publication change.
- **Metrics**: published package does not match the source commit; missing
  source evidence; missing checksum; missing software bill of materials;
  unexpected `latest` tag changes; long-lived npm write credentials; failed
  clean-install checks.

## Related

- Criteria: `RISK-POLICY.md`
- Related problem: [Problem 014: Direct Dependencies Have No Identified Owner or Purpose](../problems/open/014-direct-dependencies-have-no-identified-owner-or-purpose.md) records two dependency declarations whose owning import or documented purpose has not yet been identified.
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
- Realised-as: [Problem 003: Release Workflow Lacks First-Package
  Trusted-Publisher Preflight](../problems/known-error/003-release-workflow-lacks-first-package-trusted-publisher-preflight.md)
  records the release that reached `npm publish` before discovering that a new
  package name did not exist in the registry.
- Treatment ADRs:
  [ADR-0098: Publish on Merge to a Publish Branch](../decisions/0098-publish-on-merge-to-a-publish-branch.proposed.md),
  [ADR-0100: Trunk Push and Watch Under a Publish Branch](../decisions/0100-trunk-push-and-watch-under-a-publish-branch.proposed.md),
  [ADR-0101: Vulnerability Scanning Without a Release Workflow](../decisions/0101-vulnerability-scanning-without-a-release-workflow.proposed.md), and
  [ADR-0105: Bounded Stage-Only Token for npm Promotion](../decisions/0105-bounded-stage-only-token-for-npm-promotion.proposed.md).
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
- 2026-09-23: Linked Problem 014's unowned-direct-dependency concern. This
  traceability update did not change the risk's controls, scoring, treatment,
  owner, or review date.
- 2026-09-23: Recorded Problem 003's realised first-package failure, added the
  tested read-only registry preflight as an operating control, replaced the
  historical treatment-decision link with current release decisions, and kept
  the residual score at 5 because the broader supply-chain impact is unchanged.
