# Risk R002: Protected Tools Run Without Valid Authorization

**Status**: Active (auto-scaffolded - pending review)
**Curation**: pending review (auto-scaffolded 2026-08-27)
**Category**: infosec
**Identified**: 2026-08-27
**Owner**: pending review
**Last reviewed**: 2026-08-27
**Next review**: pending review

## Description

A protected tool may run for a caller who has no valid token or lacks the
required scope. Credentials may also leak through errors, logs, or tool-handler
context.

This could expose backend data or allow actions that the adopter intended to
protect.

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

- **Trigger to re-assess**: Any change to authentication, authorization,
  identity context, errors, or logging.
- **Metrics**: pending review.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs: pending review
- Personas affected: framework adopters and their users

## Source Evidence (auto-scaffolded 2026-08-27)

Aggregated from 2 `.risk-reports/` entries:

- `.risk-reports/2026-08-27T00-22-37-commit.md`
- `.risk-reports/2026-08-27T00-27-20-commit.md`

Re-rate after human review is recorded or controls change.

## Change Log

- 2026-08-27: Auto-scaffolded from recurring pipeline findings.
