# Current Release Readiness

Date: 2026-09-08

## Release Batch

- `@emseepea/testing@0.5.1`

## Change for Users

Version 0.5.1 improves the inspectable semantic evidence introduced in 0.5.0.
Failed judge invocations now report a fixed, credential-safe cause such as a
timeout, process exit, missing result, or provider error category.

## Evidence Before Publication

- Package tests passed 12 of 12, including failed-process and credential-shaped
  provider-data regressions.
- Architecture and Jobs To Be Done reviews passed.
- Cognitive-accessibility and Markdown accessibility reviews passed.
- The publishing commit passed exact-commit Quality and provider-native semantic
  qualification before package evidence preparation found this stale record.
- Release risk is 5 of 25 and within appetite.

## Required Publication Evidence

- Exact-commit Quality must pass Node.js 22 and 24, OSV, website, package, and
  standalone initializer checks.
- The later release job must pass every provider-native semantic example before
  publication.
- npm publication must use Trusted Publishing and expose provenance, registry
  metadata, a clean install, and package evidence.

## Review Status

- Result: PASS
- Final result: within appetite.
