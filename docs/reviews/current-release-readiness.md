# Current Release Readiness

Date: 2026-10-13

## Release status

Publication status: **NOT READY**. The source checks and authenticated local
Codex verification pass. The exact-commit Quality, Release, Publish, registry,
and merge-back gates must pass before publication is complete.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.

## Codex account-app isolation

The runner disables account apps, local and remote plugins, shell tools, web
search, and multi-agent execution while retaining the configured test MCP
server. Foreign native calls and non-empty resource inventories still fail.
Codex CLI 0.162.0 or later is required.

This patch preserves the model process's configured proxy and certificate
settings. It keeps the provider environment restricted and shell environment
inheritance disabled. Authentication can therefore use the managed network
without enabling account apps or passing unrelated service credentials.

## Planned package set

- `@emseepea/create-api-backed-server@0.1.14`
- `@emseepea/create-database-schema-server@0.1.14`
- `@emseepea/create-html-ui-server@0.1.14`
- `@emseepea/create-mongodb-backed-server@0.1.14`
- `@emseepea/create-multi-instance-postgres-server@0.1.14`
- `@emseepea/create-openapi-backed-server@0.1.14`
- `@emseepea/create-progress-streaming-server@0.1.14`
- `@emseepea/create-react-ui-server@0.1.14`
- `@emseepea/create-resources-and-prompts-server@0.1.14`
- `@emseepea/create-soap-backed-server@0.1.14`
- `@emseepea/create-tool-server@0.1.14`
- `@emseepea/testing@0.23.5`

The eleven initializer patches update their generated projects to use the
corrected testing package.

## Verified before push

The full local test suite passed, including all workspace suites and 423
black-box, documentation, and LLM harness tests. Focused provider tests verify
transport settings, excluded unrelated credentials, and retained shell
restrictions for both Codex and Claude.

Authenticated Codex CLI 0.162.1, configured for gpt-6.1-sol, passed three fresh
trials. Each made four synthetic timetable reads, resumed for one read, then
started a fresh session for one read. Independent meaning checks passed. Native
resource and template discovery returned empty inventories. These observations
verify the exercised local conversations; they do not claim live API-key CI
authentication was tested. The local and CI paths share the isolation settings
and are covered by lifecycle regression tests.

Inspect the retained synthetic evidence in
`docs/reviews/codex-native-isolation-2026-10-13.json` and the inventory summary in
`docs/reviews/codex-native-inventories-2026-10-13.json`. No account metadata or
credentials are included.

## Required release evidence

Quality must pass for the final source commit. Release must qualify the
candidate, publish under npm next, and verify registry integrity, signatures,
provenance, and downloaded packages. Publish must promote that candidate to
latest and qualify its merge back to main.

A clean installation must then pass the same authenticated native conversation
and empty-inventory checks using the installed package. Only that evidence
completes issue #162.
