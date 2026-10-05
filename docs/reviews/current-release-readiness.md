# Current Release Readiness

Date: 2026-10-05

## Collection-Aware Feedback Release

The planned release adds deployment-configured feedback collections,
fixed-destination submissions, protected operator retrieval, and owner-scoped
`feedback.submitted` events. The support backend remains authoritative.
Customer-facing MCPs submit customer feedback only. Internal MCPs submit
internal feedback and expose explicitly authorized monitoring and retrieval.

The implementation source `3633875c30344998c855c3d1dd0e27c77f4982e9` passed
Quality run `37272952379`. Clean qualification passed all package and example
checks and 344 root tests. Architecture, JTBD, voice, and cognitive reviews
passed the runtime slice; the final pipeline score was 5/25, within appetite.

Documentation preparation is subject to final content reviews, full checks,
exact source Quality, and release-build gates. This is conditional readiness,
not publication evidence.

## Exact Planned Package Set

Changesets calculates additive minor releases for server and feedback, patch
updates for dependent libraries and all eleven generated starters, and a
website patch. The npm set is:

- `@emseepea/server@0.22.0`
- `@emseepea/feedback@0.7.0`
- `@emseepea/react@0.4.5`
- `@emseepea/svelte@0.2.5`
- `@emseepea/testing@0.20.4`
- `@emseepea/create-tool-server@0.1.6`
- `@emseepea/create-api-backed-server@0.1.6`
- `@emseepea/create-openapi-backed-server@0.1.6`
- `@emseepea/create-resources-and-prompts-server@0.1.6`
- `@emseepea/create-progress-streaming-server@0.1.6`
- `@emseepea/create-html-ui-server@0.1.6`
- `@emseepea/create-react-ui-server@0.1.6`
- `@emseepea/create-multi-instance-postgres-server@0.1.6`
- `@emseepea/create-database-schema-server@0.1.6`
- `@emseepea/create-mongodb-backed-server@0.1.6`
- `@emseepea/create-soap-backed-server@0.1.6`

The planned website version is 0.0.8. It is deployed as a website artifact,
not published to npm. Tailwind and third-party dependencies are unchanged.

## Required Publication Evidence

Source Quality must pass for the documentation commit. The release pull request
must bind its exact versioned head to that source and pass its Release build.
Verify all planned packages under `next`, registry contents, signatures, and
provenance before governed promotion to `latest`.

The publish workflow must pass for the exact merge, including the measured
website artifact and merge back to trunk. Verify registry versions and source
heads and read the public feedback and MCP Events documentation after deploy.
Publication does not establish a native adopter or customer production journey.

## Earlier Publication Evidence

The earlier MCP Events package set remains immutable. Server 0.21.0 and feedback
0.5.3 passed source Quality `37172921662`, Release `37173472016` attempt 2 at
release pull request #137 head `b41dfbfbb2c756f434b09cff4ff98e06f99f8c02`, and
Publish `37174863657`. All sixteen packages were verified under npm `latest`;
server provenance bound that release head. This verifies publication, not a
live subscriber journey.

On 5 October 2026, registry readback reported server 0.21.1 and feedback 0.6.0
under `latest`. Those versions precede the collection-aware release planned
here. Historical synthetic ChatGPT Events evidence remains separate from a
native collection-aware feedback journey.

## Conditional Release Readiness

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Package and website publication verification: NOT COMPLETE.
