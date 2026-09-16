# Prepublication Review for Published MCP Contract Compatibility

Date: 2026-09-16

This record covers this planned release to npm's default `latest` channel:

- `@emseepea/testing@0.12.0`

Publication is pending.

## What Changes for Users

`@emseepea/testing` can now extract the effective public contract visible to a
connected Model Context Protocol (MCP) client, write a deterministic versioned
baseline, and compare the current contract with one or more earlier baselines.

The compatibility check distinguishes input and output schema direction. It
reports removed tools and resources, incompatible types, required fields,
enumerations and constraints, MIME type changes, user interface metadata,
output-template changes, and Content Security Policy widening. Unknown schema
changes fail closed. The application still owns release policy and baseline
retention.

## Evidence Available Before Publication

- ADR-0006 (Canonical Public Contract and Private Manifest Compilation)
  already governs deterministic contract artifacts and compatibility checks.
  The independent architecture review passed without requiring a new decision.
- JTBD-006 (Evolve a Published MCP Contract Safely) is ratified. The independent
  Jobs To Be Done review passed without a gap or new job.
- The focused built-package suite passed six tests. It covers the real HTTP MCP
  boundary, complete pagination, byte-stable baseline writing, compatible and
  incompatible input and output changes, resource and MIME type changes, modern
  and compatibility UI metadata, CSP widening, unknown schema keywords,
  concrete diagnostics, and repeated-cursor failure.
- The complete monorepo build passed.
- All 26 `@emseepea/testing` built-package tests passed after the complete build.
- Independent cognitive-accessibility and Markdown accessibility reviews passed
  for the package guide and Changeset.
- Independent external communication risk and voice-and-tone reviews passed for
  the Changeset.
- The release-risk review rated commit, push, and release risk at 5/25, within
  the repository's 5/25 appetite.

## Required After This Record Is Committed

- Exact-commit Quality and Release workflows for the source commit.
- Generated Changesets release pull request based on that exact source commit.
- Exact-head merge of the release pull request followed by exact-commit Quality
  and Release workflows for the version commit.

## Required After npm Publication

The release workflow must verify `@emseepea/testing@0.12.0` on npm's default
`latest` channel, including provenance, integrity, the expected Git revision,
clean installation, and public imports. The Git tag and GitHub release must
refer to the same version commit.

## Evidence Boundary

- Local builds and tests do not prove exact-commit continuous integration.
- This record does not prove npm publication, registry verification, a Git tag,
  a GitHub release, website deployment, or adopter production use.
- No website content changes in this release, so no website production claim is
  planned.

## Review Status

- Result: PASS
- Reviewed source change: passed locally.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE; source CI, release pull request, npm
  publication, and registry verification remain pending.
