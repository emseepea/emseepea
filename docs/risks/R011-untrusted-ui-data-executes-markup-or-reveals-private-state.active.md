# Risk R011: Untrusted UI Data Executes Markup or Reveals Private State

**Status**: Active
**Category**: information security
**Identified**: 2026-08-28
**Owner**: Framework security maintainer
**Last reviewed**: 2026-08-28
**Next review**: 2027-02-28

## Description

Official user interface (UI) renderers receive text and state from framework
users. If a renderer treats that data as markup, untrusted content could run
inside an adopter's page.

The UI data must also avoid secrets and private backend details. This includes
credentials, private state, browser destinations, and anything else that should
not be sent to a browser.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 5 (Severe)
- **Likelihood**: 4 (Likely)
- **Inherent Score**: 20
- **Inherent Band**: Very High

## Controls

- **Browser-safe UI schema** - The public UI contract accepts only simple,
  size-limited display data. It excludes raw HTML, credentials, private
  transport details, destinations, and permission to perform an action. Defined in
  [ADR-0011: accessible elicitation and approval UI](../decisions/0011-framework-neutral-accessible-elicitation-and-approval-ui.proposed.md).
- **Escaped native rendering** - The native renderer must treat every supplied
  value as text. Required in `packages/framework/src/ui.ts`.
- **No raw HTML option** - The React renderer must render supplied text as text.
  It must not provide an option that inserts supplied text as HTML. Required in
  `packages/react/src/index.tsx`.
- **Hostile-input tests** - Tests must cover markup, script-like text, unknown
  fields, excessive input, and prohibited private fields. Required by
  `QUALITY.md`.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 5 (Severe)
- **Likelihood**: 4 (Likely)
- **Residual Score**: 20
- **Residual Band**: Very High
- **Within appetite?**: No

## Treatment

Avoid executable presentation data and private-state disclosure. Residual risk
remains the same as inherent risk until the schema, both renderers, and hostile-
input tests pass independent review and tests from a fresh checkout.

Publication of the affected UI packages remains blocked while the residual
score is above the 5/25 appetite.

## Monitoring

- **Trigger to re-assess**: Any UI schema, renderer, serialization boundary,
  raw-HTML feature, browser state, or private-field change.
- **Metrics**: Rejected prohibited fields; hostile-input cases passed; escaping
  defects; private-state disclosures.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs:
  [ADR-0011: Framework-Neutral Accessible Elicitation and Approval UI](../decisions/0011-framework-neutral-accessible-elicitation-and-approval-ui.proposed.md)
- Personas affected: UI users, framework adopters, and their users

## Change Log

- 2026-08-28: Initial identification before the first official UI renderer.
