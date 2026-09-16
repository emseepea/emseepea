# Prepublication Review for WCAG Contrast Assertions

Date: 2026-09-17

This record covers these planned releases to npm's default `latest` channel:

- `@emseepea/testing@0.13.0`
- `@emseepea/create-tool-server@0.0.36`
- `@emseepea/create-api-backed-server@0.0.34`
- `@emseepea/create-openapi-backed-server@0.0.16`
- `@emseepea/create-resources-and-prompts-server@0.0.33`
- `@emseepea/create-progress-streaming-server@0.0.34`
- `@emseepea/create-html-ui-server@0.0.36`
- `@emseepea/create-react-ui-server@0.0.36`
- `@emseepea/create-multi-instance-postgres-server@0.0.24`
- `@emseepea/create-database-schema-server@0.0.21`
- `@emseepea/create-mongodb-backed-server@0.0.21`
- `@emseepea/create-soap-backed-server@0.0.21`

Publication is pending. The initializer releases only align their embedded
`@emseepea/testing` dependency.

## What Changes

`@emseepea/testing` adds `wcagContrastRatio` and `assertWcagContrast`.
Applications pass their own opaque `#RRGGBB` color pairs and required ratios.
The calculation uses unrounded Web Content Accessibility Guidelines (WCAG)
relative luminance and contrast values. A failed assertion identifies the
optional label, both colors, the measured ratio, and the required ratio.

Applications still choose their colors, tested pairs, and thresholds. Static
token checks do not inspect rendered CSS, transparency, gradients, component
states, focus geometry, or forced-colors mode. They do not establish WCAG
conformance.

## Evidence Available Before Publication

- Existing architecture decisions cover the package boundary and application
  ownership. The independent architecture review passed without requiring a new
  decision.
- The independent Jobs To Be Done (JTBD) review confirmed alignment with
  JTBD-002 (Add Optional Capabilities). It did not require a new job or reader
  decision.
- Independent contrast, testing, test-quality, voice-and-tone, cognitive-
  accessibility, and Markdown-accessibility reviews passed.
- The testing package passed all 29 tests. The new behavioral tests cover
  reference ratios, symmetry, exact-threshold acceptance, unrounded failure
  behavior, labeled diagnostics, unsupported colors, and invalid thresholds.
- Workspace decision checks, lint, builds, typechecks, all package and example
  tests, documentation checks, packed-package checks, and browser accessibility
  checks passed. The full functional run passed 228 tests.
- The Changesets plan contains the testing minor release and all 11 required
  initializer patch releases.
- The pipeline risk review rated cumulative residual risk at 5/25, within the
  repository's 5/25 appetite.

## Required After This Record Is Committed

- Exact-commit Quality and Release workflows for the source commit.
- A generated Changesets release pull request based on that exact source commit.
- Exact-head merge of the release pull request followed by exact-commit Quality
  and Release workflows for the version commit.

## Required After npm Publication

The release workflow must verify all 12 planned versions on npm's default
`latest` channel, including provenance, integrity, the expected Git revision,
clean installation, public imports, and initialized project contents. Git tags
and GitHub releases must refer to the same version commit.

## Evidence Boundary

- Local builds, tests, and reviews do not prove exact-commit continuous
  integration.
- This record does not prove npm publication, registry verification, a Git tag,
  a GitHub release, or adopter production use.
- No website content changes in this release, so website production verification
  is not applicable.

## Review Status

- Result: PASS
- Reviewed source change: passed locally.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE; source CI, release pull request, npm
  publication, and registry verification remain pending.
