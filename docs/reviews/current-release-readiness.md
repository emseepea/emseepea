# Current Release Readiness

Date: 2026-10-07

## Command-Line Model Context Protocol (MCP) Qualification

The planned release adds two cumulative capabilities to `@emseepea/testing`:

- `codex-local` and `codex-ci` providers for genuine Codex command-line
  interface (CLI) semantic conversations against an isolated test MCP server;
  and
- the `emseepea-qualify` command and public qualification APIs for bounded MCP
  journeys.

Those bounded journeys cover:

- OAuth authorization metadata;
- catalogues;
- resource templates;
- resource reads;
- original bytes and hashes;
- resource links;
- progress;
- cancellation; and
- access denial.

The providers preserve exact-session follow-ups and support fresh provider
conversations against the same running test application. Codex execution uses
an isolated configuration, a read-only sandbox, a deny-shell policy, an empty
spawned-shell environment, and only the target server's advertised tools.

The qualification command records bounded evidence with passed, failed,
blocked, or incomplete outcomes. Adopter prompts, assertions, credentials, and
the target MCP remain outside the framework.

Architecture, Jobs To Be Done, cognitive-accessibility, and release-recovery
reviews passed. The release-recovery regression proves that an abandoned
staged candidate cannot force a newer checked source to reuse an occupied npm
version.

## Exact Planned Package Set

Changesets calculates one minor npm release. The checked staged-candidate
recovery advances it to the next fresh patch on the same planned version line:

- `@emseepea/testing@0.21.1`

No other package or website release is planned. Root and feedback-package test
dependencies are generated edits, not additional releases.

The abandoned `@emseepea/testing@0.21.0` candidate remains under `next` with
its original provenance. It is not this release and must not be promoted.

## Required Publication Evidence

Source Quality must pass for the exact source commit. The generated release
pull request must bind its exact versioned head to that source and pass its
Release build. Publication must then pass for the exact merge commit.

Verify `@emseepea/testing@0.21.1` from the downloaded registry package. The
verification must cover:

- signature;
- provenance;
- public files;
- the `emseepea-qualify` executable;
- install and import behavior; and
- the `latest` tag.

Command-line qualification does not prove these host-specific journeys:

- native ChatGPT connection;
- attachment;
- retrieval;
- resource preview;
- streamed-file behavior; or
- MCP App rendering.

Those host-specific journeys remain separate evidence.

## Conditional Release Readiness

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Package publication and `latest` verification: NOT COMPLETE.
