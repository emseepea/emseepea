# Current Release Readiness

Date: 2026-10-11

## Outcome-constrained semantic qualification

Issue #158 adds a closed-world semantic tool-selection assertion for native MCP
conversations whose valid retrieval or recovery order can vary. Required and
allowed tools have finite cardinalities, omitted tools are forbidden, and the
declared maximums are checked only after a turn completes. They do not stop
dispatch or truncate evidence. Existing exact assertions remain unchanged.

Completed turns also expose detached, recursively immutable `toolOutcomes`.
Each outcome contains only `name`, `arguments`, the exact model-visible
`result`, and `isError`. These fields are observations, not proof of recovery,
persisted effects, or response meaning. Adopters must assert those outcomes
separately.

ADR-0118 and ADR-0119 define the boundaries and remain proposed and unconfirmed
until the released package succeeds in independent adopter use.

## Planned package set

- `@emseepea/testing@0.23.0`

No other package has a planned version change.

## Verified before push

The exact testing-package implementation passed 70 tests, including varied
valid sequences, forbidden and duplicate calls, invalid contracts, argument
and result checks, persisted-effect separation, evidence tampering, exact
assertion compatibility, type checks, and recursively immutable outcomes.

The repository suite reached 405 of 406 passing checks. Its only failure was
the documentation-density guard for two identical 453-character paragraphs.
Those paragraphs were split without changing their words; the exact density
and publication-review checks then passed 5 of 5, and the testing package
passed 70 of 70 again. Architecture and cognitive-accessibility reviews passed
for the final feature content.

## Required release evidence

The exact source commit must pass full Quality before a release candidate is
created. Release must pass semantic qualification, next-tag publication,
registry integrity, signatures, provenance, and downloaded-package checks.
Publish must promote the exact candidate to latest and merge back to main.

Independent installed-package execution must prove the synthetic #158 journey.
Coglen must then verify its real native-client outcome assertions before
ADR-0118 or ADR-0119 can be confirmed or issue #158 can be closed as accepted.

Incomplete or timed-out turns remain failed qualification. Preserving partial
provider events from those failed turns is a separate diagnostic capability and
is not claimed by this release.

## Conditional release readiness

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Publication status: NOT READY until full exact-commit Quality, Release,
  Publish, registry, installed-package, and Coglen acceptance checks pass.
