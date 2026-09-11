# Current Release Readiness

Date: 2026-09-11

## Release Batch

- `@emseepea/server@0.9.0`

## Change for Users

Applications can opt into deprecated MCP 2026-07-28 request-scoped client log
messages. Direct tool, streaming tool, resource, resource-template, and prompt
handlers receive a bounded `reportLog` function. The calling client must request
a log level on that operation, and the installed MCP SDK applies the severity
threshold.

Protected calls authenticate and authorize before application work or response
streaming. Logging is not advertised when disabled or on legacy requests. The
removed `logging/setLevel` method remains unavailable.

This release adds no sessions, persistence, replay, reconnect recovery, retry
logic, or circuit breaker. Client-visible messages remain separate from
framework observability, and the framework does not copy sensitive request or
result data into them.

## Local Evidence Before Publication

- Tom Howard ratified ADR-0075. Its human-oversight marker is confirmed and the
  decision compendium is current.
- Focused raw HTTP, official-client, type, authentication, authorization,
  isolation, cancellation, limit, late-call, and installed-package checks pass.
- The local Node.js 24 logging load check completed eight batches of sixteen
  concurrent requests with paused readers. Peak RSS was 217,595,904 bytes and
  retained heap stayed below its 24 MiB ceiling. This is measured qualification
  evidence, not conformance to the separate JSON-boundary performance budget.
- Independent architecture, Markdown accessibility, cognitive accessibility,
  and release-risk reviews are required on the final content.

## Required Publication Evidence

- Exact-commit Quality must pass Node.js 22 and 24, including the request-logging
  load check with paused readers.
- The release job must pass the existing publication gates before npm publish.
- npm publication must use Trusted Publishing and expose provenance, registry
  metadata, clean installation, software bills of materials, and package
  evidence.
- The registry-installed server smoke test must deliver one request-scoped log
  through the official client and return the checked final result.

## Review Status

- Result: PASS
- Release verification: NOT COMPLETE until the exact registry, provenance,
  standalone, and remaining publication gates pass.
- Final result: within appetite, subject to the required exact-commit gates.
