# Current Release Readiness

Date: 2026-09-18

Release verification is not complete. This review covers the opt-in
published-contract policy module and its dependency-closed initializer
releases:

- `@emseepea/testing@0.16.0`
- `@emseepea/create-api-backed-server@0.0.39`
- `@emseepea/create-database-schema-server@0.0.26`
- `@emseepea/create-html-ui-server@0.0.41`
- `@emseepea/create-mongodb-backed-server@0.0.26`
- `@emseepea/create-multi-instance-postgres-server@0.0.29`
- `@emseepea/create-openapi-backed-server@0.0.21`
- `@emseepea/create-progress-streaming-server@0.0.39`
- `@emseepea/create-react-ui-server@0.0.41`
- `@emseepea/create-resources-and-prompts-server@0.0.38`
- `@emseepea/create-soap-backed-server@0.0.26`
- `@emseepea/create-tool-server@0.0.41`

## Published Contract Command

`emseepea-contract check` can load one explicit trusted local policy module.
The fixed `checkPublishedMcpContracts` export receives the extracted current
contract and each sorted parsed baseline. Application code can migrate legacy
values, normalize both sides, and apply its own comparison semantics before it
returns structured compatibility breaks.

The command continues to own discovery, extraction, command-managed token
redaction, diagnostics, and exit statuses. Checks without `--policy` retain the
existing validation, comparison, diagnostic order, and exit behavior. Capture
rejects `--policy` and does not rewrite baselines.

Policy modules are trusted application code with the same process authority as
the command. The command does not pass its bearer token to the policy input and
redacts errors it formats, but it cannot redact output written directly by the
module. Applications continue to own migration, normalization, comparison,
baseline retention, approvals, capture timing, release, and deployment policy.

## Evidence So Far

- ADR-0095 was ratified before implementation. Post-implementation architecture
  review passed after a RED-first regression test restored the default path's
  sequential baseline-validation diagnostics.
- Jobs To Be Done review confirmed alignment with JTBD-005, Migrate an
  Established MCP Server Safely, and JTBD-006, Evolve a Published MCP Contract
  Safely.
- Six focused Node.js 24 command tests pass for unchanged default behavior,
  sorted raw policy inputs, migration, normalization, custom comparison,
  structured diagnostics, failure handling, token redaction, and capture
  rejection.
- The full Node.js 24 repository check passes, including build, lint, type
  checking, package tests, initializer checks, and 229 repository tests.
- The Changeset explicitly includes `@emseepea/testing` and all 11 public
  initializer packages that embed its generated development dependency.
- Independent cognitive-accessibility review passed for the exact decision,
  compendium entry, package guide, and release note.
- Commit, push, and release risk are each within the approved limit of 5 out
  of 25.

These are source and local checks. They do not prove exact-commit continuous
integration, publication, registry state, provenance, downloaded-package
behavior, or adopter production use.

## Current Base Boundary

Release pull request `109` merged as
`c972b8eefcec2b125ae3c7cd6426db26969dbc3c`. Quality run `35271966082` and
Release run `35272964832` passed for that base. This evidence does not cover the
planned release.

## Required Publication Evidence

- The Quality workflow must pass on the exact source commit.
- The Changesets release pull request must contain only generated version,
  lockfile, manifest, and changelog changes for the exact package set above.
- Quality and Release must pass on the exact version commit.
- Registry readback must confirm the version and `latest` tag, integrity,
  signature, provenance, and exact release-commit binding.
- The downloaded package must pass clean installation and verify the public
  command through its packed entry point.
- Adopter production use requires separate journey evidence.

## Evidence Boundaries

Exact-commit continuous integration proves only that the tested commit passed
its checks. Publication proves only that npm accepted a package version.
Registry readback proves what npm serves. Provenance proves the package's build
and source binding. Downloaded-package checks prove that a clean consumer can
install and use the registry artifact. Adopter production verification requires
its own direct evidence.

## Review Status, Not Release Status

This document records readiness. It does not claim publication, registry
verification, downloaded-package verification, or adopter production use.

- Result: PASS
- Source-readiness review: PASS
- Pipeline risk review: commit, push, and release are within the approved risk
  limit of 5 out of 25.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
