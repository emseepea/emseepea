# Current Release Readiness

Date: 2026-10-11

## Release status

Publication status: **NOT READY**.

The local pre-push qualification passed for the evidence listed below.
Publication remains blocked until every exact-commit gate in
“Required release evidence” passes.

The repository's release verifier requires the next two machine-readable
markers. They mean only that local qualification and release-risk review
passed. They do not mean that the package is published.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Local pre-push qualification: **PASS**.
- Release-risk review: **PASS**, conditional on the exact-commit gates below.

## Codex local execution suppression

This change adds `features.shell_tool=false` alongside the
existing `features.unified_exec=false` setting for Codex semantic
qualification. It disables both currently supported stable local execution
features. If the installed Codex CLI rejects either setting, qualification
stops without removing the setting, retrying with weaker configuration, or
enabling local execution.

The existing read-only sandbox, empty inherited shell environment, forbidden
shell policy, ignored user configuration, advertised Model Context Protocol
(MCP) tool allowlist, parser rejection of non-MCP completed items, and evidence
redaction remain in place. The tested successful semantic path still passes.

[ADR-0057, Inspectable Semantic Evidence by Default](../decisions/0057-inspectable-semantic-evidence-by-default.proposed.md)
continues to govern the raw-stderr and redacted-evidence boundary. This change
does not add a maximum number of model tool calls or stop a turn because of
call count. It changes no `toolOutcomes` shape, preserving
[ADR-0116, Native Semantic Conversations Without a Tool-Call Count Limit](../decisions/0116-native-semantic-conversations-without-tool-call-count-limit.proposed.md)
and [ADR-0119, Read-Only Native Tool Outcomes on Semantic Conversation Turns](../decisions/0119-read-only-native-tool-outcomes-on-semantic-conversation-turns.proposed.md).

## Planned package set

- `@emseepea/testing@0.23.1`

No other package has a planned version change.

## Verified before push

Exact commit `60334eaeeb75a5590a1ca4fec7714b57e0beafd2` passed the repository's
local `push:qualify` gate and has not been pushed. Focused provider and Codex
runner tests passed 13 of 13, the testing package passed 71 of 71 tests, and
build, lint, architecture, Jobs To Be Done (JTBD), publication-copy,
cognitive-accessibility, and release-risk reviews passed.

The rejection test proves all three qualification trials keep both execution
features disabled, do not retry with weaker configuration, and do not retain
private path, endpoint, or credential sentinels.

## Required release evidence

The exact source commit must pass remote Quality before a release candidate is
created. Release must pass semantic qualification, publication under the npm
`next` tag, registry integrity, signatures, provenance, and downloaded-package checks.
Publish must promote the exact candidate to latest and merge back to main.
Independent installed-package execution must then prove the released Codex
configuration and fail-closed rejection behavior.

This release does not add categorical process diagnostics or bounded
forbidden-item summaries. Raw stderr and raw provider events remain excluded.
[Issue #157](https://github.com/emseepea/emseepea/issues/157) remains incomplete
until those later diagnostic capabilities pass their own privacy and
bounded-evidence acceptance checks. Publication also requires exact-commit
remote `Quality`, Release, and Publish success; the npm `latest` tag and
`gitHead` value; independent installed-package execution; a clean merge-back;
and a clean repository.
