# Risk R006: Work Outlives Deadlines or Resource Bounds

**Status**: Active (auto-scaffolded - pending review)
**Curation**: pending review (auto-scaffolded 2026-08-27)
**Category**: operational
**Identified**: 2026-08-27
**Owner**: pending review
**Last reviewed**: 2026-08-27
**Next review**: pending review

## Description

Backend calls, token verification, or streaming work may continue after a
request is cancelled or timed out. Requests or responses may also exceed their
intended limits.

This could waste adopter resources, retain sensitive work longer than expected,
or make a server unavailable under load.

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

- **Trigger to re-assess**: Any deadline, cancellation, verifier, streaming,
  request-limit, or response-limit change.
- **Metrics**: pending review.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs: pending review
- Personas affected: framework adopters and their users

## Source Evidence (auto-scaffolded 2026-08-27)

Aggregated from 3 `.risk-reports/` entries:

- `.risk-reports/2026-08-27T00-22-37-commit.md`
- `.risk-reports/2026-08-27T00-27-20-commit.md`
- `.risk-reports/2026-08-27T12-00-32-commit.md`

Re-rate after human review is recorded or controls change.

## Change Log

- 2026-08-27: Auto-scaffolded from recurring pipeline findings.
