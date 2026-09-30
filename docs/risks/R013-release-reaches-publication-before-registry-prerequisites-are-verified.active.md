# Risk R013: Release Reaches Publication Before Registry Prerequisites Are Verified

**Status**: Active
**Category**: operational
**Identified**: 2026-09-24
**Owner**: Release maintainer
**Last reviewed**: 2026-09-24
**Next review**: 2027-03-24

## Description

A release may complete qualification and reach publication before discovering
that a new package name does not exist in the registry. Publication then stops
late, and the maintainer must recover through a separately authorized bootstrap.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 3 (Moderate)
- **Likelihood**: 5 (Almost certain)
- **Inherent Score**: 15
- **Inherent Band**: High

## Controls

- **Check package names before publication** - Anonymous registry capture
  distinguishes a missing package-name response from an absent target version
  and from other registry failures. The release stops before `npm publish`.
  Its diagnostic explains the required next step. Implemented in
  `scripts/verify-registry-release.mjs` and `.github/workflows/release.yml`;
  exercised by `tests/docs/verify-registry-release.test.mjs` and
  `tests/llm/release-workflow.test.mjs`.
- **Keep bootstrap separately authorized** - The preflight does not create a
  package, credential, or trusted-publisher configuration. The stage-only
  promotion token is not accepted as bootstrap authority.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 3 (Moderate)
- **Likelihood**: 1 (Rare)
- **Residual Score**: 3
- **Residual Band**: Low
- **Within appetite?**: Yes

## Treatment

Mitigate. Keep the package-name check read-only and before publication. If the
package is absent, require separate authority for the one-off bootstrap and do
not treat a promotion token as that authority.

## Monitoring

- **Trigger to re-assess**: A package-name preflight fails, a new public package
  is added, registry behavior changes, or publication reaches npm before the
  package-name state is known.
- **Metrics**: missing package names detected before publication; release runs
  reaching `npm publish` before registry prerequisites are verified; bootstrap
  actions attempted without separate authority.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: [Problem 003: Release Workflow Lacks First-Package Trusted-Publisher
  Preflight](../problems/verifying/003-release-workflow-lacks-first-package-trusted-publisher-preflight.md)
- Treatment Architecture Decision Records (ADRs):
  [ADR-0071: Separate OpenAPI-Backed Example and Initializer](../decisions/0071-separate-openapi-backed-example-and-initializer.proposed.md),
  [ADR-0098: Publish on Merge to a Publish Branch](../decisions/0098-publish-on-merge-to-a-publish-branch.proposed.md),
  [ADR-0100: Trunk Push and Watch Under a Publish Branch](../decisions/0100-trunk-push-and-watch-under-a-publish-branch.proposed.md), and
  [ADR-0105: Bounded Stage-Only Token for npm Promotion](../decisions/0105-bounded-stage-only-token-for-npm-promotion.proposed.md).
- Personas affected: release maintainers

## Change Log

- 2026-09-24: Created from Problem 003 after the first-package release reached
  publication before discovering that the package name was absent. Recorded the
  read-only preflight as the operating control and rated the remaining late-fail
  path rare.
