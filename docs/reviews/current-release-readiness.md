# Current Release Readiness

Date: 2026-10-13

## Release status

Publication status: **PROPOSED (remaining CLI version-guard removal)**.
The selected patch plans testing 0.24.1 and eleven initializer updates at 0.1.17.
It removes numeric MCP-client and Claude CLI eligibility checks while retaining
package identity, version provenance and behavioral qualification.

The previously released experimental native adapter remains available. Testing 0.24.0
and eleven initializer updates at 0.1.16 are available under npm latest.
The native browser adapter requires explicit opt-in. Ordinary framework tests
do not enable it, install Playwright, or constrain an existing browser version.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.

Fresh independent cumulative risk assessment is 5/25 for this guard-removal
release. Exact-source full qualification, benchmark, remote Quality and normal
publication gates still apply. The fixed control passed first-attempt main
Quality 38401142463 on both governed runtimes; that evidence does not substitute
for the guard patch's own checks.

## Planned package set

- `@emseepea/testing@0.24.1`
- `@emseepea/create-api-backed-server@0.1.17`
- `@emseepea/create-database-schema-server@0.1.17`
- `@emseepea/create-html-ui-server@0.1.17`
- `@emseepea/create-mongodb-backed-server@0.1.17`
- `@emseepea/create-multi-instance-postgres-server@0.1.17`
- `@emseepea/create-openapi-backed-server@0.1.17`
- `@emseepea/create-progress-streaming-server@0.1.17`
- `@emseepea/create-react-ui-server@0.1.17`
- `@emseepea/create-resources-and-prompts-server@0.1.17`
- `@emseepea/create-soap-backed-server@0.1.17`
- `@emseepea/create-tool-server@0.1.17`

## Released baseline

Testing 0.24.0 and eleven initializers 0.1.16 remain the available baseline.
The planned versions above have not been published.

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

## Retained performance conflict and verified control

The initial complete Node 22 population on main 30d09eb exceeded the unchanged
5 ms p95 CPU limit. Passing reruns and the final full workflow remain retained
observations; they do not erase that failure or establish which population is
representative. The complete-population classification gap is now verified
on main b63af5b, first-attempt Quality 38401142463. Fresh independent R014 risk
is 3/25; the cumulative guard-release assessment is 5/25. Hardware normalization
and the historical variation cause remain unestablished. The original failure
remains evidence and no equivalence claim is made.

Shared-clock diagnostic instrumentation preserves ordinary limits and sample
populations. Its one fixed cloud run is nonqualifying and uses different
hardware from the failed GitHub population. See the bounded
[diagnostic receipt](diagnostic-clock-2026-10-13.json). The diagnostic
slice alone did not qualify release; the later fixed control has its own retained
verification receipt.

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

## Fixed population verification

The infrastructure control on main collects exactly three complete populations
per invocation and retains the existing per-population limits. It accepts only three
complete, uninstrumented passes. Conflicting results are INCONCLUSIVE; failed
or incomplete measurements cannot qualify. Partial cohort checkpoints and
child-process cleanup preserve interruption evidence. The infrastructure
control itself publishes no npm package. Both governed runtime artifacts were
hash-verified and their classifications recomputed from raw samples. The
[bounded receipt](fixed-population-control-verification-2026-10-13.json) retains
the exact first-attempt evidence and its limits.

## Remaining CLI eligibility patch

The CLI records the installed MCP-client and Claude versions without comparing
them with numeric cutoffs. It still rejects the wrong client package identity
or missing version provenance. Strict failed-call status, invocation isolation,
resume behavior and raw evidence remain unchanged.

The preserved generic native proof contains three trials, nine turns, eighteen
application calls and nine initial meaning judgments. It uses actual Codex
0.159.2 with configured model gpt-5.5 and no semantic retries. Those bounded
observations do not establish general older-client or Claude compatibility,
resource-helper support, learner question quality or authenticated ChatGPT
production behavior. No prior failure is re-adjudicated.
