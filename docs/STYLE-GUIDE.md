# Em See Pea product UI style guide

- Status: Approved
- Last reviewed: 15 September 2026

This guide defines the narrow product UI contract maintained by Em See Pea.
The [brand style guide](brand/STYLE-GUIDE.md) remains authoritative for identity
assets and colours.

## Optional Result Card contract

Importing `@emseepea/tailwind/styles.css` applies component defaults to
`[data-emseepea-part="result-view"]` and its stable parts. These defaults are
not an application-wide design system. Applications still own their page
shell, theme application, branding, and overrides.

Result Cards reuse the stylesheet's existing `--emseepea-bg`,
`--emseepea-surface`, `--emseepea-text`, `--emseepea-border`,
`--emseepea-accent`, `--emseepea-focus-inner`, `--emseepea-focus-outer`, and
`--emseepea-error` properties. Their roles are the canvas, supporting surface,
text, component boundary, non-text accent, focus separator, focus ring, and
error text or boundary, respectively. Text pairs meet at least 4.5:1 contrast;
component boundaries, non-text accents, and focus indicators meet at least
3:1. Do not add another token tier for this pattern.

The root keeps a `42rem` maximum inline size, responsive `1rem` to `2rem`
padding, a `0.125rem` border, `0.75rem` radius, system typography, and `1.5`
line height. Sections use a local `1rem` rhythm. Metrics use a wrapping grid
and actions use a wrapping flex layout. Content wraps without truncation or
fixed heights, including at `20rem` viewport width.

Use font weight, not accent colour, to emphasise headlines and metrics. The
light pea green does not meet the normal-text contrast requirement. Keep the
existing two-colour focus indicator on the Result Card root and its controls.
Actions are at least `2.75rem` in both dimensions; disclosure summaries are at
least 24 by 24 CSS pixels. Status text carries state meaning, and disabled
actions use a dashed border as well as reduced opacity. Forced-colours mode
uses system colours, reduced-motion preferences cover descendants, and native
disclosure markers remain visible.

The brand guide governs identity assets and their colours; it does not choose
product UI tokens. Do not use these defaults to change identity artwork, infer
domain meaning, authorise actions or effects, choose the application theme, or
alter renderer semantics.

## Do and do not

- Do scope shared defaults to stable `data-emseepea-part` hooks. Do not add
  renderer-specific classes or wrappers.
- Do keep the stylesheet optional. Do not import it from a renderer.
- Do preserve native headings, lists, disclosures, links, and buttons. Do not
  choose semantics for their appearance.
- Do keep state meaning in text and native attributes. Do not rely on colour,
  opacity, or motion alone.
- Do let applications override presentation. Do not turn this contract into a
  general component library.

The `wr-style-guide:agent` reads this file when it reviews product UI changes.
