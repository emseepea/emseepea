# Current Release Readiness

Date: 2026-09-07

## Release Batch

- `@emseepea/create-multi-instance-postgres-server@0.0.1`

## Change for Users

This release replaces the maintained SQLite multi-instance initializer with a
PostgreSQL initializer. Generated projects use one shared PostgreSQL database,
an atomic upsert, a unique idempotency constraint, bounded database work, and a
single local run command after installation.

The historical SQLite package remains available. The release watcher
deprecates it only after the PostgreSQL replacement is published and verified.

## Evidence Before Publication

- Architecture and Jobs To Be Done reviews passed.
- Cognitive-accessibility and Markdown accessibility reviews passed.
- Root lint, build, type checks, and focused release-automation tests passed.
- Local Docker Desktop did not respond, so local PostgreSQL integration did not
  complete. The exact-commit Quality workflow must run the database tests on a
  fresh GitHub runner before publication.

## Required Publication Evidence

- Exact-commit Quality must pass the PostgreSQL concurrency, readiness,
  timeout, failure, packed initializer, Node.js 22 and 24, and OSV checks.
- The later release job must pass the provider-native semantic test before
  publication.
- npm publication must use the approved release path and expose provenance,
  signatures, registry metadata, a clean install, and a working initializer.
- The old SQLite package must show the exact replacement deprecation message
  for every published version.

## Review Status

- Result: PENDING
- Final result: pending exact Quality and release-risk evidence.
