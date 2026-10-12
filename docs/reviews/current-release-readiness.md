# Current Release Readiness

Date: 2026-10-13

## Release status

Publication status: **NOT READY**.

The #162 source implementation and local package checks pass. Publication
remains pending until the final source commit passes the repository's Quality,
Release, Publish, registry, installed-package, merge-back, and clean-checkout
gates.

The repository's release verifier requires the next two machine-readable
markers. They record only the current source review result; they do not mean
that the package is published.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Local package verification: **PASS**.
- Cognitive-accessibility review: **PASS** for the recorded source hashes.
- Release-risk review: required for the final source commit before release.

## Codex account-app isolation

`@emseepea/testing` now disables Codex account apps, local plugins, remote
plugins, multi-agent execution, web search, shell tools, unified execution, and
login-shell environment inheritance for every Codex semantic invocation.

The configured synthetic MCP server remains available. The runner still
pre-approves only the discovered tools from that server, and successful turns
must provide native-client evidence that every observed application call uses
the configured test server and tools. The only excluded client plumbing is the
two resource-discovery calls through the built-in `codex` server, accepted only
when their native results contain exact empty inventories. Non-empty discovery
results and all other foreign native tools remain rejected.

Codex semantic testing now supports Codex CLI 0.162.0 or later. Older Codex CLI
versions fail before qualification because they cannot prove the required
isolation settings.

The test suite also keeps the protected fixture on a per-trial random port so
the three native trials can verify authenticated startup without sharing one
fixed listener.

## Planned package set

- `@emseepea/testing@0.23.3`

## Verified before push

The full `@emseepea/testing` package suite passed 75 tests, including:

- one-shot, resumed, and fresh Codex sessions;
- disabled apps, plugins, remote plugins, shell tools, and unified execution;
- supported Codex CLI version enforcement;
- native synthetic MCP calls and exact-empty resource-discovery evidence;
- forbidden-call rejection and bounded diagnostic evidence;
- credential redaction and cancellation behavior.

`decisions:check`, `git diff --check`, and `changeset status` passed. The public
Markdown changed by #162 passed cognitive-accessibility review for the recorded
source hashes.

The dependency drift left by the previous `@emseepea/testing@0.23.2` release is
also corrected: every example package now depends on the current testing
package version.

## Required release evidence

The final source commit must pass remote Quality. The release candidate must
then pass semantic qualification, publication under npm `next`, registry
integrity, signatures, provenance, and downloaded-package checks. Publish must
promote the exact candidate to `latest` and merge it back to `main`.

An independent clean installation of the published package must verify the
Codex isolation settings, the supported CLI version gate, the package bins, and
the documented account-app isolation behavior.

Only that published-package evidence can complete #162.
