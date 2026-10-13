# Current Release Readiness

Date: 2026-10-13

## Release status

Publication status: **PENDING**. The candidate adds an experimental opt-in
ChatGPT browser adapter. It does not claim that the full live #145 journey has
passed. The package contract and intercepted Chromium fixture checks passed;
full source qualification and release gates must pass before publication.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.

## Planned package set

- `@emseepea/testing@0.24.0`
- `@emseepea/create-api-backed-server@0.1.16`
- `@emseepea/create-database-schema-server@0.1.16`
- `@emseepea/create-html-ui-server@0.1.16`
- `@emseepea/create-mongodb-backed-server@0.1.16`
- `@emseepea/create-multi-instance-postgres-server@0.1.16`
- `@emseepea/create-openapi-backed-server@0.1.16`
- `@emseepea/create-progress-streaming-server@0.1.16`
- `@emseepea/create-react-ui-server@0.1.16`
- `@emseepea/create-resources-and-prompts-server@0.1.16`
- `@emseepea/create-soap-backed-server@0.1.16`
- `@emseepea/create-tool-server@0.1.16`

The initializer patches update generated projects to use the testing package.
They do not enable browser journeys or install the optional Playwright dependency.

## Verified adapter behavior

Nine scripted-page contract tests passed, covering explicit opt-in, ownership,
server correlation, fixed error categories, bounded evidence, missing access,
and cleanup. A real Chromium test against an intercepted synthetic DOM passed
attachment upload, iframe card visibility, scoped image assertions, and fresh
conversation retrieval. Type checks and lint passed. These checks are adapter
evidence, not live ChatGPT qualification.

## Native host limits

Live verification requires the authorized account owner to log in locally and
connect an authorized HTTPS MCP endpoint. Endpoint selection, authenticated
native-client observations, OAuth discovery/connection failure paths, real card
rendering, durable state, and fresh retrieval remain pending. Issue #145 stays
open until those acceptance criteria have live evidence. The README and release
note identify the adapter as experimental. No passwords, cookies, account
email, or private learner data are included in publication artifacts.

## Release gates

Full local qualification, source Quality, release-candidate build, downloaded
package checks, registry verification, and promotion must pass against their
required commits. Publication is pending until these gates complete. The
previous testing 0.23.5 release completed #162; this candidate preserves that
transport fix and account-app isolation.


## Integrated Codex CLI Compatibility Fix

This candidate also includes the concurrent trunk fix that removes the Codex
CLI version cutoff. Version metadata remains in evidence, and invocation
isolation and rejection of forbidden operations, failed calls, and incomplete
events remain unchanged. It makes no universal CLI compatibility claim.

The trunk change records thirteen passing focused provider tests and three
fixed authenticated Codex 0.159.2 trials, including initial, resumed, and fresh
reads. Its supplemental bounded receipt remains in
[codex-cli-behaviour-2026-10-13.json](codex-cli-behaviour-2026-10-13.json).
The combined source still requires full qualification and release gates.


Testing 0.23.6 and initializers 0.1.15 are now the released baseline. Release
candidate 7c22d7e passed its unchanged failed-job retry after registry propagation,
and PR #167 promoted it to latest. The native adapter targets fresh versions
0.24.0 and 0.1.16 after rebasing onto merge-back fe6076d.
