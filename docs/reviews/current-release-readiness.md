# Current Release Readiness

Date: 2026-11-04

## Optional WebMCP tools

Status: **PREPARED, NOT PUBLISHED**. The browser-only `@emseepea/server/webmcp` entry point registers every tool visible through an existing connected MCP client. Filtering is optional. Server authorization, complete results and account-lifetime cleanup remain in their existing owners.

This increment exposes tools. Resource reads, resource templates and prompts remain required work under [the full-catalogue outcome](https://github.com/emseepea/emseepea/issues/230). Native browser and isolated CLI checks do not establish ChatGPT or Claude extension compatibility.

## Planned packages

The existing Changesets planner selected the following versions for release PR #233. The pending setup-guide and native-test correction requires a new qualified source and generated candidate before release:

- `@emseepea/server@0.26.0`
- `@emseepea/create-tool-server@0.1.36`
- `@emseepea/create-api-backed-server@0.1.36`
- `@emseepea/create-openapi-backed-server@0.1.36`
- `@emseepea/create-resources-and-prompts-server@0.1.36`
- `@emseepea/create-progress-streaming-server@0.1.36`
- `@emseepea/create-html-ui-server@0.1.36`
- `@emseepea/create-react-ui-server@0.1.36`
- `@emseepea/create-multi-instance-postgres-server@0.1.36`
- `@emseepea/create-database-schema-server@0.1.36`
- `@emseepea/create-mongodb-backed-server@0.1.36`
- `@emseepea/create-soap-backed-server@0.1.36`
- `@emseepea/feedback@0.11.11`
- `@emseepea/react@0.4.22`
- `@emseepea/svelte@0.2.22`
- `@emseepea/testing@0.26.15`

The eleven initializer patches are required because their generated projects pin the server dependency. Existing release checks require an initializer version change when that starter dependency changes. No initializer manifest or release check was edited to manufacture this plan.

## Verified preparation

The framework build and public type checks passed. The framework suite passed 177 checks; the native integration check passed in Chrome 156.0.8078.80 with 15 tools. It exercises pagination, metadata, generic errors, authorization before handler execution, account changes and cleanup.

The separate isolated bridge check passed descriptions/schema parity, real native execution, backend correlation, missing-native failure without a backend shortcut and observable cleanup. Native checks are mandatory in the existing framework test command.

Exact-commit local qualification and source Quality 41642200392 passed at `4e76fa2dae2e7abbb389765123dba538e9c0e6d4`, including the native checks on both CI Node versions. Those results cover that source, not the later correction.

One complete local Codex qualification passed three fresh conversations, six answer turns, twelve native calls and eighteen independent tool-free judgments, with zero semantic retries. An independent reviewer verified provider/native/backend correlation and all six checkpoint hashes.

That run used configured `gpt-6.1-sol`, Codex CLI 0.162.0, MCP client 2.3.1 and Chrome 156.0.8078.80. It is non-authoritative local evidence. Source was captured as uncommitted tree `9fc46083b4bd91fe5fef1cd4e0667d69ce6a9dab`; all 21 captured file hashes remained unchanged through the run.

Later release-note and readiness updates do not constitute another model run. The existing credentialed Claude release authority remains mandatory. A post-run process check observed no remaining headless Chrome processes.

The earlier full repository run passed 524 of 525 final checks. Its documentation-review filename failure was repaired using the existing daily review record; all three targeted review checks then passed. The later standard exact-commit qualification passed at the source above. Earlier failed attempts remain failed.

Both attempts of Release build 41644617823 failed at candidate `a7eac133c87d9b6c2883c01644ffac2d1f554f1a`, each recording 66 model command errors and no completed conversation turns. Publication was skipped. The saved evidence does not establish the underlying provider cause.

A local HTTP check with 65 tools across 65 pages found that the official MCP client’s default `listMaxPages` setting rejects discovery after 64 pages. Its supported constructor option `listMaxPages: 0` retrieves all 65. The setup guide now makes that setting explicit.

The corrected native integration passed in Chrome 156.0.8078.80 with 65 tools across 65 pages, including native and independent reads of the final catalogue entry, default-client failure with zero registrations, authorization and cleanup.

Fresh exact-commit qualification remains pending. The adapter does not change caller-owned client settings or bypass the SDK’s validation and filtering.

## Reviews and remaining checks

Architecture and Jobs To Be Done reviews passed. New tests were classified as behavioural, and public prose received voice and cognitive-accessibility review. The local qualification plan was assessed at 4/25, with projected release risk 5/25 conditional on required controls passing.

The setup-guide and native-test correction needs updated concrete commit/push/release assessment, exact-source qualification and source Quality. Candidate semantic and downloaded-package checks, registry verification, governed promotion and merge-back Quality remain required. An independent installation must exercise the published WebMCP entry point before this increment can close.

The [previous release-time checkpoint](https://github.com/emseepea/emseepea/blob/0260d8a1cbc6dfefa10b68244979e83949de536c/docs/reviews/current-release-readiness.md) remains immutable. This record neither replaces historical failures with passes nor claims adopter-production verification.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
