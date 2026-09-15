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

## Documentation renderer tabs

The Result Card guide may present its synchronized Native HTML, React, and
Svelte instructions as compact file-style tabs. This is a documentation
pattern, not part of the optional Result Card stylesheet or a general product
UI component.

Keep Starlight's `Tabs` and `TabItem` semantics, keyboard behaviour,
synchronization, and persistence. Scope every visual override beneath
`.renderer-tabs > starlight-tabs[data-sync-key="result-card-renderer"]`. The
tabs control the renderer-specific prose and code together. Shared guidance
and optional Tailwind styling remain outside the tab panels.

Use Starlight theme properties rather than Result Card properties or new
hardcoded colours. Use `--sl-color-gray-2` for unselected text,
`--sl-color-white` for selected text, `--sl-color-text-accent` for the selected
indicator and focus outline, and `--sl-color-gray-3` for structural boundaries.
Use `--sl-color-gray-6` for the dark header surface and `--sl-color-gray-7` for
the light header surface. Tabs use `--sl-text-sm`, the existing system font,
and weight 600 for the selected label.

Each tab is at least `2.75rem` high. The tab row may scroll horizontally, but
must not truncate labels or cause page-level overflow. Selection uses weight
and a boundary indicator as well as colour. Keyboard focus uses an explicit
2 CSS pixel outline and remains unobscured. Forced-colours mode uses system
colours. Do not add animation.

Keep code-block title metadata when it supplies the copy button's accessible
name. Redundant title chrome may be hidden only inside renderer tabs while
scripting is active; restore the code frame's complete border and radius. With
JavaScript unavailable and in print, hide inactive controls, expose every
renderer panel, show an explicit renderer label for each panel, and remove the
attached-shell decoration.

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
- Do reuse the scoped documentation renderer-tab pattern. Do not restyle every
  Starlight tab or Expressive Code frame.

The `wr-style-guide:agent` reads this file when it reviews product UI changes.
