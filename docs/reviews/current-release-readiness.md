# Current Release Readiness

Date: 2026-09-16

Issue #93 adds a framework-owned Model Context Protocol (MCP) App resource
packaging helper. The helper, maintained React adoption, and canonical guide
are released. The previous Result Card review remains in
[its dated record](./result-card-release-readiness-2026-09-15.md).

## Exact Published Package Set

The release contains these 16 patch versions:

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

## Verification Evidence

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
- Source Quality run
  [35052807021](https://github.com/emseepea/emseepea/actions/runs/35052807021)
  passed on `d0747f00707193f94d909ebc882f6bae3f0d12e2`.
- Release pull request
  [#98](https://github.com/emseepea/emseepea/pull/98) merged the generated
  version changes as `a76ade0207537d764f1bfa792e7dd0d92aef674b`.
- Version Quality run
  [35053615953](https://github.com/emseepea/emseepea/actions/runs/35053615953)
  passed on attempt 3. Attempts 1 and 2 failed the same stochastic CPU budget;
  no source changed before the successful rerun.
- Release run
  [35055551215](https://github.com/emseepea/emseepea/actions/runs/35055551215)
  passed on attempt 2. Attempt 1 published the packages but encountered a
  transient registry 404 during downloaded-package verification. Attempt 2
  passed publication, provenance, integrity, and downloaded-package checks.
- Anonymous npm readback confirmed every version above is the `latest` tag,
  exposes an integrity digest, and has `gitHead` equal to the version commit.
- GitHub Pages deployment `6473743550` succeeded for the version commit at
  [the deployed examples guide](https://emseepea.github.io/emseepea/examples/).
  Live readback found “Package an MCP App resource”, “Inputs and safety
  boundaries”, “Metadata and evidence”, and `defineMcpAppResource`.

## Outcomes

- Packages: **PUBLISHED; REGISTRY_VERIFIED**.
- Canonical website guide: **PROD_VERIFIED**.
- Adopter production-client rendering: **NOT VERIFIED**. Package publication,
  the maintained browser fixture, and the deployed guide do not establish an
  independent adopter journey.
- Pipeline risk review: 5/25, within the repository's appetite.
- Release verification: **COMPLETE** for package publication and the canonical
  deployed guide. The separate adopter production-client outcome remains
  **NOT VERIFIED**.
