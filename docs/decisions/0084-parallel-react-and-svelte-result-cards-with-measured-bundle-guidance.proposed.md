---
status: "proposed"
date: 2026-09-12
human-oversight: confirmed
oversight-date: 2026-09-12
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "Accessibility review"]
informed: []
reassessment-date: 2026-12-12
supersedes: [0083-canonical-accessible-tool-result-views-and-mcp-apps-lifecycle]
---

# Parallel React and Svelte Result Cards with Measured Bundle Guidance

## Context and Problem Statement

The canonical result model and React result card remove repeated result
semantics and MCP Apps lifecycle code, but a self-contained React resource
currently carries a 534,121-byte production script before compression. React
remains appropriate for adopters that already ship React. New self-contained
MCP Apps should also have a smaller, maintained framework option whose
accessibility and lifecycle behaviour is equivalent rather than hand-written.

This decision accepts the React resource cost, adds equivalent Svelte support,
and defines when measured bundle evidence may support a narrow recommendation.

## Decision Drivers

- Preserve the canonical strict `ResultView` model and native renderer.
- Let existing React adopters use an ordinary React component.
- Offer a maintained compiled alternative for self-contained MCP resources.
- Keep both framework renderers semantically and behaviourally equivalent.
- Ground framework guidance in repeatable production bundle measurements.
- Keep React, Svelte, and browser code optional for servers without a UI.

## Considered Options

1. **React only with accepted bundle cost** - Keep one framework renderer and
   document the self-contained resource cost.
2. **Svelte only** - Minimise the maintained self-contained resource but require
   React adopters to change their UI stack.
3. **Parallel React and Svelte result cards with measured guidance** - Keep
   React for existing React applications and add equivalent Svelte support for
   self-contained resources.
4. **Hand-written browser renderer** - Use native DOM operations for the
   smallest likely artifact without maintaining a second framework package.


## Decision Outcome

Chosen option: **"Parallel React and Svelte result cards with measured
guidance"**, because it preserves a normal React integration for existing
adopters while testing whether a compiled Svelte implementation materially
reduces the cost of a self-contained MCP App resource.

`@emseepea/server/ui` continues to own the strict `ResultView` model, parser,
native HTML renderer, and the dependency-free MCP Apps controller shared by
framework bindings. `@emseepea/react` exports an unstyled `ResultCard` and
`useMcpApp`. A new optional `@emseepea/svelte` package exports an equivalent
unstyled `ResultCard` and the thinnest Svelte lifecycle binding around the same
controller. Neither framework enters the server package's required dependency
closure.

The unpublished React component is named `ResultCard`; no compatibility alias
is carried. `ResultView` remains the framework-neutral data-model name and
`renderResultView` remains the native renderer name.

No Svelte initializer or Tailwind change is included. A private comparison
fixture bundles functionally and accessibility-equivalent React and Svelte
cards with the same production settings, bundler version, browser target,
source-map setting, result fixture, and lifecycle. It records raw, gzip level 9,
and Brotli quality 11 byte counts, exact package/compiler versions, and the
reproduction command.

Documentation may recommend Svelte only for self-contained MCP App resources
where either framework is acceptable, and only when Svelte is at least 20%
smaller than React under both gzip and Brotli in that fixture. It recommends
React when the adopter already ships React. It makes no general framework speed
or size claim.

The measured React artifact risk is accepted without an established UI-resource
budget: 534,121 raw bytes, 129,181 gzip-9 bytes, and 108,927 Brotli-11 bytes per
uncached resource load in the current fixture. Hosts may cache the reusable UI
resource, but no cache-rate evidence is available, so publication must state
the per-load measurement rather than an aggregate traffic claim.

## Consequences

### Good

- Existing React adopters receive the expected native React component.
- Self-contained MCP Apps gain a maintained smaller option if measurements
  confirm the hypothesis.
- Both frameworks share one model and lifecycle protocol implementation.
- Bundle guidance is reproducible and narrowly scoped.

### Neutral

- Svelte is an additional optional public package and build-time tool.
- Adopters still own domain parsing, mapping, wording, actions, and styles.
- Host caching can reduce transfer frequency but is outside package control.

### Bad

- The project maintains and releases two framework integrations.
- The accepted React artifact is comparatively large for uncached loads.
- Semantic and lifecycle parity must be checked across native, React, and
  Svelte implementations.

## Confirmation

- React and Svelte export `ResultCard` against the same parsed `ResultView`.
- Both renderers preserve the native semantic, ARIA, keyboard, focus, hostile
  input, live-region, forced-colors, reduced-motion, reflow, and target-size
  contracts.
- Both lifecycle bindings use one dependency-free checked MCP Apps controller
  and clean up listeners, timeouts, and pending requests.
- A checked script builds equivalent production fixtures and reports raw,
  gzip-9, and Brotli-11 sizes with exact versions and commands.
- Documentation applies the 20% dual-compression threshold and scopes any
  recommendation to self-contained MCP App resources.
- React and Svelte remain absent from the server package's required dependency
  closure.
- Both public packages pass pack, fresh-install, provenance, and registry
  verification.
- The cited React adopter replaces its generic result presentation and host
  lifecycle code while retaining its domain mapping, actions, and styles.

## Pros and Cons of the Options

### React only with accepted bundle cost

- Good: Smallest public framework surface and direct fit for the cited adopter.
- Bad: Gives new self-contained resources no maintained lower-transfer option.

### Svelte only

- Good: Likely smaller compiled artifact for the measured component.
- Bad: Makes existing React adopters migrate or carry an unexpected UI stack.

### Parallel React and Svelte result cards with measured guidance

- Good: Fits existing React applications and supports a measured smaller option.
- Bad: Adds one public package and a permanent parity obligation.

### Hand-written browser renderer

- Good: Likely the fewest browser bytes and no additional framework.
- Bad: Reintroduces bespoke DOM lifecycle code and a separate maintenance model.

## Reassessment Criteria

Reassess when measured Svelte output misses the dual 20% threshold, either
framework cannot preserve semantic and lifecycle parity, a second adopter
demonstrates demand for another framework, or real resource traffic establishes
an enforceable UI bundle budget.
