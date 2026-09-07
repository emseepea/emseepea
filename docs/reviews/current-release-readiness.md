# Current Release Readiness

Date: 2026-09-08

## Release Batch

- `@emseepea/testing@0.5.2`
- `@emseepea/create-tool-server@0.0.13`
- `@emseepea/create-api-backed-server@0.0.13`
- `@emseepea/create-sign-in-tool-server@0.0.12`
- `@emseepea/create-resources-and-prompts-server@0.0.12`
- `@emseepea/create-progress-streaming-server@0.0.12`
- `@emseepea/create-html-ui-server@0.0.14`
- `@emseepea/create-react-ui-server@0.0.13`
- `@emseepea/create-multi-instance-postgres-server@0.0.2`

## Change for Users

Testing 0.5.2 identifies a failed answer trial and records its safe provider
failure category. The initializer patches make this diagnostic available in
newly generated projects. Registry verification allows three minutes for npm
propagation.

## Evidence Before Publication

- The testing package and focused release workflow tests passed locally.
- Architecture and Jobs To Be Done reviews passed.
- Cognitive-accessibility and Markdown accessibility reviews passed.
- The preceding publishing commit passed exact-commit Quality. Seven semantic
  examples passed, while the React example produced two correct conversations
  before one answer provider invocation failed without a recorded cause. This
  batch fixes that diagnostic gap and requires fresh exact-commit qualification.
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
