# Current Release Readiness

Date: 2026-09-12

Release verification is not complete. This increment adds a checked
`ResultView` model and lifecycle controller to the server package, with optional
React and Svelte renderers and bindings. Adopters retain domain mapping,
actions, and styles. It adds no Svelte initializer or Tailwind dependency.

## Planned Release Batch

- `@emseepea/server@0.11.0`
- `@emseepea/react@0.1.0`
- `@emseepea/svelte@0.1.0`
- `@emseepea/create-react-ui-server@0.0.27`
- `@emseepea/feedback@0.2.10`
- `@emseepea/testing@0.9.14`

The feedback and testing packages are dependency-alignment patch releases and
add no separate feature.

## Change for Users

Servers can validate a bounded result-view model and render dependency-free
HTML. React users receive a normal `ResultCard` and MCP Apps hook. Svelte users
receive the equivalent `ResultCard` and lifecycle store. The React UI server
example uses the public model and React APIs.

For an equivalent self-contained MCP App fixture, React measured 534,121 bytes
raw, 129,181 bytes at gzip level 9, and 108,927 bytes at Brotli quality 11.
Svelte measured 406,619, 93,075, and 79,414 bytes respectively: reductions of
23.9%, 27.9%, and 27.1%. The reproducible comparison uses esbuild 0.28.2,
React and React DOM 19.2.8, Svelte 5.57.0, minified ES2022 modules, and no source
maps. This supports guidance for this bounded fixture, not a general framework
size claim.

## Evidence So Far

- ADR-0084, JTBD-002, and the MCP server developer persona have human
  confirmation.
- Independent architecture, code, JTBD, cognitive-accessibility, and automated
  accessibility reviews passed for the exact source increment.
- `npm run decisions:check`, `npm run lint`, `npm run build`, and
  `npm run typecheck` passed locally.
- Focused React, Svelte browser/compile/server, React example, black-box and
  documentation, bundle-guide, and packed fresh-install checks passed locally.
- Manual macOS VoiceOver and Chrome checks passed for heading order, disclosure
  state, accessible action names, keyboard focus, and live announcements across
  the native, React, and Svelte renderers.
- The public registry contains the deprecated Svelte bootstrap placeholder
  version 0.0.0-bootstrap.0. It enabled package-scoped trusted-publisher setup,
  but its bytes do not prove the normal Svelte release or an OpenID Connect
  publication.
- Pipeline risk is 5 out of 25 for commit, push, and release.

These are source and local checks. They do not prove exact-commit CI,
publication, registry state, provenance, or downloaded-package behavior.

## Required Publication Evidence

- The Quality workflow must pass on the exact source commit.
- The release workflow must publish the six planned versions from the exact
  version commit.
- Registry readback must confirm every version and `latest` tag, integrity,
  signature, provenance, and source-commit binding.
- The Svelte package must complete its first normal trusted OpenID Connect
  publication through the release workflow.
- Packed and downloaded clean-install checks must pass for every released
  package.
- The downloaded React initializer must install exact dependencies and pass its
  browser accessibility and MCP Apps lifecycle journey.
- Downloaded React and Svelte packages must pass public import, compile, and
  runtime journeys.
- A cited adopter journey remains separate production evidence.

## Review Status, Not Release Status

This document records readiness only. It makes no `PUBLISHED` or
`PROD_VERIFIED` claim.

- Result: PASS
- Pipeline risk review: commit, push, and release are within the approved risk
  limit of 5 out of 25.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
