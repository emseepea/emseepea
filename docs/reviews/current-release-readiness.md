# Current Release Readiness

Date: 2026-09-08

## Release Batch

- `@emseepea/create-tool-server@0.0.12`
- `@emseepea/create-api-backed-server@0.0.12`
- `@emseepea/create-sign-in-tool-server@0.0.11`
- `@emseepea/create-resources-and-prompts-server@0.0.11`
- `@emseepea/create-progress-streaming-server@0.0.11`
- `@emseepea/create-html-ui-server@0.0.13`
- `@emseepea/create-react-ui-server@0.0.12`
- `@emseepea/create-multi-instance-postgres-server@0.0.1`

## Change for Users

These initializer releases make newly generated projects use
`@emseepea/testing@0.5.1`, including its inspectable semantic failure evidence.
They also publish the PostgreSQL multi-instance initializer for the first time.
Registry verification now allows three minutes for npm propagation.

## Evidence Before Publication

- The testing package and release workflow tests passed locally.
- Architecture and Jobs To Be Done reviews passed.
- Cognitive-accessibility and Markdown accessibility reviews passed.
- The preceding publishing commit passed exact-commit Quality and all eight
  provider-native semantic examples. Downloaded-package verification then caught
  the stale initializer dependency versions this batch corrects.
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
