# Current Release Readiness

Date: 2026-09-13

Release verification is not complete. This cumulative release includes the
pending MCP Apps host simulator for `@emseepea/testing`, plus the issue 85
React theme helper and React UI initializer update.

## Planned Release Batch

- `@emseepea/react@0.2.0`
- `@emseepea/create-react-ui-server@0.0.28`
- `@emseepea/testing@0.10.0`

## Change for Users

MCP Apps authors get the pending deterministic, framework-neutral host simulator
in `@emseepea/testing`. React MCP Apps can also call
`useMcpTheme(app.hostContext.theme)` to get the host theme when present, or a
reactive browser colour-scheme fallback when running outside a host. The hook
only returns `"light"` or `"dark"`; it does not mutate the document or own
application styling. The React UI initializer now uses the hook and applies the
returned value to its own document dataset in an effect.

## Evidence So Far

- ADR-0086 was ratified. Architecture, JTBD, accessibility,
  cognitive-accessibility, and Markdown accessibility reviews passed for the
  source increment and public guidance.
- The pending `@emseepea/testing@0.10.0` readiness evidence remains from the
  existing `calm-apps-simulate` changeset and is carried in this cumulative
  release plan.
- `npm test -w @emseepea/react` passed for `@emseepea/react@0.2.0`: 6 tests,
  including host precedence, server fallback, system preference change,
  listener cleanup, and legacy media-query listener cleanup.
- `npm test -w @emseepea/create-react-ui-server` passed: 5 tests, including
  existing browser accessibility checks and the MCP Apps card theme fallback,
  preference-change, and host-override path.
- `node --test --test-name-pattern="the packed React renderer installs"
  tests/docs/packed-getting-started.test.mjs` passed.
- `npm run decisions:check`, `npm run lint`, and `npm run typecheck` passed.
- `GITHUB_BASE_REF=main node --test
  tests/docs/published-content-review.test.mjs` passed.
- Pipeline risk is 5 out of 25 for commit, push, and release.

These are source and local checks. They do not prove exact-commit CI,
publication, registry state, provenance, downloaded-package behavior, or an
exact journey in ChatGPT, Claude, or another adopter host.

## Required Publication Evidence

- The Quality workflow must pass on the exact source commit.
- The Changesets release pull request must contain only the planned generated
  version, dependency, and changelog changes for `@emseepea/react@0.2.0` and
  `@emseepea/create-react-ui-server@0.0.28`, plus the pending
  `@emseepea/testing@0.10.0` release.
- The Quality and Release workflows must pass on the exact version commit.
- Registry readback must confirm both versions and the `latest` tag, integrity,
  signature, provenance, and exact release-commit binding.
- The published React package must expose `useMcpTheme` from its public root
  entry point and pass a downloaded clean-install render journey.
- The published React UI initializer must install with the updated React helper
  dependency and pass its generated-project checks.

## Review Status, Not Release Status

This document records readiness only. It makes no `PUBLISHED`, registry-
verified, or adopter `PROD_VERIFIED` claim.

- Result: PASS
- Pipeline risk review: commit, push, and release are within the approved risk
  limit of 5 out of 25.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
