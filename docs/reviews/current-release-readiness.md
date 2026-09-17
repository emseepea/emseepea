# Prepublication Review for Checked MCP App MIME Compatibility

Date: 2026-09-17

This record covers these planned releases to npm's default `latest` channel:

- `@emseepea/server@0.13.0`
- `@emseepea/feedback@0.2.15`
- `@emseepea/react@0.3.1`
- `@emseepea/svelte@0.1.5`
- `@emseepea/testing@0.13.1`
- `@emseepea/create-tool-server@0.0.37`
- `@emseepea/create-api-backed-server@0.0.35`
- `@emseepea/create-openapi-backed-server@0.0.17`
- `@emseepea/create-resources-and-prompts-server@0.0.34`
- `@emseepea/create-progress-streaming-server@0.0.35`
- `@emseepea/create-html-ui-server@0.0.37`
- `@emseepea/create-react-ui-server@0.0.37`
- `@emseepea/create-multi-instance-postgres-server@0.0.25`
- `@emseepea/create-database-schema-server@0.0.22`
- `@emseepea/create-mongodb-backed-server@0.0.22`
- `@emseepea/create-soap-backed-server@0.0.22`

Publication is pending. Four package patches and 11 initializer patches align
their dependency on the new server version.

## What Changes

`defineMcpAppResource` accepts one optional definition-time `mimeType`. The
existing `text/html;profile=mcp-app` value remains the default. Callers with an
established compatibility contract may select `text/html+skybridge`. The
selected value is used for both resource listing and returned content so those
protocol operations cannot drift.

The type contract and runtime boundary reject every other MIME value. The
helper still owns the resource handler, including its returned HTML content.

## Evidence Available Before Publication

- Ratified ADR-0094 supersedes ADR-0093 for this MIME decision. Its selected
  option is checked two-value MIME selection.
- Independent architecture and Jobs To Be Done (JTBD) reviews passed against
  the ratified decision and JTBD-005 and JTBD-006.
- Independent cognitive-accessibility, Markdown-accessibility,
  voice-and-tone, test-quality, and pipeline-risk reviews passed.
- Type tests cover both supported values and reject unsupported values.
  Black-box tests cover runtime rejection and verify listing/read equality for
  both values across the modern and legacy protocol versions.
- Workspace decision checks, lint, builds, typechecks, package and example
  tests, documentation checks, packed-package checks, and browser accessibility
  checks passed. The full functional run passed 228 tests.
- An isolated temporary `home-loan-mcp` migration preserved
  `text/html+skybridge` through modern and legacy listing/read operations. Its
  typecheck, all 109 tests, and three published-contract schema baselines
  passed. The production adopter was not changed.
- The Changesets plan contains the server minor release, four dependent package
  patches, and all 11 initializer patches required to embed the new server
  version.
- The pipeline risk review rated cumulative residual risk at 5/25, within the
  repository's 5/25 appetite.

## Required After This Record Is Committed

- Exact-commit Quality and Release workflows for the source commit.
- A generated Changesets release pull request based on that exact source commit.
- Exact-head merge of the release pull request followed by exact-commit Quality
  and Release workflows for the version commit.
- The checked website guide must be deployed from the exact source or version
  commit and verified on the production website.

## Required After npm Publication

The release workflow must verify all 16 planned versions on npm's default
`latest` channel, including provenance, integrity, the expected Git revision,
clean installation, public imports, tags, and GitHub releases.

## Evidence Boundary

- Local builds, tests, and reviews do not prove exact-commit continuous
  integration.
- The isolated adopter proof establishes compatibility with its current public
  MIME contract. It does not prove a production migration or production use.
- A production adopter migration remains blocked because the helper-owned
  handler cannot yet preserve the adopter's `widget_view` telemetry.
- This record does not prove npm publication, registry verification, a Git tag,
  a GitHub release, production website deployment, host rendering, or adopter
  production use.

## Review Status

- Result: PASS
- Reviewed source change: passed locally.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE; source continuous integration, release
  pull request, npm publication, registry verification, and website production
  verification remain pending.
