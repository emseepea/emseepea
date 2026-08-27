# Risk R005: Semantic Qualification Misses Wrong Meaning

**Status**: Active (auto-scaffolded - pending review)
**Curation**: pending review (auto-scaffolded 2026-08-27)
**Category**: delivery
**Identified**: 2026-08-27
**Owner**: pending review
**Last reviewed**: 2026-08-27
**Next review**: pending review

## Description

An example may return technically correct data while a language model draws the
wrong conclusion from it. The semantic test may also pass without exercising
the live Model Context Protocol result.

This can teach adopters to publish tools whose data is correct but misleading
in normal language-model use.

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

- **Trigger to re-assess**: Any example, semantic case, model, judge, provider,
  or evaluation-harness change.
- **Metrics**: pending review.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs: pending review
- Personas affected: adopters and end users of adopter-built servers

## Source Evidence (auto-scaffolded 2026-08-27)

Aggregated from 6 `.risk-reports/` entries:

- `.risk-reports/2026-08-27T05-05-38-commit.md`
- `.risk-reports/2026-08-27T05-28-33-commit.md`
- `.risk-reports/2026-08-27T06-21-25-commit.md`
- `.risk-reports/2026-08-27T06-22-57-commit.md`
- `.risk-reports/2026-08-27T11-59-09-commit.md`
- `.risk-reports/2026-08-27T12-20-22-commit.md`

Re-rate after human review is recorded or controls change.

## Change Log

- 2026-08-27: Auto-scaffolded from recurring pipeline findings.
