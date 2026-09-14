# Current Release Readiness

Date: 2026-09-14

Release verification is not complete. This review covers one planned
16-package batch. The server package contains the only feature change. Four
packages receive dependency-only updates. Eleven initializer packages receive
manifest-only updates.

## Planned Release Batch

- `@emseepea/server@0.11.2`
- `@emseepea/testing@0.11.2`
- `@emseepea/feedback@0.2.12`
- `@emseepea/react@0.2.2`
- `@emseepea/svelte@0.1.2`
- `@emseepea/create-tool-server@0.0.32`
- `@emseepea/create-api-backed-server@0.0.30`
- `@emseepea/create-openapi-backed-server@0.0.12`
- `@emseepea/create-resources-and-prompts-server@0.0.29`
- `@emseepea/create-progress-streaming-server@0.0.30`
- `@emseepea/create-html-ui-server@0.0.31`
- `@emseepea/create-react-ui-server@0.0.30`
- `@emseepea/create-multi-instance-postgres-server@0.0.20`
- `@emseepea/create-database-schema-server@0.0.17`
- `@emseepea/create-mongodb-backed-server@0.0.17`
- `@emseepea/create-soap-backed-server@0.0.17`

The server package adds bounded request-scoped progress for static resources,
resource templates, and prompts. The other four packages update their server
dependency and add no separate feature. Each initializer package updates its
embedded manifest to use `@emseepea/server@0.11.2`. These releases add no
separate initializer feature. This batch does not add or expand deprecated
client logging or any other deprecated functionality.

## Resource and Prompt Progress

When a request using Model Context Protocol (MCP) version 2026-07-28 supplies a
progress token, resource and prompt handlers receive an optional
`reportProgress` operation. Progress uses only that request's token and finishes
before its terminal result. Existing event-count, event-size, authentication,
authorization, deadline, cancellation, result-validation, and safe-error
controls remain in force. Legacy handlers, direct and mapped tools, and
completion handlers do not gain this operation.

## Evidence So Far

- Architecture Decision Record (ADR) 0087 was explicitly ratified. Final
  architecture and Jobs To Be Done reviews passed.
- Source build, typecheck, lint, decision, documentation, modern and legacy
  black-box, packed-public-package, and benchmark checks passed locally.
- Behavioral tests cover official-client and raw HTTP progress, token
  isolation, fresh input-required rounds, authorization before execution, event
  limits, late reporting, terminal ordering, and the legacy boundary.
- The full local suite passed 221 of 224 Docker-independent tests before the
  final legacy guard. The affected modern and legacy tests passed after that
  guard. Three existing PostgreSQL and MongoDB fixtures, plus the
  all-initializer packed journey, could not run because the local Docker daemon
  was unavailable.
- Independent architecture, JTBD, cognitive-accessibility, Markdown
  accessibility, voice and tone, and test-quality reviews passed.
- Pipeline risk is 5 out of 25 for commit, push, and release.

These are source and local checks. They do not prove exact-commit continuous
integration, publication, registry state, provenance, downloaded-package
behavior, exact-host qualification, or production use by an adopter.

## Current Base Boundary

Release pull request `88` merged as `51a67c03`. Quality run `34810098699`
passed for that merge. Release run `34810729547` then passed its publication,
registry, provenance, and downloaded-package checks for the base batch. That
evidence does not cover this planned batch.

## Required Publication Evidence

- The Quality workflow must pass on the exact combined source commit.
- The Changesets release pull request must contain only the planned generated
  version, dependency, lockfile, and changelog changes for this batch.
- The Quality and Release workflows must pass on the exact version commit.
- Registry readback must confirm every planned version and `latest` tag,
  integrity, signature, provenance, and exact release-commit binding.
- Every registry package must pass its applicable downloaded clean-install and
  public-entry-point checks.
- Every initializer package must install with its manifest rewritten to the
  exact `@emseepea/server@0.11.2` dependency and pass its applicable checks.
- The downloaded server package must verify resource and prompt progress,
  current-request token isolation, fresh input-required rounds, limit
  enforcement, terminal ordering, protected authorization, and legacy
  exclusion through its public entry point.
- Production use by an adopter requires separate, cited journey evidence.

## Evidence Boundaries

Each release stage requires separate evidence. Exact-commit continuous
integration proves that the tested commit passed its checks. Publication proves
that npm accepted a package version. Registry readback proves what npm serves.
Provenance proves the package's build and source binding. Downloaded-package
checks prove that a clean consumer can install and use the registry artifact.
Exact-host qualification and adopter production verification require their own
direct evidence. Evidence from one stage does not prove any other stage.

## Review Status, Not Release Status

This document records readiness. It does not claim that publication, registry
verification, downloaded-package verification, exact-host qualification, or
adopter production verification is complete unless the corresponding evidence
appears above.

- Result: PASS
- Pipeline risk review: commit, push, and release are within the approved risk
  limit of 5 out of 25.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
