# Current Release Readiness

Date: 2026-09-09

## Release Batch

- `@emseepea/server@0.4.0`
- `@emseepea/testing@0.6.0`
- `@emseepea/react@0.0.10`
- `@emseepea/create-api-backed-server@0.0.15`
- `@emseepea/create-database-schema-server@0.0.2`
- `@emseepea/create-html-ui-server@0.0.16`
- `@emseepea/create-mongodb-backed-server@0.0.2`
- `@emseepea/create-multi-instance-postgres-server@0.0.5`
- `@emseepea/create-progress-streaming-server@0.0.14`
- `@emseepea/create-react-ui-server@0.0.15`
- `@emseepea/create-resources-and-prompts-server@0.0.14`
- `@emseepea/create-soap-backed-server@0.0.2`
- `@emseepea/create-tool-server@0.0.15`

## Change for Users

Every initializer remains open by default and now accepts the same typed
authentication and observability extensions. An application can keep discovery
public or explicitly require authentication and filter the catalogue by
principal permissions. The framework applies the same access model to tools,
resources, templates, prompts, and completions before application work.

Observability adapters receive only immutable framework-redacted events. The
same event supports structured logging and OpenTelemetry. The separate sign-in
initializer is removed because authentication now composes with every
application shape.

## Local Evidence Before Publication

- Tom Howard ratified ADR-0064 and ADR-0065. Their human-oversight markers are
  confirmed and the decision compendium is current.
- TypeScript compilation, lint, framework black-box tests, package tests, and
  ordinary tests for all ten maintained initializers pass.
- PostgreSQL, MongoDB, SOAP, and both UI browser-accessibility suites pass.
- The semantic suite includes focused one-turn cases for both a permitted and
  hidden protected catalogue. Each checks exact tool selection and answer
  meaning. It remains subject to the later provider-native release gate.
- The local benchmark passes the existing whole-request limits. With the
  built-in OpenTelemetry adapter and no exporter, p95 application-process CPU
  was 1.083 milliseconds, p95 sampled transient allocation was 73,392 bytes,
  and average added protocol bytes were 877. These local results do not replace
  exact-commit CI evidence or measure an adopter's exporter.
- Independent architecture, Jobs To Be Done, Markdown accessibility, and
  cognitive-accessibility review findings were corrected before this record.

## Required Publication Evidence

- Exact-commit Quality must pass Node.js 22 and 24, OSV, website, package,
  standalone initializer, integration, accessibility, and performance checks.
- The standalone run must create all ten projects outside the monorepo, install
  them, and pass lint, ordinary tests, and semantic smoke tests.
- The later release job must pass every provider-native semantic example before
  publication.
- npm publication must use Trusted Publishing and expose provenance, registry
  metadata, clean installation, software bills of materials, and package
  evidence.
- Every published version of `@emseepea/create-sign-in-tool-server` must be
  deprecated only after the replacement tool initializer is published and
  verified.

## Review Status

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- No package in this release batch is claimed as published by this record.
