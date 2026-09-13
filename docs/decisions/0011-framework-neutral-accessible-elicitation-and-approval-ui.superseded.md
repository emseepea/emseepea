---
status: "proposed"
date: 2026-08-27
human-oversight: confirmed
oversight-date: 2026-08-27
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
---

# Framework-Neutral Accessible Elicitation and Approval UI

## Context and Problem Statement

Form and URL elicitation can gather information or navigate a person, but neither
is authority for an effect. Em See Pea must make accessible UI straightforward
for server-rendered HTML and modern stacks such as React and Tailwind without
putting frontend dependencies or approval authority into the core runtime.

## Decision Drivers

- Navigation consent and effect approval are different decisions.
- Fastify remains the framework server boundary.
- UI consumers need deterministic public schemas and action endpoints.
- React, Tailwind, and other UI stacks must remain easy opt-ins.
- Minimal adopter and example boilerplate is a critical requirement.
- Every official UI must meet the same WCAG 2.2 AA and security gates.
- Core must not acquire frontend runtime dependencies.

## Considered Options

1. **Optional React renderer and Tailwind style packages** - Keep authority and
   canonical view models on the server; publish isolated behavior and styling packages.
2. **React package with example-local Tailwind integration** - Publish the
   renderer but make each example or adopter configure and maintain its styling.
3. **Native server-rendered UI only** - Support only Fastify-rendered HTML.
4. **Bundle React and Tailwind into core** - Make one frontend stack mandatory.
5. **Client-controlled approval** - Treat navigation or client state as effect authority.

## Decision Outcome

Chosen option: **"Optional React renderer and Tailwind style packages"**.

Em See Pea owns the authenticated approval state machine, Fastify endpoints,
canonical validated schemas and view models, CSRF protection, safe effect
summary, action availability, expiry, replay and concurrency handling, atomic
confirmation, and effect execution. Only an authenticated server confirmation
using an opaque, scoped, single-use handle can authorize an effect. Client
navigation, hidden fields, route state, or local UI state never authorizes one.

The public UI contract contains only presentation-safe data: titles, headings,
visible labels and descriptions, field groups, constraints, validation errors,
safe actor/resource/action summaries, expiry, action labels, status messages,
and deterministic focus targets. It contains no credential, private backend
state, destination, or effect authority. Compatibility changes follow ADR-0006.

The first opt-in modern UI includes separately installable
`@emseepea/react` and `@emseepea/tailwind` packages plus an
`examples/react-tailwind-ui` workspace that consumes both. The renderer has an
ordinary dependency on
`@emseepea/server`, required `react` and `react-dom` peer dependencies covering
only qualified major versions, and matching development dependencies for its
own tests. Core declares no React, React DOM, or Tailwind peer, optional, or
runtime dependency.

The React package exports unstyled semantic renderers for the canonical
descriptor union and only the presentation-state, action, and focus hooks used
by the example. It reuses core contract types and accepts bounded class or slot
styling hooks. It does not provide a component library, theme API, Tailwind
classes, HTTP or authentication client, safe-summary logic, handle management,
or client-side approval authority. Host applications retain ownership of
document language, title, skip link, main landmark, H1, and routing.

The Tailwind package exports one precompiled public stylesheet that styles
stable semantic selectors, documented `data-emseepea-*` parts and variants, and
documented `--emseepea-*` custom properties. Tailwind is its development
dependency only; consumers need no Tailwind dependency, peer, configuration,
plugin, preset, source theme, or selector mapping. The style package contains no
JavaScript, React component, document structure, state, HTTP client,
authentication, safe-summary logic, handle management, or approval authority.
It never generates meaningful text or replaces native or ARIA state with data
attributes. Selector and property compatibility follows ADR-0006.

The example imports the React package and exactly one public Tailwind-package
stylesheet. Example-owned code is limited to the page shell, synthetic data,
and invoking public package APIs; it does not copy package-owned components,
focus logic, state handling, CSS, or Tailwind integration. This measurable
boilerplate boundary is a release criterion.

Both optional packages have independent install, build, test, and accessibility
dependency closure and initially release in lockstep with core. Independent
versioning or another renderer package requires demonstrated need and a new
decision. Publication remains gated by ADR-0003's review of support boundaries,
provenance, registry permissions, and committed qualification checks. No UI
asset performance claim is made until a representative measured CSS budget is
approved before package release.

## Renderer Accessibility Contract

Official renderers use native HTML semantics before ARIA. They expose visible
labels and descriptions, native form submission, grouped controls, associated
errors, named actions, and polite status announcements unless a blocking error
is genuinely urgent. Client state is presentation-only; busy, disabled, expired,
error, and terminal states are derived from server responses.

Each page or routed view provides the correct document language, a unique title,
a skip link, one main landmark, one page-specific H1, and sequential descriptive
headings. Route changes focus the new H1 or main content. Hydration preserves one
control set, DOM order, keyboard operation, and visible focus; it must not leave
focus on removed elements. Validation focuses an error summary or first invalid
field. Terminal outcomes provide a deterministic focus target and next action.

Reusable components do not silently own the document title, main landmark, H1,
or heading level. Icons beside visible text are hidden from assistive technology;
icon-only controls are named on the control. Meaningful images and SVGs have
appropriate text alternatives, decorative media is hidden, and complex visuals
have adjacent or referenced descriptions.

Custom widgets must follow the relevant WAI-ARIA Authoring Practices keyboard
and state pattern. Overlay implementations must additionally provide a labelled
dialog, initial focus, contained Tab order, Escape or cancel behavior, and focus
return.

The Tailwind stylesheet preserves 4.5:1 normal-text contrast, 3:1 large-text and
non-text control contrast, visible and unobscured focus, non-color-only states,
forced-colors support, reduced motion, zoom and reflow, and WCAG 2.2 AA target
size. It styles actual native or ARIA states such as `:disabled`, `:required`,
`:focus-visible`, `[aria-invalid]`, and `[aria-busy]`; data attributes are for
parts and visual variants, never semantic or authorization state. Removing the
stylesheet changes presentation only, not names, roles, states, order, focus,
submission, or server authority.

## Consequences

### Good

- React is separately installable without entering the core dependency path.
- Tailwind styling is one import with no adopter configuration or copied CSS.
- The React/Tailwind example exercises both packages adopters install.
- Vue, Svelte, native HTML, and future UI stacks share the same stable boundary.
- Approval authority and accessible state remain server-controlled.
- Two narrow packages meet proven demand without creating a component or theme system.

### Neutral

- Fastify is still the server foundation; only UI consumption is framework-neutral.
- The React and Tailwind packages release with core initially.
- UI asset performance remains unclaimed until a measured budget is approved.

### Bad

- Adopters using another UI framework implement their own renderer.
- Every official renderer adds accessibility and security qualification work.
- React peer ranges can cover only majors that the package qualifies.
- Stable public CSS hooks require compatibility review.

## Confirmation

- Native and React/Tailwind examples render the same shared fixtures and states.
- The React/Tailwind example imports `@emseepea/react`, not private source.
- The example uses exactly one `@emseepea/tailwind` stylesheet import.
- The example has zero Tailwind config, plugin, theme CSS, or selector mapping.
- Tailwind dependencies exist only in the Tailwind package's development closure.
- Security and approval negative-flow tests pass.
- Client presentation cannot authorize effects.
- Keyboard and screen-reader users complete every interaction state.
- Automated WCAG 2.2 AA and hydration checks pass.
- Manual keyboard and screen-reader evidence accompanies every official renderer release.
- Document title, language, skip link, main landmark, H1, heading, image, SVG, and icon rules pass.
- Core installation and no-UI examples install without React, React DOM, or Tailwind.
- Both optional packages install, build, test, and pass accessibility checks independently.
- Embedded package renderers do not create a title, language, main, H1, or fixed heading level.
- Shared native and React fixtures pass with and without the published stylesheet.
- Focus, contrast, forced-colors, reduced-motion, reflow, and target-size checks pass.

## Pros and Cons of the Options

### Optional React renderer and Tailwind style packages

- Good: Gives React and Tailwind adopters direct low-boilerplate install paths.
- Bad: Adds two package and qualification boundaries.

### React package with example-local Tailwind integration

- Good: Publishes only one additional package.
- Bad: Duplicates integration work and styling drift across examples and adopters.

### Native server-rendered UI only

- Good: Has the smallest frontend dependency surface.
- Bad: Makes modern UI adoption unnecessarily difficult.

### Bundle React and Tailwind into core

- Good: Makes one polished stack immediately available.
- Bad: Burdens every adopter and makes a styling tool part of the server runtime.

### Client-controlled approval

- Good: Is easy to render.
- Bad: Cannot safely authorize server effects.

## Reassessment Criteria

Reassess when independent versioning is needed, a second official UI stack has
demonstrated demand, consumers need broader component or styling APIs, measured
asset performance requires a different delivery form, or the approval threat
model changes.
