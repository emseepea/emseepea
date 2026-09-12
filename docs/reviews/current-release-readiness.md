# Current Release Readiness

Date: 2026-09-12

Release verification is not complete. The checked protocol-native tool-result
increment still requires exact-commit quality, publication, registry readback,
and downloaded-package verification.

## Planned Release Batch

- `@emseepea/server@0.10.3`
- `@emseepea/create-tool-server@0.0.28`
- `@emseepea/create-api-backed-server@0.0.26`
- `@emseepea/create-openapi-backed-server@0.0.8`
- `@emseepea/create-resources-and-prompts-server@0.0.25`
- `@emseepea/create-progress-streaming-server@0.0.26`
- `@emseepea/create-html-ui-server@0.0.27`
- `@emseepea/create-react-ui-server@0.0.26`
- `@emseepea/create-multi-instance-postgres-server@0.0.16`
- `@emseepea/create-database-schema-server@0.0.13`
- `@emseepea/create-mongodb-backed-server@0.0.13`
- `@emseepea/create-soap-backed-server@0.0.13`
- `@emseepea/feedback@0.2.9`
- `@emseepea/react@0.0.22`
- `@emseepea/testing@0.9.13`

## Change for Users

Existing `{ data, text? }` tool handlers remain supported. A handler may also
return a checked MCP `CallToolResult` through the exported
`ProtocolToolResult` type.

An `outputSchema` is optional for protocol-native results. Without one, tools
may return content-only results, deliberate application errors, client-visible
metadata, and any safely representable JSON structured content. With one, every
successful result must include matching structured content. Error results may
omit it.

The result boundary checks all five MCP content blocks, safe JSON, declared
output schemas, reserved metadata, and the existing whole-result byte limit.
Thrown, malformed, cancelled, and expired operations retain the generic
framework error. Resource links and embedded resources grant no access or
authorization.

The initializer patches keep their generated projects on the exact server
version. They add no separate feature.

The release planner also carries `@emseepea/feedback`, `@emseepea/react`, and
`@emseepea/testing` as dependent patch releases so exact first-party package
references remain aligned. They add no separate feature.

## Evidence So Far

- Tom Howard ratified ADR-0082 on 2026-09-12.
- Independent architecture review passed with the result-validation,
  metadata-ownership, and error-redaction constraints incorporated.
- Focused framework build, repository type checking, and the new raw HTTP and
  official-client black-box journey pass locally.
- A fresh installation from the packed local server tarball passed the existing
  convenience-result and new protocol-native result journeys.
- The local protocol-native result benchmarks passed with and without
  observability. Across both profiles, the worst results were 2,174 requests
  per second minimum throughput, 2.1036 ms p95 framework CPU, 83,328 bytes p95
  transient allocation, and 843 average framework-added wire bytes.
- `@emseepea/server@0.10.2` and its eleven initializer dependants were published
  from exact commit `af553f0a18918c142ac1bb21c97685bc7fcbc149`.
- Tests, CI publication, registry readback, and downloaded-package journeys for
  `0.10.2` remain distinct predecessor evidence and do not prove this increment.

## Required Publication Evidence

- The full quality workflow must pass on the exact source commit.
- The release workflow must publish every planned version from the exact
  version commit.
- Registry readback must confirm each version, integrity, provenance, signature,
  and source commit.
- A clean installation of `@emseepea/server@0.10.3` must exercise existing
  convenience results and checked protocol-native content-only, structured,
  deliberate-error, metadata, and rejection journeys.
- Downloaded initializer packages must install the exact server version and
  pass their documented checks and production-container journeys.

## Review Status, Not Release Status

This document records readiness only. No `0.10.3` publication or registry
verification claim is made until the required evidence exists.

- Result: PASS
- Pipeline risk review: commit, push, and release are within the approved risk
  limit of 5 out of 25.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
