# Current Release Readiness

Date: 2026-10-13

## Release status

Publication status: **RELEASED**. Testing 0.23.5 and the eleven initializer
patches at 0.1.14 are published under npm latest. Quality, Release, Publish,
registry verification, and merge-back qualification passed.

- Result: PASS
- Final result: within appetite.

## Codex account-app isolation

The runner disables account apps, local and remote plugins, shell tools, web
search, and multi-agent execution while retaining the configured test MCP
server. Foreign native calls and non-empty resource inventories still fail.
Codex CLI 0.162.0 or later is required.

This patch preserves the model process's configured proxy and certificate
settings. It keeps the provider environment restricted and shell environment
inheritance disabled. Authentication can therefore use the managed network
without enabling account apps or passing unrelated service credentials.

## Released package set

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

## Completed release evidence

- Source Quality passed for 5d51e96: https://github.com/emseepea/emseepea/actions/runs/38345976623
- Release passed for candidate 7da3391: https://github.com/emseepea/emseepea/actions/runs/38347064747
- Release PR merged: https://github.com/emseepea/emseepea/pull/166
- Publish and promotion passed: https://github.com/emseepea/emseepea/actions/runs/38349420205
- Merge-back Quality passed for 2585aa4: https://github.com/emseepea/emseepea/actions/runs/38349717466

A clean npm installation of @emseepea/testing 0.23.5 passed the three-trial
authenticated Codex conversation test. Separate initial, resumed, and fresh
sessions each returned empty native resource and template inventories and
successfully read the configured synthetic timetable. The latest tag resolves
to 0.23.5, with the same integrity hash as the tested installation. npm audit
signatures verified 70 package signatures and 37 attestations.

The first Release publication verification timed out while the SOAP initializer
was not yet visible. Retrying the failed job against the unchanged candidate
completed registry and downloaded-package verification. No immutable package
version was replaced.

The installed-package evidence SHA-256 hashes are:

- Native conversations: 7ab21f3162bfff1e3d35d138075be8b9272da312fbc6f118d666a089409cf893
- Native inventories: 671edec536b7fdd44b2cf802941bdf76a8c6dc4aec6cbc36fafc17a933e88900

These checks complete the exercised local native-client and release criteria
for issue #162. Live API-key CI authentication was not separately exercised;
local and CI invocations share the tested isolation configuration.
