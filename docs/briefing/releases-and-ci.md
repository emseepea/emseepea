# Releases and Continuous Integration

## Initializer dependency versioning

Generated initializer templates embed public package versions, but those
dependencies are not represented in Changesets' public dependency graph. When
core package versions change, explicitly patch-bump every maintained initializer
and verify generated template manifests before release.

<!-- briefing-score: 1; first-written: 2026-09-11; last-classified: 2026-09-11; classification: signal -->

## Release-readiness marker contract

`scripts/verify-release-readiness.mjs` requires the exact stable marker
`- Result: PASS`. Keep release completion as the adjacent
`- Release verification: NOT COMPLETE ...` line. A wording-only accessibility
edit to the marker blocked publication before npm publish.

<!-- briefing-score: 1; first-written: 2026-09-11; last-classified: 2026-09-11; classification: signal -->

## Exact release evidence

Release completion is exact-commit and exact-workflow evidence. The initializer
release completed at `9bf599a8dd144fe9ea924c52d6bc95f5e601ce88` with Quality
run `34552236550` and Release run `34552756999`, including registry quickstart,
package signatures, attestations, and release assets.

<!-- briefing-score: 1; first-written: 2026-09-11; last-classified: 2026-09-11; classification: signal -->

## Concurrent trunk activity

`push:watch` correctly fails closed when an exact-SHA workflow is cancelled by
newer trunk activity. Adopt or rebase the newer `main`, then rerun gates against
the new exact head rather than treating the cancelled run as release proof.

<!-- briefing-score: 1; first-written: 2026-09-11; last-classified: 2026-09-11; classification: signal -->
