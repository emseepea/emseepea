# Prepublication Review for the Result Action Lifecycle Hook

Date: 2026-09-16

This record covers these planned releases to npm's default `latest` channel:

- `@emseepea/react@0.3.0`
- `@emseepea/create-react-ui-server@0.0.35`

Publication is pending.

## What Changes

`@emseepea/react` adds `useMcpAction`, a companion to `useMcpApp`. It tracks one
result action through the `idle`, `sending`, `sent`, and `error` states. The hook
reports the active action ID and message text. It suppresses duplicate sends
while a request is pending, resets when a new tool result arrives, and ignores
stale request completion after that reset.

The application still chooses the message text, decides whether each action may
change external state, and maps the hook state to visible status text, focus,
and disabled actions. The React UI initializer now demonstrates that boundary
instead of repeating the lifecycle state machine.

## Evidence Available Before Publication

- ADR-0084 and ADR-0086 already govern the React lifecycle and application
  ownership boundary. The independent architecture review passed without
  requiring a new decision.
- JTBD-002 (Add Optional Capabilities) is confirmed. The independent Jobs To Be
  Done review passed without a new job or user decision.
- Independent accessibility, style-guide, voice-and-tone, cognitive-
  accessibility, Markdown-accessibility, and test-quality reviews passed.
- The browser test covers duplicate-send suppression, sending, rejection,
  success, reset on a new result, stale-completion isolation, disabled action
  state, status announcements, and status focus. The React example passed all
  five built tests, including its axe and browser accessibility contract.
- The React package passed all six built tests. Workspace lint, typecheck,
  decision checks, builds, and the changed-content evidence check passed.
- The packed-package and initializer suite passed all three checks, including
  fresh installation, public imports, and standalone initialized projects.
- The full functional test run passed 227 tests. Its only initial failure was
  the required hash-bound cognitive-accessibility evidence for the two changed
  Markdown files; that evidence was added and the focused three-test evidence
  suite then passed.
- The required local benchmarks passed on an unchanged retry after a transient
  local port-allocation failure.
- The final pipeline risk review rated cumulative residual risk at 5/25, within the
  repository's 5/25 appetite.

## Required After This Record Is Committed

- Exact-commit Quality and Release workflows for the source commit.
- A generated Changesets release pull request based on that exact source
  commit.
- Exact-head merge of the release pull request followed by exact-commit Quality
  and Release workflows for the version commit.

## Required After npm Publication

The release workflow must verify both planned versions on npm's default
`latest` channel, including provenance, integrity, the expected Git revision,
clean installation, public imports, and initialized project contents. Git tags
and GitHub releases must refer to the same version commit.

## Evidence Boundary

- Local builds, tests, and reviews do not prove exact-commit continuous
  integration.
- This record does not prove npm publication, registry verification, a Git tag,
  a GitHub release, or adopter production use.
- No website content changes in this release, so website production
  verification is not applicable.

## Review Status

- Result: PASS
- Reviewed source change: passed locally.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE; source CI, release pull request, npm
  publication, and registry verification remain pending.
