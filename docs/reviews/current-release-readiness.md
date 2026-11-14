# Current Release Readiness

Date: 2026-11-15

## MCP failure diagnostics

Status: **PREPARED**. Publication is pending.

Tool calls, resource reads, and prompt requests can carry a fixed failure
reason in structured request telemetry. MCP Events methods have individual
request labels. Internal webhook workers report terminal delivery and queue
failures through the configured observability adapter.

## Planned packages

- `@emseepea/create-api-backed-server@0.1.37`
- `@emseepea/create-database-schema-server@0.1.37`
- `@emseepea/create-html-ui-server@0.1.37`
- `@emseepea/create-mongodb-backed-server@0.1.37`
- `@emseepea/create-multi-instance-postgres-server@0.1.37`
- `@emseepea/create-openapi-backed-server@0.1.37`
- `@emseepea/create-progress-streaming-server@0.1.37`
- `@emseepea/create-react-ui-server@0.1.37`
- `@emseepea/create-resources-and-prompts-server@0.1.37`
- `@emseepea/create-soap-backed-server@0.1.37`
- `@emseepea/create-tool-server@0.1.37`
- `@emseepea/feedback@0.13.1`
- `@emseepea/react@0.4.23`
- `@emseepea/server@0.26.1`
- `@emseepea/svelte@0.2.23`
- `@emseepea/testing@0.26.16`

## Qualification

Focused tests used real MCP HTTP requests and synthetic data. They confirmed
the expected failure reasons, preserved public protocol responses, and
checked that telemetry excludes private values. Worker tests covered retry,
terminal failure, a store failure, and shutdown without a late log.

Architecture, Jobs To Be Done, behavioural test, and cognitive accessibility
reviews covered the implementation and guidance. The exact source Quality
run, release candidate qualification, publication, registry readback,
independent installation, and mergeback Quality are separate checks.

These verdicts apply to release preparation.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
