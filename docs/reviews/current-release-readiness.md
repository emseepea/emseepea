# Current Release Readiness

Date: 2026-10-04

This plan covers the optional external-approval broker and matching library
and starter dependency versions. It is not a publication, native ChatGPT,
application integration or production-verification claim.

## Planned Package Set

The server minor release advances its dependent libraries. All eleven starter
projects are included so their generated projects use matching dependencies.

- `@emseepea/server@0.20.0`
- `@emseepea/feedback@0.5.2`
- `@emseepea/react@0.4.2`
- `@emseepea/svelte@0.2.2`
- `@emseepea/testing@0.20.1`
- `@emseepea/create-tool-server@0.1.3`
- `@emseepea/create-api-backed-server@0.1.3`
- `@emseepea/create-openapi-backed-server@0.1.3`
- `@emseepea/create-resources-and-prompts-server@0.1.3`
- `@emseepea/create-progress-streaming-server@0.1.3`
- `@emseepea/create-html-ui-server@0.1.3`
- `@emseepea/create-react-ui-server@0.1.3`
- `@emseepea/create-multi-instance-postgres-server@0.1.3`
- `@emseepea/create-database-schema-server@0.1.3`
- `@emseepea/create-mongodb-backed-server@0.1.3`
- `@emseepea/create-soap-backed-server@0.1.3`

No website or Tailwind package release is planned. No third-party dependency
version changes are included. Published package versions remain immutable.

## Behaviour and Local Evidence

The broker is available only through the separate
`@emseepea/server/external-approval` import. It encrypts the proposed action,
binds approval to its principal and exact details, and uses an atomic storage
adapter to consume approval once. Stored records contain hashes, expiry and
decision state, not the proposal's business fields.

It does not create a page, execute a tool, grant permission or fabricate a
native form response. Applications must authenticate the person, prevent
cross-site form submission, recheck permissions and current provider state,
and retain duplicate prevention. An approved decision is not provider-success
evidence. Cancellation and expiry cannot authorize execution.

The implementation is committed at
`74cf3ea08856a831dd2345d0e0fdd92e2e8233a2`. Local evidence includes:

- Fifteen public-API behavioural tests pass, covering binding, tampering,
  wrong identity, cancellation, expiry, concurrency, restart, replay,
  configuration bounds and safe storage-error handling.
- The complete local suite passed with 334 root tests, plus the build,
  typecheck and example checks.
- Normal clean-install qualification passed for exactly this commit.
- A fresh installation of the locally packed server exercised approval and
  replay through the public import. This is not a registry-published package.
- Architecture, JTBD and behavioural-test reviews passed. Both release notes
  passed voice/tone and confidentiality review.

The source Quality run is
[37133068543](https://github.com/emseepea/emseepea/actions/runs/37133068543).
Its final result must be checked before the next integration. No successful
release-head build, registry publication or application journey is claimed.

## Required Publication Evidence

- Verify the complete Changesets package plan against this record.
- Qualify the exact release-metadata commit and pass its watched Quality run.
- Verify that the release pull request contains only generated package changes.
- Pass exact release-head semantic, packed-package and dependency gates.
- Verify published package versions, contents and provenance before promotion.
- Exercise the registry-published broker before reporting package verification.

## Conditional Readiness, Not Publication

The labels below describe this bounded source plan. They do not assert that
the required release-head checks or publication have completed.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE.
