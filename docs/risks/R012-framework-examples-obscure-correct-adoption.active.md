# Risk R012: Framework Examples Obscure Correct Adoption

**Status**: Active
**Category**: delivery
**Identified**: 2026-08-28
**Owner**: Framework developer-experience maintainer
**Last reviewed**: 2026-08-28
**Next review**: 2027-02-28

## Description

Examples may hide the important idea behind repeated schemas, unclear mapping
code, or too much setup.

This has already happened. One example repeated the same schema, used a mapped-
tool definition that was hard to follow, and looked up a bean by ID instead of
showing a useful task.

If examples stay this way, adopters may copy the wrong pattern or stop using
the framework.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 5 (Almost certain)
- **Inherent Score**: 20
- **Inherent Band**: Very High

## Controls

- **Minimal-boilerplate decision** - Optional React and Tailwind packages own
  their reusable integration code instead of placing it in every example.
  Defined in
  [ADR-0011: accessible elicitation and approval UI](../decisions/0011-framework-neutral-accessible-elicitation-and-approval-ui.proposed.md).
- **Meaningful examples** - Examples demonstrate useful questions and explicit
  outcomes rather than identifier lookups or hidden effects. Required by
  `QUALITY.md` and checked by semantic Model Context Protocol (MCP) evaluation.
- **Package-boundary checks** - Examples must import the public package entry
  points. Reusable framework behaviour must not be hidden in example-only
  helpers. Required by
  `QUALITY.md`.
- **Human comprehension review** - Changed public examples and their
  documentation receive cognitive-accessibility review before publication.
  Required by `QUALITY.md`.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 5 (Almost certain)
- **Residual Score**: 20
- **Residual Band**: Very High
- **Within appetite?**: No

## Treatment

Mitigate. Residual risk remains the same as inherent risk until independent
readers can complete the getting-started paths, explain the important
boundaries, and use the examples without copying unnecessary setup.

Publication remains blocked while the residual score is above the 5/25
appetite.

## Monitoring

- **Trigger to re-assess**: Any public API, example, getting-started path,
  reusable helper, or adopter report of confusion or excessive setup.
- **Metrics**: Repeated adopter-owned setup; unexplained concepts per example;
  tested getting-started completions; reader comprehension reports.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs:
  [ADR-0011: Framework-Neutral Accessible Elicitation and Approval UI](../decisions/0011-framework-neutral-accessible-elicitation-and-approval-ui.proposed.md)
- Personas affected: framework adopters, example readers, contributors, and
  maintainers

## Change Log

- 2026-08-28: Initial identification after repeated schemas, opaque mapping,
  and low-value example behaviour were reported.
