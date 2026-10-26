# Request tracing release evidence

Date: 2026-10-26. Result: **RELEASED AND VERIFIED**.

`@emseepea/server@0.25.1` is available on npm `latest`. This meets the
[confirmed outcome #186](https://github.com/emseepea/emseepea/issues/186)
before Wednesday afternoon, 28 October 2026, Australia/Sydney.

## Exact release chain

| Stage | Revision | Successful evidence |
| --- | --- | --- |
| Qualified source | `1629f6de87c136c2a365d6455f51897849d52d3a` | Clean-commit `push:qualify`; [Quality 40277031698](https://github.com/emseepea/emseepea/actions/runs/40277031698) |
| Frozen candidate | `00115f2f6d0c3e03ecadef6d41cf4cd0daf019fc` | Generated-tree check; [Release 40278404285](https://github.com/emseepea/emseepea/actions/runs/40278404285) |
| Generated prose review | `80ab2a6409f58d955adf79854bff975d77b8d516` | [Quality 40279414463](https://github.com/emseepea/emseepea/actions/runs/40279414463) |
| Promotion merge | `2618236fc32a30387c331996fdd43051cc952e99` | [PR #191](https://github.com/emseepea/emseepea/pull/191); [Publish 40281071900](https://github.com/emseepea/emseepea/actions/runs/40281071900) |
| Merge-back to main | `1d3ee7a33c7c9793406ed25d4121ef4c382f626d` | [Quality 40281448764](https://github.com/emseepea/emseepea/actions/runs/40281448764) |

The candidate origin binds the qualified source and its exact Quality run.
Release passed credentialed semantic evaluation, publication under `next`,
registry integrity/provenance and downloaded-package checks. Publish promoted
all 16 planned packages to `latest`, verified their tags, recorded releases,
and qualified the exact merge-back. Website deployment was skipped because
this release contains no website publication.

The first source attempt, Quality 40274201434, failed the existing vulnerability
gate for Zod 4.4.3. The released source pins Zod 4.6.6 and passed the unchanged
eligibility policy. That failed attempt is diagnostic history, not acceptance
evidence. The same repair includes shared span/event timestamps after a timing
check failed under load. No timing assertion or release gate was weakened.

## Fresh installed-package proof

A new temporary project outside the repository installed the registry package
and OpenTelemetry SDK dependencies. The installed README example ran verbatim,
made a real HTTP request and returned HTTP 200. Registry `latest` resolved to
version `0.25.1` with candidate gitHead
`00115f2f6d0c3e03ecadef6d41cf4cd0daf019fc`.

Registry integrity:
`sha512-XIbQduCqPEHfbVK/ahtWZURMxZwzxQu361gpF0kml/nFRayffQ6MYo8+HkVddL8nuq63yNajVnLY78AufGgI9A==`.

Both exported spans used trace ID `1234567890abcdef1234567890abcdef`:

| Span | Span ID | Parent span ID |
| --- | --- | --- |
| `mcp.request` | `ebec49cdb5246765` | incoming `1234567890abcdef` |
| `backend.read` | `a46b3df5ec2e39fa` | request `ebec49cdb5246765` |

Flush and graceful shutdown passed. The check used a synthetic backend and
console exporter. It establishes installed-package request continuity and
backend-child tracing, not operation of a production telemetry service.

The temporary receipt and logs were captured as
`/tmp/emseepea-tracing-installed-receipt.json`,
`/tmp/emseepea-tracing-installed-check.log` and
`/tmp/emseepea-tracing-installed-guide.log`. The observed results are retained
above so the evidence does not depend on those temporary files surviving.

## Released package set

Server 0.25.1, all eleven starters 0.1.26, feedback 0.11.1, React 0.4.12,
Svelte 0.2.12 and testing 0.26.4 were promoted together. Versions came from
Changesets. The [server release record](https://github.com/emseepea/emseepea/releases/tag/%40emseepea/server%400.25.1)
and [current readiness](current-release-readiness.md) identify the public result.

The full local suite passed all workspace/example checks and 463 final tests
on Node 24.22.1/npm 12.0.2. All 23 focused tracing/schema checks and fresh-build
benchmarks passed, including the adapter profile and three production
populations. Source and merge-back CI also passed Node 22/24, vulnerability,
standalone initializer, documentation and website checks.
