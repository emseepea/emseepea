# Em See Pea brand style guide

- Status: Approved
- Last updated: 26 August 2026

This guide defines how to use the approved Em See Pea identity. Use the supplied
SVG assets without altering their geometry, colours, spacing, or composition.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/emseepea-signature-horizontal-colour-on-dark.svg">
  <img src="./assets/emseepea-signature-horizontal-colour-on-light.svg" alt="Em See Pea horizontal signature: a three-pea pod beside the words em, see, pea">
</picture>

## Quick selection guide

| Need | Preferred asset | Alternative |
|---|---|---|
| General brand identification | Horizontal signature | Stacked signature when width is limited |
| Square or vertically compact composition | Stacked signature | Mark when the name is already clear |
| Small, familiar brand presence | Mark | None |
| Name without the pod | Wordmark | Horizontal signature when space permits |
| One-colour production | Matching monochrome variant | None |

Choose the asset whose filename matches both the composition and its background.
Do not convert a light-background asset for dark use, or the reverse.

## Identity

The name is **Em See Pea**. The approved wordmark reads **em • see • pea**.
The pod combines an eye-like almond, three peas, an M-shaped opening, and a
middle pea partially obscured to form a subtle smile.

The wordmark lettering is outlined geometry derived from IBM Plex Sans
Semibold. It is artwork, not editable text. See the
[brand asset sources](./ASSET-SOURCES.md) for its source and licence.

## Approved assets

All production assets are SVGs in [`docs/brand/assets`](./assets/).

### Mark

Use the mark where the brand name is already present or the identity is familiar.

| Background | Colour | Monochrome |
|---|---|---|
| Light | [Colour mark for light backgrounds](./assets/emseepea-mark-colour-on-light.svg) | [Monochrome mark for light backgrounds](./assets/emseepea-mark-monochrome-on-light.svg) |
| Dark | [Colour mark for dark backgrounds](./assets/emseepea-mark-colour-on-dark.svg) | [Monochrome mark for dark backgrounds](./assets/emseepea-mark-monochrome-on-dark.svg) |

### Horizontal signature

This is the default full signature for repository previews, headers, and wide
layouts.

| Background | Colour | Monochrome |
|---|---|---|
| Light | [Colour horizontal signature for light backgrounds](./assets/emseepea-signature-horizontal-colour-on-light.svg) | [Monochrome horizontal signature for light backgrounds](./assets/emseepea-signature-horizontal-monochrome-on-light.svg) |
| Dark | [Colour horizontal signature for dark backgrounds](./assets/emseepea-signature-horizontal-colour-on-dark.svg) | [Monochrome horizontal signature for dark backgrounds](./assets/emseepea-signature-horizontal-monochrome-on-dark.svg) |

### Stacked signature

Use the stacked signature when the available space is closer to square or the
horizontal signature would become too small.

| Background | Colour | Monochrome |
|---|---|---|
| Light | [Colour stacked signature for light backgrounds](./assets/emseepea-signature-stacked-colour-on-light.svg) | [Monochrome stacked signature for light backgrounds](./assets/emseepea-signature-stacked-monochrome-on-light.svg) |
| Dark | [Colour stacked signature for dark backgrounds](./assets/emseepea-signature-stacked-colour-on-dark.svg) | [Monochrome stacked signature for dark backgrounds](./assets/emseepea-signature-stacked-monochrome-on-dark.svg) |

### Wordmark

Use the wordmark alone only when the pod is unnecessary or already appears
nearby. Do not recreate it with live type.

| Background | Colour | Monochrome |
|---|---|---|
| Light | [Colour wordmark for light backgrounds](./assets/emseepea-wordmark-colour-on-light.svg) | [Monochrome wordmark for light backgrounds](./assets/emseepea-wordmark-monochrome-on-light.svg) |
| Dark | [Colour wordmark for dark backgrounds](./assets/emseepea-wordmark-colour-on-dark.svg) | [Monochrome wordmark for dark backgrounds](./assets/emseepea-wordmark-monochrome-on-dark.svg) |

## Colour palette

These colours describe the identity assets. They are not a complete product UI
palette and do not replace semantic colours needed for interfaces.

| Name | Hex | Approved role |
|---|---|---|
| Pod dark | `#18231E` | Pod shell, outline, and light-background wordmark |
| Pea green | `#2D8A4E` | Peas and wordmark separators |
| Whisper mint | `#E8F6ED` | Pod interior and dark-background wordmark |
| Mint | `#73CB91` | Upper exterior keyline on dark-background colour assets only |
| Dark field | `#101A15` | Reference dark background |
| Monochrome light | `#F5FAF7` | Light artwork in dark-background monochrome assets |

### Colour accessibility

- Pod dark on white has a contrast ratio of `16.18:1`.
- Whisper mint on dark field has a contrast ratio of `15.95:1`.
- Mint on dark field has a contrast ratio of `9.05:1`.
- Pea green on white is `4.32:1`, and pea green on whisper mint is `3.88:1`.
  Do not use pea green for normal-size body text on either background.
- Do not rely on colour alone to communicate meaning.
- Use the supplied light- or dark-background variant rather than assuming an
  asset will remain legible on an arbitrary colour, gradient, or photograph.

## Composition and geometry

- Preserve the asset's aspect ratio.
- Keep all elements and their relative positions unchanged.
- Leave enough clear space that nearby text, controls, or edges do not appear
  to touch the artwork.
- Keep the complete artwork visible; never crop the pod terminals or wordmark.
- Test the asset at its final displayed size. If the peas, middle-pea smile, or
  wordmark separators are unclear, use a larger size or a simpler approved asset.

No fixed clear-space formula or minimum reproduction size has been approved.

## Background use

### Light backgrounds

Use an `on-light` asset on a plain light background. The complete dark almond
stroke is part of the approved light-background mark.

### Dark backgrounds

Use an `on-dark` asset on a plain dark background. Its mint keyline appears only
above the pod, with the lower edge open to the background. Do not add a lower
outline or fill the dark shell area with a light colour.

### Complex backgrounds

Do not place the identity directly on a busy image, pattern, gradient, or colour
that weakens its silhouette. Place it on a plain light or dark field and use the
matching asset.

## Accessibility and implementation

- When the identity conveys the organisation name, give it the accessible name
  `Em See Pea`.
- When nearby text already provides the same name, treat the image as decorative
  with empty alternative text or hide it from assistive technology.
- Do not expose both a visible wordmark and a duplicate accessible name if that
  causes the name to be announced twice.
- Preserve the SVG `<title>` when using the files directly. If an SVG is embedded
  through an HTML `img` element, provide the appropriate `alt` value there.
- Do not use the logo as the only label for an unfamiliar interactive control.

## Do not alter

Do not:

- redraw, simplify, or trace the artwork;
- recolour individual parts or add unapproved colours;
- stretch, compress, skew, rotate, or mirror it;
- change the wordmark lettering, separators, case, or spacing;
- change the spacing or alignment between the pod and wordmark;
- round, blunt, or extend the almond terminals;
- change the consistent stroke thicknesses;
- remove the pea occlusion that creates the middle-pea smile;
- add outlines, lower keylines, gradients, shadows, glows, textures, or other
  effects;
- place the light-background asset on dark backgrounds or the dark-background
  asset on light backgrounds; or
- rebuild a signature from separate mark and wordmark files when an approved
  signature already exists.

## Intentionally unspecified

This guide does not yet define a general typography system, voice and tone,
imagery style, icon family, spacing scale, UI design tokens, print rules, or
co-branding system. Do not infer those systems from the logo. Define them only
when a real product or communication need requires them.

## Pre-publication check

- [ ] The selected file matches the composition and background.
- [ ] The artwork has not been modified.
- [ ] The aspect ratio and complete silhouette are preserved.
- [ ] The mark and wordmark remain legible at the final size.
- [ ] The surrounding field is plain and provides sufficient contrast.
- [ ] The accessible name is useful and not duplicated.
- [ ] The use does not rely on colour alone.
