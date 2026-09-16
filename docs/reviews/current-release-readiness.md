# Current Release Readiness

Date: 2026-09-16

Issue #93 adds a framework-owned Model Context Protocol (MCP) App resource
packaging helper. This is a planned release, not a published capability. The
previous Result Card review remains in
[its dated record](./result-card-release-readiness-2026-09-15.md).

## Exact Planned Package Set

The Changesets plan currently contains these 16 patch releases:

- `@emseepea/server@0.12.1`
- `@emseepea/create-tool-server@0.0.34`
- `@emseepea/create-api-backed-server@0.0.32`
- `@emseepea/create-openapi-backed-server@0.0.14`
- `@emseepea/create-resources-and-prompts-server@0.0.31`
- `@emseepea/create-progress-streaming-server@0.0.32`
- `@emseepea/create-html-ui-server@0.0.34`
- `@emseepea/create-react-ui-server@0.0.33`
- `@emseepea/create-multi-instance-postgres-server@0.0.22`
- `@emseepea/create-database-schema-server@0.0.19`
- `@emseepea/create-mongodb-backed-server@0.0.19`
- `@emseepea/create-soap-backed-server@0.0.19`
- `@emseepea/feedback@0.2.14`
- `@emseepea/react@0.2.4`
- `@emseepea/svelte@0.1.4`
- `@emseepea/testing@0.11.4`

The server adds `defineMcpAppResource`. Only the React UI starter changes its
template to use the helper. The other ten starters update their embedded server
dependency; feedback, React, Svelte, and testing receive dependency-only patch
bumps. Those packages do not add a separate MCP App feature.

## Local Evidence and Pending Checks

- Ratified ADR-0093 governs the packaging boundary.
- The server and React starter builds passed after the helper migration.
- Public typecheck passed; focused helper tests passed for modern and legacy
  clients, invalid definitions, metadata alignment, and a startup-read bundle.
- The maintained React browser suite passed five of five tests, including its
  accessibility and MCP App resource checks.
- The packed package and initializer suite passed all three checks on this
  checkout, including fresh-install and standalone-starter checks.
- The website built with the current guide. Its built-page accessibility, link,
  and search suite passed all 13 tests.
- Two local Quality test commands passed on this checkout:
  `EMSEEPEA_SKIP_PACKED_INITIALIZERS=true npm test` passed 226 tests with zero
  failures and two intentional packed-initializer skips, and
  `npm run test:initializers:packed` passed all three packed checks.

The workflow's container matrix and exact-commit Quality run remain unverified.
Local checks still do not prove continuous integration or publication.

## Required Publication Evidence

- Quality must pass on the exact source commit.
- The Changesets release pull request must contain only the generated version,
  dependency, lockfile, changelog, and changeset-removal changes for this plan.
- Quality and Release must pass on the exact version commit.
- Anonymous registry readback must confirm every planned version, `latest`
  tag, integrity, provenance, and binding to the release commit.
- Packed/downloaded starter checks must confirm the new server version and the
  React MCP App helper path.
- Exact deployed-website revision and URL checks must show the canonical guide.
- Any adopter production-client rendering claim needs separate journey evidence.

## Review Status, Not Release Status

- Result: PASS
- Pipeline risk review: 5/25, within the repository's appetite.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE. No exact continuous integration,
  publication, registry, deployed website, or adopter production verification
  has been established for issue #93.
