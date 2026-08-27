# Risk R009: UI Presentation Is Mistaken for Effect Authority

**Status**: Active
**Category**: information security
**Identified**: 2026-08-28
**Owner**: Framework security maintainer
**Last reviewed**: 2026-08-28
**Next review**: 2027-02-28

## Description

A client-controlled form, route, hidden value, or local state may be treated as
permission to perform an effect. An effect is a server action that changes data
or calls another system. A user interface (UI) may also tell a person that an
action was completed when the server did not authorize or perform it.

This could cause unauthorized actions, repeated actions, or false confidence
about an important outcome.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 5 (Severe)
- **Likelihood**: 3 (Possible)
- **Inherent Score**: 15
- **Inherent Band**: High

## Controls

- **Server-owned authority** - Only authenticated server confirmation may
  authorize an effect, using a server-created handle that is limited to one
  purpose and can be used once. Defined in
  [ADR-0011: accessible elicitation and approval UI](../decisions/0011-framework-neutral-accessible-elicitation-and-approval-ui.proposed.md).
- **Presentation-safe public model** - The public UI contract must exclude
  credentials, private backend state, destinations, and effect authority.
  Defined in ADR-0011.
- **Negative-flow requirement** - Client presentation must be unable to
  authorize effects, including expired, replayed, or concurrent attempts.
  Defined in ADR-0011 and `QUALITY.md`.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 5 (Severe)
- **Likelihood**: 3 (Possible)
- **Residual Score**: 15
- **Residual Band**: High
- **Within appetite?**: No

## Treatment

Avoid unauthorized client authority and mitigate misleading outcomes. The
controls are not yet implemented or proven, so effect-capable UI publication
remains blocked. A presentation-only preview must say that it did not perform a
server action.

## Monitoring

- **Trigger to re-assess**: Any approval endpoint, effect action, UI handle,
  client-side state, replay protection, or outcome-message change.
- **Metrics**: Negative-flow cases with zero effects; unauthorized or repeated
  effects; outcomes whose UI message disagrees with server evidence.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs:
  [ADR-0011: Framework-Neutral Accessible Elicitation and Approval UI](../decisions/0011-framework-neutral-accessible-elicitation-and-approval-ui.proposed.md)
- Personas affected: UI users, framework adopters, and their backend systems

## Change Log

- 2026-08-28: Initial identification before effect-capable UI exists.
