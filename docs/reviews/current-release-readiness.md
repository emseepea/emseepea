# Current Release Readiness

Date: 2026-09-18

Release verification is not complete. This review covers one planned
16-package batch. The server package contains the only feature change. Four
packages receive dependency-only updates. Eleven initializer packages receive
manifest-only updates.

## Planned Release Batch

- `@emseepea/server@0.14.0`
- `@emseepea/testing@0.14.1`
- `@emseepea/feedback@0.2.16`
- `@emseepea/react@0.3.2`
- `@emseepea/svelte@0.1.6`
- `@emseepea/create-tool-server@0.0.39`
- `@emseepea/create-api-backed-server@0.0.37`
- `@emseepea/create-openapi-backed-server@0.0.19`
- `@emseepea/create-resources-and-prompts-server@0.0.36`
- `@emseepea/create-progress-streaming-server@0.0.37`
- `@emseepea/create-html-ui-server@0.0.39`
- `@emseepea/create-react-ui-server@0.0.39`
- `@emseepea/create-multi-instance-postgres-server@0.0.27`
- `@emseepea/create-database-schema-server@0.0.24`
- `@emseepea/create-mongodb-backed-server@0.0.24`
- `@emseepea/create-soap-backed-server@0.0.24`

The server package adds privacy-bounded caller classification to its existing
redacted observability events. The other four packages update their server
dependency and add no separate feature. Each initializer package updates its
embedded manifest to use `@emseepea/server@0.14.0`. These releases add no
separate initializer feature.

## Privacy-Bounded Caller Classification

Applications may configure 1 to 16 non-overlapping `User-Agent` prefixes. Each
observability event then reports only the matching configured `callerClass` or
the fixed `_OTHER` fallback. OpenTelemetry uses the same value in
`emseepea.caller.class`.

Identifiers, prefixes, and the incoming `User-Agent` length have fixed bounds.
Invalid, duplicate, overlapping, or out-of-range configuration fails startup.
Missing, oversized, and unmatched values map to `_OTHER`. Raw headers, `User-Agent`
values, bodies, arguments, results, tokens, IP addresses, and unbounded client
strings never reach an observability adapter.

`User-Agent` classification is spoofable telemetry. It is not authenticated
identity and must not control authentication or authorization. When the option
is omitted, the event has no `callerClass` field and keeps its previous shape.

## Evidence So Far

- The architecture review confirmed that ADR-0065, Typed Operations with
  Framework-Redacted Observability Adapters, governs this additive field. No
  new decision is required.
- The Jobs To Be Done review confirmed alignment with JTBD-002, Add Optional
  Capabilities; JTBD-005, Migrate an Established MCP Server Safely; and
  JTBD-006, Evolve a Published MCP Contract Safely. No new job is required.
- The complete Node.js 24 local suite passed after Docker-backed PostgreSQL and
  MongoDB fixtures were made available. The root black-box and documentation
  phase passed 229 tests.
- Behavioral tests cover configured, spoofed, missing, oversized, unmatched,
  invalid, duplicate, and overlapping values. They verify `_OTHER`, raw-value
  exclusion, unchanged unconfigured events, and the OpenTelemetry attribute.
- Two consecutive benchmark suites passed with the OpenTelemetry adapter, no
  exporter, 16 configured caller classes, and worst-case last-prefix matching.
- Build, typecheck, lint, decision-compendium, initializer, packed-package,
  browser, documentation, and database-backed checks passed locally.

These are source and local checks. They do not prove exact-commit continuous
integration, publication, registry state, provenance, downloaded-package
behavior, exact-host qualification, or production use by an adopter.

## Current Base Boundary

Release pull request `107` merged as `7457b526a3a53256a2d64274f1d3b6eb423cb71c`.
Quality run `35227022361` passed for that merge. Release run `35228142605`
passed on attempt 2 for the base batch. That evidence does not cover this
planned release.

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
  exact `@emseepea/server@0.14.0` dependency and pass its applicable checks.
- The downloaded server package must verify bounded caller classification,
  `_OTHER` fallbacks, unconfigured compatibility, OpenTelemetry output, and
  raw-value exclusion through its public entry point.
- Production use by the cited adopter requires separate journey evidence.

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
- Source-readiness review: PASS
- Pipeline risk review: commit, push, and release are within the approved risk
  limit of 5 out of 25.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
