# Risk R007: Release Pipeline Publishes the Wrong or Compromised Package

**Status**: Active (auto-scaffolded - pending review)
**Curation**: pending review (auto-scaffolded 2026-08-27)
**Category**: infosec
**Identified**: 2026-08-27
**Owner**: pending review
**Last reviewed**: 2026-08-27
**Next review**: pending review

## Description

Release automation, dependencies, credentials, or package metadata may be
compromised or misconfigured. The pipeline could publish the wrong package,
wrong revision, or unsafe contents.

Because adopters install the published package, this could spread compromised
code beyond the repository.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: not estimated - no prior data
- **Likelihood**: not estimated - no prior data
- **Inherent Score**: not estimated - no prior data
- **Inherent Band**: not estimated - no prior data

## Controls

None recorded. Pending human review.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: not estimated - no prior data
- **Likelihood**: not estimated - no prior data
- **Residual Score**: not estimated - no prior data
- **Residual Band**: not estimated - no prior data
- **Within appetite?**: pending - scoring not estimated

## Treatment

Pending.

## Monitoring

- **Trigger to re-assess**: Any dependency, workflow, credential, package,
  provenance, or publication change.
- **Metrics**: pending review.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs: pending review
- Personas affected: package consumers, adopters, and maintainers

## Source Evidence (auto-scaffolded 2026-08-27)

Aggregated from 5 `.risk-reports/` entries:

- `.risk-reports/2026-08-26T22-06-14-commit.md`
- `.risk-reports/2026-08-26T22-22-35-commit.md`
- `.risk-reports/2026-08-26T22-27-24-commit.md`
- `.risk-reports/2026-08-27T00-59-47-commit.md`
- `.risk-reports/2026-08-27T06-21-25-commit.md`

Re-rate after human review is recorded or controls change.

## Change Log

- 2026-08-27: Auto-scaffolded from recurring pipeline findings.
