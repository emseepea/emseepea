# Risk R001: Published Content Is Not Understandable

**Status**: Active
**Category**: brand
**Identified**: 2026-08-27
**Owner**: Documentation maintainer
**Last reviewed**: 2026-08-27
**Next review**: 2027-02-27

## Description

Public prose generated or written for Em See Pea may be technically accurate
but too dense, poorly structured, unexplained, or difficult to navigate for
ordinary readers. People using mobile screens, people with cognitive
disabilities, and fatigued readers may be unable to find, understand, remember,
or act on essential information.

The risk has already occurred: the root README presented detailed verification
evidence as a long paragraph that became an unreadable wall of text on mobile.
Structural Markdown checks did not detect the comprehension failure.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 5 (Almost certain)
- **Inherent Score**: 20
- **Inherent Band**: Very High

## Controls

- **Mandatory cognitive-accessibility review** - Every changed public prose file
  receives specialist review before publication. `QUALITY.md` and the mandatory
  cognitive-accessibility review decision define the rule.
- **Published-content baseline audit** - Existing public prose is inventoried
  and reviewed before the first package release. `QUALITY.md` defines the audit.
- **README density regression guard** - A runnable test rejects unusually long
  root README prose paragraphs. This is a regression signal, not proof that
  readers understand the content.
- **Progressive evidence disclosure** - Primary tasks use short, plain sections.
  Detailed evidence stays available through descriptive links.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 5 (Almost certain)
- **Residual Score**: 20
- **Residual Band**: Very High
- **Within appetite?**: No

## Treatment

Mitigate. Residual risk remains the same as inherent risk until there is
evidence that the baseline audit, specialist review gate, and automated guard
are working across every published prose surface.

Publication remains blocked while the residual score is above the 5/25 appetite.

## Monitoring

- **Trigger to re-assess**: Any changed published prose, failed cognitive-
  accessibility review, density-guard failure, reader report of confusion, or
  new publication surface.
- **Metrics**: Reviewed changed surfaces versus total changed surfaces; baseline
  surfaces remaining; density-guard failures; reader comprehension reports.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none
- Treatment ADRs: mandatory cognitive-accessibility review for published content
- Personas affected: adopters, contributors, maintainers, and public readers

## Change Log

- 2026-08-27: Initial identification and conservative rating after the realised
  mobile README comprehension failure.
