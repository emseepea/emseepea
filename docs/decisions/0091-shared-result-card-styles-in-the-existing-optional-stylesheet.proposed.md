---
status: "proposed"
date: 2026-09-15
human-oversight: pending
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review", "Accessibility review", "Design-system review", "Contrast review", "Style-guide review", "Voice and tone review", "Cognitive-accessibility review"]
informed: []
reassessment-date: 2026-12-15
---

# Shared Result Card Styles in the Existing Optional Stylesheet

## Plain English Summary

The optional `@emseepea/tailwind` stylesheet styles form views rooted at
`data-emseepea-part="view"`. Native, React, and Svelte Result Cards use
`data-emseepea-part="result-view"`, so the stylesheet does not style them.

This decision would extend the existing optional stylesheet to give all three
Result Card renderers the same accessible baseline. The renderers would remain
unstyled until an adopter imports the stylesheet. Adopters would keep control
of their domain content, actions, page structure, branding, and overrides.

## Context and Problem Statement

ADR-0084, Parallel React and Svelte Result Cards with Measured Bundle Guidance,
introduced equivalent unstyled Result Cards and explicitly excluded a Tailwind
change from that delivery. The native `renderResultView`, React `ResultCard`,
and Svelte `ResultCard` now emit the same stable Result Card parts, including a
root named `result-view`.

The precompiled `@emseepea/tailwind/styles.css` still scopes its root layout,
colour tokens, focus treatment, control sizing, narrow-screen reflow,
forced-colours rules, and reduced-motion rules to `view`. Importing the official
stylesheet therefore styles elicitation forms but leaves every Result Card
renderer at browser defaults. Result Cards retain their meaning and behaviour,
but the package does not provide the optional shared presentation adopters may
reasonably expect from that import.

ADR-0084's renderer and bundle decisions remain valid. Its Tailwind exclusion
described the scope of that delivery rather than a permanent prohibition.
ADR-0086, Application-Owned Styling with Public Host-Aware Theme Resolution,
also remains valid: renderers do not import styles, applications apply the
resolved theme, and applications retain control of styling and document
mutation. This is a new additive decision and supersedes neither ADR.

## Decision Drivers

- Give one optional stylesheet import the same baseline coverage for canonical
  form views and Result Cards.
- Keep native, React, and Svelte Result Card presentation equivalent.
- Preserve meaningful, operable Result Cards when the stylesheet is absent.
- Keep Tailwind, React, Svelte, and browser code out of non-UI server dependency
  closures.
- Preserve adopter ownership of domain behaviour, authority, page structure,
  branding, and optional style overrides.
- Serve JTBD-002, Add Optional Capabilities, and JTBD-101, Publish Installable
  Packages Safely.
- Make light, dark, forced-colours, reduced-motion, reflow, focus, contrast, and
  target-size requirements explicit and testable.
- Keep source, package, registry, website, and adopter-production evidence
  separate.

## Considered Options

1. **Extend the existing optional stylesheet (chosen)** - Style both `view` and
   `result-view` through the existing `@emseepea/tailwind/styles.css` import.
2. **Leave Result Card styling entirely to adopters** - Keep the official
   stylesheet limited to elicitation forms.
3. **Publish a separate Result Card stylesheet entry point** - Add another
   import so adopters choose form and Result Card styles independently.

## Decision Outcome

Chosen option: **"Extend the existing optional stylesheet"**, because the
existing public stylesheet already owns the checked optional presentation
baseline and one import avoids copied CSS, selector mapping, and a second
package entry point.

`@emseepea/tailwind/styles.css` covers the stable
`[data-emseepea-part="result-view"]` root and its documented parts as well as
the existing `[data-emseepea-part="view"]` form root. Native
`renderResultView`, React `ResultCard`, and Svelte `ResultCard` receive the same
presentation from the same stylesheet and shared fixtures. The implementation
does not add renderer-specific wrappers, classes, markup, or selector mapping,
and it does not rename either public root hook.

The renderers remain unstyled by default and do not import CSS. The Tailwind
package continues to export one precompiled CSS file with no JavaScript,
runtime Tailwind dependency, consumer Tailwind configuration, plugin, preset,
theme resolver, or document mutation. Importing or removing the stylesheet
changes presentation only. It does not change names, roles, states, DOM order,
focus behaviour, live-region behaviour, action dispatch, or effect authority.

The stylesheet provides a restrained baseline for layout, spacing, typography,
metrics, labelled lists, disclosure, actions, status, hints, and disclaimers.
It reuses the existing semantic custom properties and light-theme defaults.
Dark styles apply only when the adopter supplies the documented
`data-emseepea-theme="dark"` ancestor. The stylesheet does not choose a theme
or infer domain meaning from colour.

Adopters decide whether to import the stylesheet and may override or replace
its presentation. They retain domain parsing and mapping, calculations,
wording, business policy, actions, effect authorisation, authentication, page
shell, document language and title, skip link, landmarks, H1, routing, route
focus, host-theme application, branding, and application-specific styles. Em
See Pea does not turn Result Cards into a component library or broad design
system.

The brand style guide remains the authority for identity assets, not a source
for an inferred product UI system. Before implementation is released, narrow
product UI guidance records the accepted Result Card token roles, spacing,
layout, focus, and state patterns without expanding them into speculative
application-wide tokens.

## Accessibility Contract

The stylesheet preserves the native headings, definition lists, labelled
lists, `details` and `summary`, buttons, and persistent polite status region.
No visible or programmatic state depends on colour alone.

Light and dark fixtures must meet at least 4.5:1 contrast for normal text and
3:1 for large text, controls, component boundaries, and meaningful visual
states. Focus indicators must be visible and unobscured, use at least a
2-CSS-pixel perimeter-equivalent indicator, and provide at least 3:1 change of
contrast against adjacent colours. The current accent green may remain a
non-text affordance but must not become normal text unless its contrast reaches
4.5:1.

Keyboard focus remains visible on a focused Result Card root or status target,
the disclosure summary, links, and action buttons. Forced-colours mode uses
system colours without a blanket `forced-color-adjust: none`. Reduced-motion
mode covers Result Card descendants even when the first implementation adds no
animation. At 320 CSS pixels, content reflows without clipping, loss of content
or function, or two-dimensional page scrolling. Actions and disclosure
summaries meet the WCAG 2.2 AA 24 by 24 CSS pixel minimum; action buttons retain
the stylesheet's stronger 2.75rem minimum block size. Disabled actions remain
understandable without relying on opacity or colour alone.

## Evidence and Publication Boundary

Implementation is not complete until exact-commit source and continuous
integration evidence proves selector coverage and equivalent native, React,
and Svelte fixtures in light, dark, forced-colours, reduced-motion, keyboard,
focus, contrast, target-size, text-spacing, and 320-pixel reflow conditions.
Tests must also prove that removing the stylesheet changes presentation only.

Package evidence separately proves the packed stylesheet contents, fresh
installation, one-import consumer path, dependency boundary, and size budget.
After publication, anonymous exact-version registry readback must verify the
default npm channel, integrity and provenance evidence, and the expected
Result Card selectors in the downloaded CSS. Passing source or package checks
does not establish registry publication.

ADR-0044, Exact-Commit Trunk Push and Pipeline Watch, governs source delivery.
ADR-0049, Exact-Commit Release PR Merge and Pipeline Watch, governs release
continuation. A green workflow that is not bound to the intended commit is not
release evidence.

Under ADR-0034, One Source for Reader Guides, and ADR-0036, One Current
Documentation Set, the canonical public Result Card guide lives under
`website/src/content/docs/`. It shows the same optional import for native,
React, and Svelte, explains how the adopter applies light or dark host theme,
and states the ownership boundary. Published guidance receives the review
required by ADR-0023, Mandatory Cognitive-Accessibility Review for Published
Content. Exact website verification must bind the deployed revision and URL and
check the rendered light and dark journeys, keyboard and focus behaviour,
contrast, forced colours, reduced motion, target size, and 320-pixel reflow.
Registry verification does not prove the website, and website verification
does not prove the package registry.

`PUBLISHED` means the intended package version has passed its release and
registry evidence. It does not mean an adopter uses the package successfully.
Adopter `PROD_VERIFIED` requires independent evidence from the adopter's exact
deployed production revision and actual Result Card journey. Source checks,
Em See Pea release evidence, registry readback, and Em See Pea website checks
cannot substitute for that adopter evidence.

## Consequences

### Good

- One existing import provides a checked baseline for forms and Result Cards.
- Native, React, and Svelte Result Cards share one renderer-neutral style
  contract.
- Visual accessibility checks move to the reusable package boundary.
- Adopters can still omit, override, or replace the stylesheet.

### Neutral

- The existing public selector and custom-property compatibility boundary grows
  to cover Result Card parts.
- The Tailwind package remains a styling package despite serving renderers that
  do not use Tailwind at runtime.
- Product UI guidance gains only the narrow rules needed for this maintained
  component pattern.

### Bad

- Each new Result Card part or visual state adds parity and accessibility
  qualification work.
- Shared defaults may require adopter overrides for established brands or host
  constraints.
- The stylesheet grows and must remain inside its measured asset budget.

## Confirmation

The repository's decision compendium requires this section name. These are
future acceptance criteria, not completed evidence. After ratification,
implementation may be considered complete only when all of the following are
independently evidenced.

- The built stylesheet must target both `view` and `result-view` without changing
  either public hook.
- Native, React, and Svelte must render the same Result Card parts and receive the
  same styles from one public stylesheet import.
- Renderers must not import CSS, and non-UI servers must acquire no React, Svelte,
  Tailwind, or browser dependency.
- With the stylesheet absent, names, roles, states, order, focus, status
  announcements, action dispatch, and authority must remain unchanged.
- Light and dark text, surface, border, error, state, and focus colour pairs
  must meet the stated contrast thresholds.
- Keyboard, focus, text-spacing, forced-colours, reduced-motion, 320-pixel
  reflow, and target-size checks must pass for shared Result Card fixtures.
- Metrics, labelled lists, disclosure, actions, status, hints, and disclaimers
  must remain understandable without colour or motion.
- The existing 10 KiB raw and 3 KiB gzip stylesheet budgets must continue to pass.
- Narrow product UI guidance must record the accepted Result Card style contract;
  the identity-only brand guide is not treated as a product UI system.
- The canonical Result Card guide must document the optional import, theme
  application, renderer parity, and adopter boundary and pass cognitive
  accessibility review.
- Exact-commit source and CI, packed-package, anonymous exact-version registry,
  and exact deployed-website checks must each pass and remain separately
  reported.
- A package may be called `PUBLISHED` only after release and registry evidence;
  adopter `PROD_VERIFIED` requires independent exact-production adopter
  evidence.

## Pros and Cons of the Options

### Extend the Existing Optional Stylesheet

- Good, because one import reuses the current package and accessibility
  boundary.
- Bad, because adopters cannot import only the form or Result Card subset.

### Leave Result Card Styling Entirely to Adopters

- Good, because the package and compatibility surface do not grow.
- Bad, because every adopter must create and qualify the same baseline and the
  official import continues to cover only one canonical view type.

### Publish a Separate Result Card Stylesheet Entry Point

- Good, because adopters can select form and Result Card styles independently.
- Bad, because it creates another public entry point, import choice, package
  test path, and documentation branch without demonstrated need.

## Performance Review

This decision package changes no runtime or published asset. A later
implementation adds selectors and declarations to the existing stylesheet and
must remain within its current executable limits of 10 KiB raw and 3 KiB gzip.
No package-size, transfer, cache, or runtime-performance claim is established
until the exact built and packed CSS is measured.

## Reassessment Criteria

Reassess if the stable part contract cannot style all three renderers without
renderer-specific markup, shared defaults conflict materially with adopter or
host constraints, an accessibility regression cannot be fixed within the
common stylesheet, the CSS asset budget is exceeded, or demonstrated demand
justifies a separate entry point or broader product UI design system.

## Ratification Scope

Ratification approves this architecture decision only. It does not authorise
implementation, release, publication, website verification, or an adopter
`PROD_VERIFIED` claim.
