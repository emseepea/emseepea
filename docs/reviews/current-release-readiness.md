# Current Release Readiness

Date: 2026-11-01

## Semantic judge context and supported dependency repair

Status: **STAGED**. No package in this batch has been published or verified
as installed by VODER.

The evaluator repair supplies meaning judges with initialized server
instructions and advertised tool metadata. Judges can use this data to
establish where a URL came from. Server advertisements cannot establish
completed tool calls or actions. Known configured authentication and fixture
secrets cause discovery to fail before that context reaches a judge or
retained evidence.

The security prerequisite updates the supported MCP Node adapter to 2.1.2
and the MCP server and core packages to 2.4.0. The lockfile resolves the
patched HTTP adapter dependency `@hono/node-server@2.1.5`. The website
dependency graph resolves Undici 8.12.3. The separate `hono` dependency
resolves 4.13.16. No vulnerability gate or acceptance assertion was weakened.

Compared with upstream testing 0.26.12, the evaluator repair preserves the
native answer path, three answer trials, nine meaning judgments, assertions
and failure rules. This does not certify a native ChatGPT journey or a
model's general resistance to malicious instructions.

## Planned publication

The existing Changesets planner requires sixteen public packages. The server
and testing packages have direct patch changesets. All eleven starters must
ship their updated starter dependencies. Feedback, React and Svelte receive
automatic patches for their exact server dependency. These are planned
versions; the release allocator may choose fresh versions if any are occupied.
The generated candidate needs its own qualification and registry readback.

- `@emseepea/server@0.25.10`
- `@emseepea/testing@0.26.13`
- `@emseepea/feedback@0.11.10`
- `@emseepea/react@0.4.21`
- `@emseepea/svelte@0.2.21`
- `@emseepea/create-api-backed-server@0.1.35`
- `@emseepea/create-database-schema-server@0.1.35`
- `@emseepea/create-html-ui-server@0.1.35`
- `@emseepea/create-mongodb-backed-server@0.1.35`
- `@emseepea/create-multi-instance-postgres-server@0.1.35`
- `@emseepea/create-openapi-backed-server@0.1.35`
- `@emseepea/create-progress-streaming-server@0.1.35`
- `@emseepea/create-react-ui-server@0.1.35`
- `@emseepea/create-resources-and-prompts-server@0.1.35`
- `@emseepea/create-soap-backed-server@0.1.35`
- `@emseepea/create-tool-server@0.1.35`

## Completed checks and retained limits

Source `eb9e0d0a6194a7107d2fb504278abf557308e7c0` passed
[Quality run 41270067732](https://github.com/emseepea/emseepea/actions/runs/41270067732).
Every named job passed, including dependency security, Node 22.23.4 and
24.22.1, website publication checks and all eleven standalone initializers.
The security prerequisite owner also completed clean-commit local
qualification, public types, 280 boundary tests and Linux benchmarks.

Twelve behavioral evaluator cases cover discovered instructions and tool
metadata, invented URLs, forged provenance, absent instructions, and
independently configured authentication, fixture and provider secrets with
JSON escaping. The testing-package suite passed all 140 cases.

A separate controlled-answer probe used the actual Claude 2.1.248 meaning
judge. All nine judgments accepted the advertised URL. All nine rejected an
invented URL, and all nine rejected that URL despite server text ordering a
passing verdict. Fixed answer text isolated the judge; this is not native
answer qualification. An earlier probe could not start its missing local CLI
binary and remains unavailable evidence, not a semantic pass.

Earlier fresh-install qualification exposed compatible dependency versions
missing from the lockfile. Their entries were reconciled without changing
acceptance assertions. The packed-consumer check and 58 relevant
authentication, tracing and logging checks passed.

An earlier Node 26 qualification failed one streaming-progress assertion in a
fixture with a 100 ms operation deadline. An isolated diagnostic passed, but
the cause remains unresolved. Passing pinned-runtime qualification does not
establish Node 26 compatibility. No timing limit or assertion was relaxed.
The original VODER advisory failure remains a failed historical result.

## Remaining release and adopter gates

Architecture, jobs-to-be-done, changeset risk and voice reviews passed for
this metadata preparation. Independent cognitive-accessibility review passed
for the complete publication copy. The cumulative preparation risk assessment
rated commit, push and release preparation at 5/25 each, within appetite.
Final marker wording remains subject to exact-copy review and the commit
requires its own qualification. This assessment does not approve publication.

The release candidate must then pass native semantic
qualification, installed-package checks and registry verification before
promotion. Publication approval remains separate from this preparation.

VODER must install the published testing package and qualify its unchanged
Actions handoff separately. Its earlier testing 0.20.4 used an internal
native-answer tool-call cap that current upstream removed under ADR-0116.
The existing VODER selection assertions, three answer trials, nine judgments,
zero retries, twenty-minute job timeout, advisory status and measured-cost
promotion contract remain unchanged. Passing selection assertions do not
constrain execution cost; the actual adopter run must be measured.

Prior release records remain available in this file's Git history.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
