# Current Release Readiness

Date: 2026-10-13

## Planned change

Publication status: **NOT YET RELEASED**. This patch removes the Codex CLI version cutoff from the testing runner. The installed version remains evidence metadata. Invocation isolation and rejection of failed calls, forbidden operations and incomplete events are unchanged.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.

These markers record the reviewed slice and residual risk of 5/25. They do not claim completed publication. Full local qualification, benchmark, exact-source Quality, authoritative release checks, packed-consumer checks and registry verification must pass before delivery is reported complete.

## Planned package set

- `@emseepea/testing@0.23.6`
- `@emseepea/create-tool-server@0.1.15`
- `@emseepea/create-api-backed-server@0.1.15`
- `@emseepea/create-openapi-backed-server@0.1.15`
- `@emseepea/create-resources-and-prompts-server@0.1.15`
- `@emseepea/create-progress-streaming-server@0.1.15`
- `@emseepea/create-html-ui-server@0.1.15`
- `@emseepea/create-react-ui-server@0.1.15`
- `@emseepea/create-multi-instance-postgres-server@0.1.15`
- `@emseepea/create-database-schema-server@0.1.15`
- `@emseepea/create-mongodb-backed-server@0.1.15`
- `@emseepea/create-soap-backed-server@0.1.15`

The eleven initializer patches propagate the corrected testing dependency into generated starter projects. They do not change initializer application behavior.

## Completed narrow checks

All thirteen focused provider tests passed, including retained isolation, forbidden-event and failed-call checks, version metadata and invalid metadata rejection. Server and testing builds passed.

Authenticated Codex CLI 0.159.2 completed three fixed trials using configured model gpt-5.5, without semantic retries. Each trial read four synthetic timetable routes, resumed to re-read one route, then read one route in a fresh session. Eighteen exact tool calls and nine native turns passed. Nine meaning judgments cover the initial answers; resumed and fresh answers use literal value and exact-call assertions.

The bounded receipt is in [the CLI behaviour evidence](codex-cli-behaviour-2026-10-13.json). Local Codex evidence is supplemental and is labeled non-authoritative by the runner; the normal authoritative publication gates remain required. The timetable test does not exercise every forbidden capability. Unchanged executable isolation contracts provide the corresponding negative checks. No universal CLI compatibility is claimed.

## Environment repair and evidence limits

The first full local run failed because the required Playwright browser was absent. After installation, a second run exposed an owner-only permission on the synthetic PostgreSQL schema fixture. The fixture is now readable by the database container, and its seven focused tests passed. Both failed-run logs are preserved outside the public repository. Fixture bytes are unchanged; no production configuration or data was changed. Exact-commit full qualification is still required.

This slice does not add registered resource-helper support or completed-turn recovery capture. Existing strict failure behavior remains. It does not replace any prior failed study comparison or establish product question quality.
