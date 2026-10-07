# Current Release Readiness

Date: 2026-10-07

## Codex Semantic-Testing Provider

The planned release adds `codex-local` and `codex-ci` providers to
`@emseepea/testing`. The providers run genuine Codex CLI conversations against
the isolated test MCP server, preserve exact-session follow-ups, and support a
fresh provider conversation against the same running test application.

Codex execution uses an isolated configuration, a read-only sandbox, a
deny-shell policy, an empty spawned-shell environment, and only the target
server's advertised tools. Saved evidence records configured model provenance,
provider settings, native MCP calls, tool results, and bounded failure classes.

Exact source `6e56c6f6b78c23b2b416317de44cdc7d1db85c9e` passed the
repository-standard clean installation and full deterministic qualification.
Architecture, JTBD, cognitive-accessibility, and pipeline-risk reviews passed.
The final cumulative pipeline risk was 5/25, within appetite.

This is conditional source readiness. Source Quality, release-pull-request
checks, npm publication, downloaded-package verification, and promotion to
`latest` remain pending.

## Exact Planned Package Set

Changesets calculates one minor npm release:

- `@emseepea/testing@0.21.0`

No other package or website release is planned.

## Required Publication Evidence

Source Quality must pass for the exact source commit. The generated release
pull request must bind its exact versioned head to that source and pass its
Release build. Publication must then pass for the exact merge commit.

Verify `@emseepea/testing@0.21.0` from the downloaded registry package,
including its signature, provenance, public files, and `latest` tag. These
checks are still pending and the version is not yet published.

Codex CLI evaluation does not prove native ChatGPT connection, attachment,
retrieval, resource preview, streamed-file behavior, or MCP App rendering.
Those host-specific journeys remain separate evidence.

## Conditional Release Readiness

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Package publication and `latest` verification: NOT COMPLETE.
