# Risk R008: Official UI Is Inaccessible

**Status**: Active
**Category**: delivery
**Identified**: 2026-08-28
**Owner**: UI package maintainer
**Last reviewed**: 2026-08-28
**Next review**: 2027-02-28

## Description

An official native or React user interface (UI) renderer may prevent people
from understanding or completing an interaction. Failures may affect keyboard
use, screen-reader output, focus, status messages, contrast, zoom, reflow, or
target size.

Because adopters are likely to reuse official renderers, one defect could be
copied into many deployed Model Context Protocol (MCP) servers.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 4 (Likely)
- **Inherent Score**: 16
- **Inherent Band**: High

## Controls

- **Renderer accessibility contract** - Official renderers must use native
  semantics, deterministic focus, accessible status messages, and Web Content
  Accessibility Guidelines (WCAG) 2.2 AA presentation. Defined in
  [ADR-0011: accessible elicitation and approval UI](../decisions/0011-framework-neutral-accessible-elicitation-and-approval-ui.proposed.md).
- **Required UI checks** - UI examples must test keyboard operation, accessible
  names, focus, status messages, color themes, and WCAG 2.2 AA. Defined in
  `QUALITY.md`.
- **Independent manual evidence** - Every official renderer release requires
  keyboard and screen-reader evidence. Defined in ADR-0011.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 4 (Likely)
- **Residual Score**: 16
- **Residual Band**: High
- **Within appetite?**: No

## Treatment

Mitigate. The controls are requirements, not completed evidence. Keep UI
package publication blocked until native and React renderers pass automated and
manual checks across every supported interaction state.

## Monitoring

- **Trigger to re-assess**: Any renderer, shared UI contract, stylesheet,
  interaction state, React version, or browser-support change.
- **Metrics**: Qualified states versus supported states; unresolved automated
  findings; unresolved keyboard or screen-reader findings.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs:
  [ADR-0011: Framework-Neutral Accessible Elicitation and Approval UI](../decisions/0011-framework-neutral-accessible-elicitation-and-approval-ui.proposed.md)
- Personas affected: UI users, framework adopters, and UI package maintainers

## Change Log

- 2026-08-28: Initial identification before the first official UI renderer.
