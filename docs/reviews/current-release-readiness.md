# Current Release Readiness

Date: 2026-09-15

Release verification is not complete. This review covers one planned
16-package batch. The server package contains the only feature change. Four
packages receive dependency-only updates. Eleven initializer packages receive
manifest-only updates.

## Planned Release Batch

- `@emseepea/server@0.12.0`
- `@emseepea/testing@0.11.3`
- `@emseepea/feedback@0.2.13`
- `@emseepea/react@0.2.3`
- `@emseepea/svelte@0.1.3`
- `@emseepea/create-tool-server@0.0.33`
- `@emseepea/create-api-backed-server@0.0.31`
- `@emseepea/create-openapi-backed-server@0.0.13`
- `@emseepea/create-resources-and-prompts-server@0.0.30`
- `@emseepea/create-progress-streaming-server@0.0.31`
- `@emseepea/create-html-ui-server@0.0.32`
- `@emseepea/create-react-ui-server@0.0.31`
- `@emseepea/create-multi-instance-postgres-server@0.0.21`
- `@emseepea/create-database-schema-server@0.0.18`
- `@emseepea/create-mongodb-backed-server@0.0.18`
- `@emseepea/create-soap-backed-server@0.0.18`

The server package adds bounded protocol outcomes to its existing redacted
observability events. The other four packages update their server dependency
and add no separate feature. Each initializer package updates its embedded
manifest to use `@emseepea/server@0.12.0`. These releases add no separate
initializer feature.

## Bounded Protocol Outcomes

Each redacted observability event now reports a bounded `protocolOutcome` of
`success`, `tool_error`, `protocol_error`, or `disconnected`. Existing
transport `outcome` remains separate and compatible. The framework classifies
the value at known execution boundaries for JSON and Server-Sent Events (SSE).
It does not inspect serialized response bodies or expose request arguments,
results, headers, tokens, or raw errors. OpenTelemetry records the bounded value
as `emseepea.protocol.outcome`.

## Evidence So Far

- Confirmed ADR 0065 already governs this additive redacted observability
  contract. Final architecture and Jobs To Be Done reviews passed, and no new
  decision or job was required.
- Source build, typecheck, lint, decision, documentation, modern and legacy
  black-box, packed-public-package, and benchmark checks passed locally.
- Behavioral tests cover all four outcomes, JSON and SSE paths, the distinct
  transport outcome, OpenTelemetry attributes, event-size bounds, and leakage
  canaries.
- The complete local suite passed 226 of 226 tests, including PostgreSQL and
  MongoDB fixtures after the local Docker daemon was started.
- Two consecutive observability-enabled benchmark suites passed the throughput,
  CPU, allocation, event-size, and retained-heap limits.
- Independent architecture, JTBD, cognitive-accessibility, Markdown
  accessibility, and voice and tone reviews passed.
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
  exact `@emseepea/server@0.12.0` dependency and pass its applicable checks.
- The downloaded server package must verify bounded protocol outcomes through
  JSON and SSE, preserve the distinct transport outcome, emit the separate
  OpenTelemetry attribute, and retain the redaction and event-size boundaries.
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
