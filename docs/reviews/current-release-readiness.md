# Current Release Readiness

Date: 2026-09-11

## Release Batch

- `@emseepea/server@0.10.0`
- `@emseepea/feedback@0.2.6`
- `@emseepea/react@0.0.19`
- `@emseepea/testing@0.9.9`
- `@emseepea/create-api-backed-server@0.0.23`
- `@emseepea/create-database-schema-server@0.0.10`
- `@emseepea/create-html-ui-server@0.0.24`
- `@emseepea/create-mongodb-backed-server@0.0.10`
- `@emseepea/create-multi-instance-postgres-server@0.0.13`
- `@emseepea/create-openapi-backed-server@0.0.5`
- `@emseepea/create-progress-streaming-server@0.0.23`
- `@emseepea/create-react-ui-server@0.0.23`
- `@emseepea/create-resources-and-prompts-server@0.0.22`
- `@emseepea/create-soap-backed-server@0.0.10`
- `@emseepea/create-tool-server@0.0.25`

Initializer patches publish new artifacts that use the server in this batch.

## Change for Users

Applications can enable `clientRoots` and ask a client for its workspace roots
through the existing MCP 2026-07-28 `input_required` flow. Direct tools,
resources, resource templates, and prompts use `inputRequired.roots()` and
`rootsResponse`.

The framework checks roots before invoking the continuation handler. The
handler selects the expected reply key. Root count defaults to 100 and can be
configured; the existing request-size limit bounds all roots data. Returned
roots are immutable and grant no file access or permissions. The framework
never opens their paths or automatically logs them.

## Verified Local Evidence

- Server build, TypeScript checks, and lint pass.
- All seven roots tests pass, covering public and protected official-client
  journeys for each direct handler, malformed inputs, count and byte limits,
  client capability declarations, safe accessor behavior, and authorization
  on every round.
- Roots tests prove timeout and cancellation behavior, legacy exclusion, and
  continuation after the original process exits and a new process starts.
- The eight existing client-input tests and the legacy protocol test pass.
- The installed-package smoke script completes a roots round through the
  official client using the local workspace build.
- Independent architecture review passed and independently ran the roots tests.
- Independent cognitive-accessibility review passed for the roots public copy.

These local results do not prove the published npm package or full protocol
conformance. Broader Quality, packed initializers, container checks, performance,
semantic evaluation, and registry checks remain publication gates.

The full local suite could not finish because Docker was unresponsive during
PostgreSQL example setup. Container qualification remains required in CI.

## Required Publication Evidence

- Quality must pass on the publishing commit: supported Node.js versions,
  dependency scanning, package and documentation tests, accessibility,
  performance, and all eleven standalone initializer/container checks.
- The existing JSON performance budgets remain unchanged. They do not establish
  a throughput claim for roots continuations.
- Release must pass the maintained semantic examples before publication.
- Registry verification must check package versions, integrity, provenance,
  signatures, clean installation, and the roots smoke round trip.
- Registry initializer checks must exercise the actual downloaded packages and
  their container qualification.
- Website deployment may be claimed only after its publication job succeeds.

## Review Status

- Result: PASS
- Pipeline risk review: commit, push, and release scored 5/25, within the 5/25 appetite.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
