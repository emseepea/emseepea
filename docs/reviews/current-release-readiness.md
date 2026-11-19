# Current Release Readiness

Date: 2026-11-19

## Scheduled recovery for PostgreSQL Events

Status: **PREPARED**. Publication is pending.

An adopter can register a separate recovery route on the Events worker
service. The route verifies the scheduler identity, then finds committed
work while the request server is idle. It uses the existing dispatch ledger
and checked Cloud Tasks transport. General server imports stay Google-free.

## Planned packages

- `@emseepea/create-api-backed-server@0.1.39`
- `@emseepea/create-database-schema-server@0.1.39`
- `@emseepea/create-html-ui-server@0.1.39`
- `@emseepea/create-mongodb-backed-server@0.1.39`
- `@emseepea/create-multi-instance-postgres-server@0.1.39`
- `@emseepea/create-openapi-backed-server@0.1.39`
- `@emseepea/create-progress-streaming-server@0.1.39`
- `@emseepea/create-react-ui-server@0.1.39`
- `@emseepea/create-resources-and-prompts-server@0.1.39`
- `@emseepea/create-soap-backed-server@0.1.39`
- `@emseepea/create-tool-server@0.1.39`
- `@emseepea/feedback@0.13.3`
- `@emseepea/react@0.4.25`
- `@emseepea/server@0.28.0`
- `@emseepea/svelte@0.2.25`
- `@emseepea/testing@0.26.18`

The private website is planned at `0.0.22` so the recovery guide can deploy.

## Qualification

The framework build and 62 worker and transport checks passed. The real
PostgreSQL 17.11 dispatch suite passed all 19 cases. Its recovery scenario
used signed synthetic scheduler tokens over loopback HTTP and controlled
Cloud Tasks responses. It found committed work with the request server absent,
restarted the worker and observed the original task without creating a
duplicate. Separate checks covered credentials, pause, retry and shutdown.

A clean consumer installed the local archive, passed six public-entry checks
and compiled the public TypeScript API. The website built successfully.
Promotion requires the exact source Quality run and release candidate checks.
After publication, verify the registry consumer, live guide and mergeback.
Live provider deployment and automatic native-client execution remain part of
issue #174.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
