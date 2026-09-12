# Current Release Readiness

Date: 2026-09-12

## Release Batch

- `@emseepea/feedback@0.2.7`
- `@emseepea/server@0.10.1`
- `@emseepea/react@0.0.20`
- `@emseepea/testing@0.9.11`

## Change for Users

Semantic tests now classify an expired Claude OAuth result as an authentication
failure without saving the provider's error text as semantic evidence.

The feedback testing server now announces readiness only after its `SIGINT` and
`SIGTERM` shutdown handlers are active.

`defineTool`, `defineStreamingTool`, and `defineMappedTool` keep TypeScript
inference bounded for large Zod output schemas while preserving handler output
checks.

The React package change is dependency-only. Testing 0.9.11 includes both the
authentication fix prepared in unpublished 0.9.10 and the server dependency
update.

## Verified Local Evidence

- The testing package's 13 tests pass, including both Claude event parsers,
  safe authentication diagnostics, and a successful result containing the same
  text as the authentication error.
- All 18 feedback package tests pass on Node.js 22 and 24. The testing fixture
  checks both shutdown handlers at the instant readiness is logged, and 40
  concurrent runs pass on each Node.js version.
- The large-schema type test passes with a 100-field Zod output schema under a
  512 MB heap and 30-second limit. Project type checking also passes.
- Independent architecture, Jobs To Be Done (JTBD), code, test-quality,
  cognitive-accessibility, voice, and risk reviews passed for the changes in
  this batch.
- Quality passed for the exact source commit and for the merged version commit.

These results do not prove the published npm packages. None of the four release
batch versions had registry proof when this record was prepared.

The full local suite could not finish because Docker was unresponsive during
PostgreSQL example setup. Container qualification remains required in
continuous integration (CI).

## Required Publication Evidence

- Quality must pass on the publishing commit: supported Node.js versions,
  dependency scanning, package and documentation tests, accessibility,
  performance, and all eleven standalone initializer/container checks.
- Release must pass the maintained semantic examples before publication.
- Registry verification must check package versions, integrity, provenance,
  signatures, clean installation, and the affected package behaviour.
- Registry initializer checks must exercise the actual downloaded packages and
  their container qualification.
- Website deployment may be claimed only after its publication job succeeds.

## Review Status

- Result: PASS
- Pipeline risk review: commit, push, and release scored 5/25, within the 5/25 appetite.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
