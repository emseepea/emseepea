# Risk R003: Checked Boundaries Fail or Expose Backend Data

**Status**: Active (auto-scaffolded - pending review)
**Curation**: pending review (auto-scaffolded 2026-08-27)
**Category**: infosec
**Identified**: 2026-08-27
**Owner**: pending review
**Last reviewed**: 2026-08-27
**Next review**: pending review

## Description

Input mapping, backend calls, or output mapping may bypass their declared
schemas. A caller could then select private backend details, receive unvalidated
data, or trigger the wrong operation.

The failure could affect tools, resources, prompts, templates, or completion.

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

- **Trigger to re-assess**: Any new operation type, adapter, mapper, schema, or
  dispatch route.
- **Metrics**: pending review.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs: pending review
- Personas affected: framework adopters and their users

## Source Evidence (auto-scaffolded 2026-08-27)

Aggregated from 4 `.risk-reports/` entries:

- `.risk-reports/2026-08-27T01-47-06-commit.md`
- `.risk-reports/2026-08-27T02-00-14-commit.md`
- `.risk-reports/2026-08-27T02-53-14-commit.md`
- `.risk-reports/2026-08-27T03-31-58-commit.md`

Re-rate after human review is recorded or controls change.

## Change Log

- 2026-08-27: Auto-scaffolded from recurring pipeline findings.
