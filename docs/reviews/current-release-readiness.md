# Prepublication Review for the Browser MCP App Development Host

Date: 2026-09-17

This record covers this planned release to npm's default `latest` channel:

- `@emseepea/testing@0.14.0`

Publication is pending.

## What Changes

`@emseepea/testing/browser` adds `createMcpAppDevelopmentHost`. A local
development page supplies a compiled widget entry point, root element ID, and
application fixtures. The host runs the widget in an iframe and reuses the
protocol engine behind `createMcpAppHostSimulator`.

URL parameters select a fixture and initial theme, constrain the iframe width,
simulate reduced motion, and choose successful or rejected `ui/message`
responses. The returned host can deliver another fixture, change host context,
resize the iframe, inspect captured messages, and remove the preview.

Application fixtures, styles, screenshot policy, and assertions remain outside
the package.

## Evidence Available Before Publication

- Architecture and Jobs To Be Done reviews passed. The implementation reuses
  the existing protocol behavior, serves confirmed JTBD-002, and requires no
  new Architecture Decision Record or job.
- Cognitive-accessibility review passed for the package guide and corrected
  release note. Voice-and-tone review passed for the release note.
- A real Chromium check loaded a compiled fixture widget, selected a fixture,
  delivered results, changed theme and width, simulated reduced motion,
  captured an action, and exercised rejected and successful message responses.
- The complete testing-package suite passed all 30 tests, including the new
  browser check and the existing host-simulator checks.
- The testing package build, changed-file Oxlint check, and package dry-run
  passed. The dry-run includes the browser JavaScript and type declarations.
- Pipeline risk is 5/25 for the staged commit, within the repository's risk
  appetite. Push and release remain unscored until an origin-backed commit
  exists.

These are local source checks. Exact-commit Quality must still pass before
publication.

## Required After This Record Is Committed

- Exact-commit Quality must pass for the source commit.
- The Changesets release pull request must contain the planned testing-package
  version and changelog change based on that exact source commit.
- The release pull request must merge through the governed release watcher.
- Exact-commit Quality and Release must pass for the version commit.

## Required After npm Publication

Registry readback must verify `@emseepea/testing@0.14.0` on the default
`latest` channel, including provenance, integrity, the expected Git revision,
clean installation, the browser subpath export, the Git tag, and the GitHub
release.

## Evidence Boundary

The development host proves only the browser lifecycle that is run. Local
checks, continuous integration, npm publication, and registry verification do
not establish compatibility with ChatGPT, Claude, or another public host. Each
supported host still requires its real public journey.

This record does not make a `PUBLISHED`, registry-verified, or adopter
`PROD_VERIFIED` claim.

## Review Status

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Scope: Reviewed source change and targeted local checks.
- Release verification: NOT COMPLETE.
