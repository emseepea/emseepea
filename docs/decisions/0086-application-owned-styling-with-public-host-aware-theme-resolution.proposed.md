---
status: "proposed"
date: 2026-09-13
human-oversight: confirmed
oversight-date: 2026-09-13
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
reassessment-date: 2026-12-13
supersedes: [0011-framework-neutral-accessible-elicitation-and-approval-ui]
---

# Application-Owned Styling with Public Host-Aware Theme Resolution

## Context and Problem Statement

`useMcpApp()` can provide a validated optional theme (`"light"` or `"dark"`)
from a Model Context Protocol (MCP) host. React applications that also run in an
ordinary browser must currently add their own code to detect colour-scheme
preferences, respond when those preferences change, remove event listeners
during cleanup, and avoid browser-only APIs while rendering on a server. One
production application still contains this local hook after adopting Em See Pea
for its MCP Apps lifecycle.

ADR-0011 deliberately excluded a theme API from `@emseepea/react`. This
decision makes the narrow exception needed to own theme resolution without
owning styling, document mutation, design tokens, classes, or a design system.
It supersedes ADR-0011 while preserving its other boundaries.

## Decision Drivers

- Reuse validated MCP host context instead of copying browser edge-case code.
- Keep the host theme authoritative when the host supplies one.
- Preserve useful standalone and development-harness behaviour outside a host.
- Keep server rendering free from `window` access during render.
- Leave all styling and document mutation application-owned.
- Keep React optional for servers without a user interface.
- Avoid adding a dependency or a cross-framework theme system.

## Considered Options

1. **Public `useMcpTheme` resolver hook (chosen)** - Resolve an optional validated
   host theme against the browser preference and return `"light" | "dark"`.
2. **Adopter-owned resolver** - Continue exposing only
   `useMcpApp().hostContext.theme` and let each adopter maintain the fallback.
3. **Resolved theme on `useMcpApp`** - Add the browser-derived value to the
   lifecycle connection even when an adopter only needs theme resolution.

## Decision Outcome

Chosen option: **"Public `useMcpTheme` resolver hook"**, because it centralises
the repeated reactive and server-rendering-safe browser boundary while keeping
the existing MCP Apps connection and application styling boundaries separate.

`@emseepea/react` exports `useMcpTheme(hostTheme?)`. The optional input is the
validated `"light" | "dark"` value exposed by `useMcpApp().hostContext.theme`.
When present, the host value wins. When absent, the hook returns the browser's
`prefers-color-scheme: dark` preference and reacts when that preference changes.
During server rendering, the hook returns `"light"`, and render does not access
`window`.

The hook returns only `"light" | "dark"`. It does not mutate the document,
apply an attribute or class, import CSS, prescribe tokens, retain host state, or
take responsibility for application side effects. Adopters decide whether and
where to apply the value.

This is a narrow replacement for ADR-0011's prohibition on a React theme API.
All other ADR-0011 boundaries remain: renderers stay unstyled, the Tailwind
package owns only its stylesheet, and applications retain document structure,
routing, styles, and responsibility for application side effects. No equivalent
Svelte helper is added without demonstrated demand because Svelte's binding
model differs and the current request is specifically repeated React hook code.

Ratified outcome: `@emseepea/react` adds this narrowly scoped public hook and
supersedes only ADR-0011's prohibition on a React theme API.

## Consequences

### Good

- React adopters share one host-first, standalone-capable resolver.
- Subscription cleanup and server-rendering safety are maintained once.
- Applications keep full control of styling and document mutation.
- The server package and non-UI adopters gain no React or browser dependency.

### Neutral

- Adopters still apply the returned value to their chosen styling boundary.
- When no host value exists, server-rendered HTML initially uses `"light"`.
  After React starts in the browser, the hook reads and applies the browser
  preference. This may cause an initial light-to-dark change.

### Bad

- `@emseepea/react` gains a public compatibility surface for browser theme
  resolution.
- The React and Svelte bindings are intentionally asymmetric until a Svelte
  adopter demonstrates the same need.

## Confirmation

- Package tests prove the host theme wins over either system preference.
- Browser tests prove an absent host theme follows system preference changes.
- Tests prove preference listeners are removed on cleanup.
- Server rendering completes without a `window` global and returns `"light"`.
- Documentation shows an application applying the returned value without
  prescribing a styling system.
- The hook and its dependencies remain confined to `@emseepea/react`.
- Existing MCP Apps lifecycle, renderer, accessibility, pack, and fresh-install
  checks pass.

## Pros and Cons of the Options

### Public `useMcpTheme` resolver hook

- Good, because it removes repeated browser subscription code behind one small
  optional React API.
- Bad, because it creates the theme API compatibility surface ADR-0011 had
  excluded.

### Adopter-owned resolver

- Good, because it preserves the current architecture and adds no public API.
- Bad, because each host-and-standalone adopter must maintain the same listener,
  cleanup, fallback, and server-rendering behaviour.

### Resolved theme on `useMcpApp`

- Good, because connected MCP Apps would receive the resolved value from one
  hook call.
- Bad, because browser preference becomes part of the MCP lifecycle connection
  and cannot be reused independently of it.

## Reassessment Criteria

Reassess if MCP Apps makes the host theme mandatory, React provides a native
host-aware colour-scheme primitive, the `"light"` value used during server
rendering causes a demonstrated problem when React starts in the browser, a
Svelte adopter demonstrates equivalent repeated code, or applications require
more than the two validated theme values.
