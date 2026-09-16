# Release Evidence for Published MCP Contract Compatibility

Date: 2026-09-16

The package changes for issue #91 are published. `@emseepea/testing` now
provides deterministic published Model Context Protocol (MCP) contract
baselines and direction-aware breaking-change checks. The initializer releases
only align their embedded testing dependency; they add no separate feature.

## Exact Published Package Set

- `@emseepea/testing@0.12.0`
- `@emseepea/create-tool-server@0.0.35`
- `@emseepea/create-api-backed-server@0.0.33`
- `@emseepea/create-openapi-backed-server@0.0.15`
- `@emseepea/create-resources-and-prompts-server@0.0.32`
- `@emseepea/create-progress-streaming-server@0.0.33`
- `@emseepea/create-html-ui-server@0.0.35`
- `@emseepea/create-react-ui-server@0.0.34`
- `@emseepea/create-multi-instance-postgres-server@0.0.23`
- `@emseepea/create-database-schema-server@0.0.20`
- `@emseepea/create-mongodb-backed-server@0.0.20`
- `@emseepea/create-soap-backed-server@0.0.20`

## Source Evidence

- Implementation commit `6d47e72ce797e12b2348268a63f00d8753d2980d`
  added the contract extraction, baseline, comparison, documentation, and
  focused built-package tests.
- Release-plan commit `e29c48e690eed353af6388bc6304e92b25e0b039`
  added the 11 dependency-only initializer patches required by the generated
  manifest changes.
- Exact source Quality passed in
  [source Quality run 35083831726](https://github.com/emseepea/emseepea/actions/runs/35083831726).
- Exact source Release preparation passed in
  [source Release preparation run 35084664415](https://github.com/emseepea/emseepea/actions/runs/35084664415).

## Version and Publication Evidence

- [Changesets pull request #99](https://github.com/emseepea/emseepea/pull/99)
  had exact base `e29c48e690eed353af6388bc6304e92b25e0b039`, exact generated head
  `782ba0b67cb272b8485fd76eca38d39ff455af84`, and merged as version commit
  `1c886acc576c57b7d05ff02ce8692220109634ad`.
- Exact version-commit Quality passed in
  [version-commit Quality run 35084883274](https://github.com/emseepea/emseepea/actions/runs/35084883274).
- Release attempt 1 stopped before publication when the feedback semantic
  evaluation reported an unexpected tool-call order. Attempt 2 stopped before
  publication when the progress-streaming and resources-and-prompts semantic
  evaluations reported response-meaning failures. The release inputs did not
  change between attempts. [Release attempt 3](https://github.com/emseepea/emseepea/actions/runs/35085792500/attempts/3)
  passed.
- The successful Release attempt verified provenance, integrity, clean
  installation, public imports, and the published initializer contents.
- Anonymous npm readback confirmed every listed version as `latest`, with
  `gitHead` equal to `1c886acc576c57b7d05ff02ce8692220109634ad`.
- Anonymous npm readback for `@emseepea/testing@0.12.0` reported integrity
  `sha512-qk2KjC6cAQhwtq6JMllznh7+MXOFCMamYxoe0XeK6n0x/Fq0Drj/w7lryUz5Ok5S/WRqT/FRBDovIdFnT4TaLQ==`.
- Git tag `@emseepea/testing@0.12.0` resolves to the exact version commit. The
  [GitHub release for `@emseepea/testing@0.12.0`](https://github.com/emseepea/emseepea/releases/tag/%40emseepea/testing%400.12.0)
  refers to the same release.

## Evidence Boundaries

- Package publication and anonymous registry verification are complete:
  **PUBLISHED** and **REGISTRY_VERIFIED**.
- This release changed no website content, so website production verification
  is not applicable.
- Production use by an adopter was not tested: **NOT VERIFIED**.

## Review Status

- Result: PASS
- Reviewed source and generated release changes: passed.
- Release verification: COMPLETE for the exact package set above.
