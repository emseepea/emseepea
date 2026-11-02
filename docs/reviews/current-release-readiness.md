# Current Release Readiness

Date: 2026-11-02

## Semantic judge context and supported dependency repair

Status: **PUBLISHED**. All sixteen versions listed below are available under
npm's `latest` tag. VODER's installed-package checks and advisory Actions
evaluation passed. Native ChatGPT and customer-production journeys remain
unverified.

Candidate `50aec36542f859e57d939c5a84c257baf22d18e6` passed
[Release qualification 41273836953](https://github.com/emseepea/emseepea/actions/runs/41273836953).
[Publication 41275324476](https://github.com/emseepea/emseepea/actions/runs/41275324476)
promoted the qualified package bytes and recorded the releases.
[Merge-back Quality 41275579037](https://github.com/emseepea/emseepea/actions/runs/41275579037)
passed for `c1f89217e751cdd96ad4408145ff5c8e8add5a91`. The website publication
job was skipped.

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

## Published packages

The existing Changesets planner selected sixteen public packages. The server
and testing packages had direct patch changesets. All eleven starters shipped
their updated starter dependencies. Feedback, React and Svelte received
automatic patches for their exact server dependency. Registry post-reads
confirmed these exact versions, candidate revision and artifact integrity.

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

The candidate's thirteen retained Claude evidence files contain 22 passing
cases, 66 answer trials, and 207 judgments across 23 meaning assertions.
Each case ran three answer trials; each meaning assertion retained nine
judgments. Semantic retries were zero. All 66 trials retained server context.
This is Claude qualification, not native ChatGPT certification.

The release workflow verified downloaded package contracts, initializers,
signatures and provenance. The CI registry verifier rejected a local
invocation at its required Actions publish-ref check, before verification.
Separate local read-only post-reads confirmed all sixteen `latest` tags,
candidate revisions, integrities and attestation bindings against the
qualified registry artifact. Cryptographic provenance verification came from
the successful release workflow.

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

## Publication reviews and adopter verification

Architecture, jobs-to-be-done, changeset risk and voice reviews passed for
this metadata preparation. Independent cognitive-accessibility review passed
for the complete publication copy. The cumulative preparation risk assessment
rated commit, push and release preparation at 5/25 each, within appetite.
The separate exact-candidate promotion assessment also rated residual risk
at 5/25, within appetite. The guarded release watcher completed successfully
after candidate qualification, installed-package checks, registry promotion
and exact merge-back qualification. The published preparation snapshot remains
available at the candidate revision.

VODER adopted testing 0.26.13 in commit
`0641f6cddfb9356dd909ceae05e659b226d48c37`.
[VODER Actions advisory job (repository access required)](https://github.com/voder-ai/voder-mcp-hub/actions/runs/41368040746/job/125032399432)
passed on 2026-11-02. This is separate from the upstream release qualification.

Ordinary `npm ci` with Node 24.22.1 and npm 12.0.2, the TypeScript build and
all eight existing Actions fixture tests passed. All 382 existing production
lock entries remained unchanged. Direct module resolution kept Actions on
server 0.22.0 and core on 0.20.0; server 0.25.10 stayed in testing's development
dependency closure.

The retained advisory evidence passed all fifteen cases, including the four
read-handoff cases: 45 trials, 90 answer turns, 45 server contexts and 270
passing judgments across 30 meaning assertions. Each assertion kept three
answer trials and nine judgments, with zero semantic retries. All six answers
to the two accounting-read requests used the exact URL advertised by the server.

The conversation evaluation took 411.115 seconds; the complete advisory job
took 478 seconds. The retained evidence has no token usage or measured cost,
so the measured-cost promotion condition remains unsatisfied. This run cannot count toward promotion
under that contract. No gate was promoted.

VODER's earlier testing 0.20.4 used an internal native-answer tool-call cap
that current upstream removed under ADR-0116. The existing VODER selection
assertions, twenty-minute job timeout, advisory status and measured-cost
promotion contract remain unchanged.

Passing selection assertions do not
constrain execution cost. This Claude/framework result does not establish
native ChatGPT or customer-production behavior.

Prior release records remain available in this file's Git history.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
