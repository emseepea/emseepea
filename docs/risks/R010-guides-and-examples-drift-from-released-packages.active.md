# Risk R010: Guides and Examples Drift from Released Packages

**Status**: Active
**Category**: delivery
**Identified**: 2026-08-28
**Owner**: Documentation and examples maintainer
**Last reviewed**: 2026-08-28
**Next review**: 2027-02-28

## Description

Getting-started guides, website pages, and examples may compile only against
workspace source. They may also describe an application programming interface
(API) that differs from the package available to adopters. A guide may
therefore be clear and still be unusable.

Drift can waste adopter time, hide breaking changes, and make examples poor
evidence for the released framework.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 4 (Likely)
- **Inherent Score**: 16
- **Inherent Band**: High

## Controls

- **Public-boundary examples** - Every example must import only the public
  framework API for Model Context Protocol (MCP) behavior. Defined in
  `QUALITY.md`.
- **Exact-commit qualification** - Clean-checkout workflows build and test all
  workspaces against the committed lockfile. Implemented in
  `.github/workflows/quality.yml` and `.github/workflows/release.yml`.
- **Published-package verification** - Release qualification requires an exact-
  version clean install, public import, and smoke execution. Defined in
  [ADR-0019: public pre-alpha releases through npm Trusted Publishing](../decisions/0019-public-pre-alpha-releases-through-npm-trusted-publishing.superseded.md).

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 3 (Possible)
- **Residual Score**: 12
- **Residual Band**: High
- **Within appetite?**: No

## Treatment

Mitigate. Current checks do not yet execute every guide and website example
against the package version readers install. Publication remains blocked until
all published getting-started paths run as version-bound tests and stale pages
fail closed.

## Monitoring

- **Trigger to re-assess**: Any public API, package version, example, guide,
  website page, installation command, or release-workflow change.
- **Metrics**: Executable guides versus published guides; examples tested
  against the released package; stale or failing snippets.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs:
  [ADR-0019: Public Pre-Alpha Releases Through npm Trusted Publishing](../decisions/0019-public-pre-alpha-releases-through-npm-trusted-publishing.superseded.md)
- Personas affected: framework adopters, contributors, and maintainers

## Change Log

- 2026-08-28: Initial identification before the documentation website exists.
