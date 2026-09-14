# Cognitive Accessibility Review - 2026-09-15

## Dynamic Result Card Guide

Result: PASS. An independent cognitive-accessibility specialist reviewed the
canonical result-card guide. The guide now says when to create a new
`ResultView`, where to put the adapter, and which responsibilities remain in
the domain layer. The native, React, and Svelte examples show how the current
checked result reaches the renderer. No cognitive-accessibility findings remain
in scope.

The reviewed source file and matching SHA-256 digest are:

- `website/src/content/docs/result-cards.md`
  SHA-256: `f54f8b4bc3f36bfeefafbda45265f85acd8a6d0de51be8f51cb54166d7310ea4`

Scope: Source Markdown clarity and cognitive accessibility only. This review
does not establish rendered accessibility, test results, continuous
integration, publication, registry verification, exact-host behavior, or
adopter production verification.

## Deprecated Client-Logging Guidance Decision

Result: PASS. An independent cognitive-accessibility specialist reviewed
ADR-0090 and its generated decision index. The decision limits this increment
to client-visible logging, states the documentation-only boundary, and keeps
client roots and Sampling as separate decisions. Its options, consequences,
and confirmation checks are ready for human ratification.

| Reviewed file | SHA-256 |
| --- | --- |
| `docs/decisions/0090-deprecated-client-logging-kept-out-of-adoption-guides.proposed.md` | `092b204541fc0bf5f01d83309b0dffc0054eb60c1b3647747da5cf332e954079` |
| `docs/decisions/README.md` | `4ead9239258fb90a190114ba6fd1c8afb159489fafad79f82c015eb0b8967f39` |

Scope: Source Markdown clarity and cognitive accessibility only. This review
does not establish ratification, implementation, test results, continuous
integration, publication, registry verification, or adopter production
verification.
