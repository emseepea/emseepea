# Releases and Continuous Integration

## Exact release evidence

Release completion is exact-commit and exact-workflow evidence. The OpenAPI
initializer release completed at `07430957d9e376b84761d85ec4f4b5aa336c391c`
with Quality run `34554628933` and Release run `34555128253`, attempt 3. The
evidence includes a registry quickstart, package signatures and attestations,
matching release and registry tarballs, and the unchanged no-spec example.

<!-- signal-score: 0 | last-classified: 2026-09-23 | first-written: 2026-09-11 -->

## Concurrent trunk activity

`push:watch` correctly fails closed when the workflow for the exact commit is cancelled by
newer trunk activity. Adopt or rebase the newer `main`, then rerun gates against
the new exact head rather than treating the cancelled run as release proof.

<!-- signal-score: 0 | last-classified: 2026-09-23 | first-written: 2026-09-11 -->

## First-package trusted-publisher preflight

Before `release:next`, query each canonical npm package name without credentials.
Treat only HTTP 404 as a missing package and stop with separately authorized
first-package setup guidance. Other registry failures remain errors. Package existence
does not prove trusted-publisher configuration, and the promotion token must not
create a package or version.

<!-- signal-score: 1 | last-classified: 2026-09-23 | first-written: 2026-09-23 -->
