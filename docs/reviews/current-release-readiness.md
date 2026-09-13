# Current Release Readiness

Date: 2026-09-13

Release verification is not complete. This review covers one planned
16-package batch. The batch contains two packages with feature changes, three
packages with dependency-only updates, and eleven initializer packages with
manifest-only dependency updates.

## Planned Release Batch

- `@emseepea/server@0.11.1`
- `@emseepea/testing@0.11.0`
- `@emseepea/feedback@0.2.11`
- `@emseepea/react@0.2.1`
- `@emseepea/svelte@0.1.1`
- `@emseepea/create-tool-server@0.0.31`
- `@emseepea/create-api-backed-server@0.0.29`
- `@emseepea/create-openapi-backed-server@0.0.11`
- `@emseepea/create-resources-and-prompts-server@0.0.28`
- `@emseepea/create-progress-streaming-server@0.0.29`
- `@emseepea/create-html-ui-server@0.0.30`
- `@emseepea/create-react-ui-server@0.0.29`
- `@emseepea/create-multi-instance-postgres-server@0.0.19`
- `@emseepea/create-database-schema-server@0.0.16`
- `@emseepea/create-mongodb-backed-server@0.0.16`
- `@emseepea/create-soap-backed-server@0.0.16`

The server package contains the validated multi-content resource-read change.
The testing package contains the independently governed runner-neutral cleanup
change and also receives the updated server dependency. The feedback, React,
and Svelte packages update dependency versions and add no separate feature.
Each initializer package updates its manifest to use
`@emseepea/server@0.11.1`. These releases add no separate initializer feature.

## Multi-Content Resource Reads

The server package allows one authorized resource read to return several
validated text or binary items. A returned item URI may differ from the
requested URI. Returning it does not, by itself, register a resource or give a
client permission to read it. A client may still read the URI if it separately
identifies an already registered static resource or matches an already
registered resource template, and the client satisfies that capability's
access policy. Cache instructions apply to the complete response.

## Runner-Neutral Server Cleanup

Model Context Protocol (MCP) developers can start an Em See Pea server or
child-process server without a test context and close it explicitly in Vitest,
Jest, another runner, or a plain script. Existing `{ after }` cleanup remains
available and registers the same public `close()` operation automatically.

## Evidence So Far

- Architecture Decision Record (ADR) 0085 was ratified. Independent
  architecture, voice and tone, cognitive-accessibility, and Markdown
  accessibility reviews passed for its exact public source content.
- Focused source, package, black-box, legacy-protocol, cache, malformed-input,
  documentation, and packed-package checks passed locally for the validated
  multi-content resource-read change.
- The JSON boundary benchmark's multi-content resource profile passed the
  existing throughput, CPU, allocation, framework-added-byte, malformed-input
  retained-heap, and handler-isolation limits with and without observability.
- Confirmed Jobs To Be Done (JTBD) records `JTBD-001` and `JTBD-100` align
  explicit lifetime ownership with tests through the real public boundary. No
  new ADR or job is needed.
- Independent architecture, JTBD, cognitive-accessibility, and source reviews
  passed for the runner-neutral cleanup increment and public guidance.
- The complete `@emseepea/testing` package suite passed locally before the
  rebase: 20 tests, including the host simulator, explicit and automatic
  cleanup, repeated and concurrent close, port refusal after close, and
  failure-path cleanup.
- Combined post-rebase local qualification passed, and pipeline risk is 5 out
  of 25 for commit, push, and release.

These are source and local checks. They do not prove exact-commit continuous
integration, publication, registry state, provenance, downloaded-package
behavior, exact-host qualification (running the journey in a named adopter
host), or production use by an adopter.

## Prior Cumulative Release Boundary

The preceding cumulative release published `@emseepea/testing@0.10.0`,
`@emseepea/react@0.2.0`, `@emseepea/create-react-ui-server@0.0.28`, and ten
initializer patch releases. Quality runs `34745003015` and `34745474030`
passed, and release run `34745860395` completed publication, registry checks,
and downloaded-package verification for merge `dcd1829b`. That evidence covers
the host simulator and React theme helper. It does not cover either pending
feature in this batch.

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
  exact `@emseepea/server@0.11.1` dependency and pass its applicable checks.
- The downloaded server package must pass static and template multi-content
  resource reads through its public entry point.
- The downloaded testing package must expose the public server starters and
  return handles whose `close()` operation passes clean-install lifecycle and
  failure-path cleanup journeys.
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
