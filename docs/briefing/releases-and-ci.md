# Releases and Continuous Integration

## Initializer dependency versioning

Generated initializer templates embed public package versions, but those
dependencies are not represented in Changesets' public dependency graph. When
core package versions change, explicitly patch-bump every maintained initializer
and verify generated template manifests before release.

<!-- signal-score: -1 | last-classified: 2026-09-11 | first-written: 2026-09-11 -->

## Release-readiness marker contract

`scripts/verify-release-readiness.mjs` requires the exact stable marker
`- Result: PASS`. Keep release completion as the adjacent
`- Release verification: NOT COMPLETE ...` line. A wording-only accessibility
edit to the marker blocked publication before npm publish.

<!-- signal-score: -1 | last-classified: 2026-09-11 | first-written: 2026-09-11 -->

## Exact release evidence

Release completion is exact-commit and exact-workflow evidence. The OpenAPI
initializer release completed at `07430957d9e376b84761d85ec4f4b5aa336c391c`
with Quality run `34554628933` and Release run `34555128253`, attempt 3. The
evidence includes a registry quickstart, package signatures and attestations,
matching release and registry tarballs, and the unchanged no-spec example.

<!-- signal-score: 2 | last-classified: 2026-09-11 | first-written: 2026-09-11 -->

## Concurrent trunk activity

`push:watch` correctly fails closed when an exact-SHA workflow is cancelled by
newer trunk activity. Adopt or rebase the newer `main`, then rerun gates against
the new exact head rather than treating the cancelled run as release proof.

<!-- signal-score: 2 | last-classified: 2026-09-11 | first-written: 2026-09-11 -->
