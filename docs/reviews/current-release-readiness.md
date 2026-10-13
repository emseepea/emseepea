# Current Release Readiness

Date: 2026-10-13

## Release status

Publication status: **RELEASED (experimental native adapter)**. Testing 0.24.0
and eleven initializer updates at 0.1.16 are available under npm latest.
The native browser adapter requires explicit opt-in. Ordinary framework tests
do not enable it, install Playwright, or constrain an existing browser version.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.

The PASS markers apply to the independently reviewed diagnostic investigation
slice now proposed for trunk. No new package release is selected. Standing
performance-release risk remains outside appetite until the conflicting
measurements are classified and treatment is verified.

## Released package set

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
Testing 0.23.6 was the previous released baseline and included removal of the
Codex CLI version cutoff while retaining invocation isolation and strict
failure checks. This release preserves that behavior.

## Verified adapter behavior

Full local qualification passed for source 56c1b52, including builds, type
checks, lint, workspace tests, and 423 black-box, documentation, and LLM harness
tests. Ten scripted-page contract tests and a real Chromium test against an
intercepted synthetic DOM verify the native adapter contract. The browser
fixture covers attachment upload, iframe card visibility, scoped PNG assertion,
and fresh retrieval. Fresh retrieval rejects inherited user and assistant
messages before another prompt is submitted.

A fresh npm installation of testing 0.24.0 imported both the default and native
entry points without Playwright installed. Both shipped CLI commands exposed
their documented help. The source package also installed alongside Playwright
1.50.1 without changing that browser dependency. npm audit signatures verified
70 registry signatures and 37 attestations for the installed release graph.

These checks establish adapter behavior and packaging. They do not establish
live ChatGPT compatibility.

## Release evidence

- Source Quality passed: https://github.com/emseepea/emseepea/actions/runs/38376781979
- Release candidate d9671aa passed: https://github.com/emseepea/emseepea/actions/runs/38378363040
- Release PR merged: https://github.com/emseepea/emseepea/pull/168
- Publish and promotion: https://github.com/emseepea/emseepea/actions/runs/38382120465
- Merge-back commit: 30d09eba29605c13f0e95ed14ef43e6a6b239752
- Final merge-back Quality: https://github.com/emseepea/emseepea/actions/runs/38386255479

The first candidate publication check timed out during registry propagation.
The unchanged publication job passed on retry. The first merge-back check
failed the Node.js 22 production JSON-boundary performance budget; its
functional tests passed. The same commit passed the failed-job retry. The
production boundary implementation and benchmark were unchanged by merge-back.
Publish retried its failed job and dispatched the final full qualification.
No immutable package version was replaced, and no performance gate was loosened.

## Open performance investigation

The initial complete Node 22 population on main 30d09eb exceeded the unchanged
5 ms p95 CPU limit. Passing reruns and the final full workflow remain retained
observations; they do not erase that failure or establish which population is
representative. Problem 015 is reopened and R014 records the unresolved
between-population classification risk. The published package versions remain
available; a further package release needs a fresh risk assessment after the
control repair and exact qualification.

Shared-clock diagnostic instrumentation preserves ordinary limits and sample
populations. Its one fixed cloud run is nonqualifying and uses different
hardware from the failed GitHub population. See the bounded
[diagnostic receipt](diagnostic-clock-2026-10-13.json). A green investigation
pipeline would verify that slice, not close the performance problem.

## Native host limits and next step

Issue #145 remains open. Live verification needs local human login to the
approved account and an authorized HTTPS MCP endpoint. Plugin discovery,
OAuth connection and failure paths, authenticated native-client correlation,
actual card rendering and interaction, durable state, fresh retrieval, and
cleanup still need live evidence. Starting a fresh conversation does not reset
account memory. Keep test content synthetic and use the dedicated profile.

The setup command requires an interactive local terminal and a headed browser.
Hosted headless CI cannot complete human MFA or consent. An adopter who runs
native journeys on a controlled desktop runner owns its authentication,
profile protection, endpoint, cleanup, and evidence retention. Keep profiles,
cookies, credentials, and private learner data outside repositories and CI
artifacts. The runner does not export authentication state.
