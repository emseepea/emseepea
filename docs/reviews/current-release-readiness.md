# Current Release Readiness

Date: 2026-10-09

## Native semantic conversations without a call-count ceiling

Issue #150 removes the three-call rejection from Claude and Codex native
semantic parsers. Tom Howard explicitly directed removal instead of the
previous draft's configurable budget. ADR-0116 records confirmed oversight.
No new public option or replacement call-count ceiling is introduced.

The first candidate retained Claude's four-turn flag and added a four-turn
parser check. That parser check rejected all three live four-read trials
with `model command exceeded its turn limit`.
This candidate removes that native flag and the parser turn-count ceiling,
while retaining positive-integer evidence validation. Claude settings record
`maxTurns: null` and the unchanged `judgeMaxTurns: 4`.

Existing per-send timeouts, output checks, cancellation, model, isolation,
advertised-tool, and result checks remain effective. Judge calls still forbid
tools and keep their prior execution limit. Exact application assertions,
three answer trials, and independent meaning judgments remain required.

## Planned package set

- `@emseepea/testing@0.22.0`
- `@emseepea/create-api-backed-server@0.1.11`
- `@emseepea/create-database-schema-server@0.1.11`
- `@emseepea/create-html-ui-server@0.1.11`
- `@emseepea/create-mongodb-backed-server@0.1.11`
- `@emseepea/create-multi-instance-postgres-server@0.1.11`
- `@emseepea/create-openapi-backed-server@0.1.11`
- `@emseepea/create-progress-streaming-server@0.1.11`
- `@emseepea/create-react-ui-server@0.1.11`
- `@emseepea/create-resources-and-prompts-server@0.1.11`
- `@emseepea/create-soap-backed-server@0.1.11`
- `@emseepea/create-tool-server@0.1.11`

All eleven initializer patches update their testing dependency pins. The private
website moves to 0.0.11 to publish the guidance. Server, feedback, and UI packages
have no planned version change.

## Architecture and jobs to be done

ADR-0116 supersedes its unratified configurable-budget draft and supplements
ADR-0057's native conversation boundary. JTBD-003 covers proving that an AI
understands application results; JTBD-101 covers checked publication. No new
job, persona, or application execution boundary is introduced.

## Required checks and residual risk

Parser regression checks accept forty advertised calls through both providers
and retain all results and hashed protocol evidence. Claude checks also cover
parallel calls, longer native journeys, invalid turn counts, and missing
results. Existing negative checks retain forbidden-tool, authentication, model, and session rules.
Invocation tests ensure the native turn flag is absent and the judge flag
remains. A new live native timetable journey requires exactly four real MCP
reads and
correct route-to-time associations in all three trials. Its synthetic evidence
is uploaded with the existing release evidence. The failed first candidate
is retained at Release run 37922640488. It is not
retried; the next candidate fixed the native invocation. All three trials
then completed four reads and passed all nine meaning judgments, but that
candidate failed required selection-evidence registration at teardown
(Release run 37926188016). This candidate adds the public `assertToolNames`
assertion and retains the exact argument checks. Neither failed candidate is
retried, and application acceptance assertions are not weakened.

Full exact-commit qualification, Node.js 22 and 24 Source Quality, vulnerability
scanning, initializer qualification, and existing performance budgets must pass.
Release must pass semantic checks and registry integrity, signatures, provenance,
and fresh installs. Publish must verify latest and deploy the guide.

Residual risk: a provider may make more calls within existing execution limits.
Parser count rejection was post-execution and did not protect against effects.
Use isolated synthetic applications for qualification. Timeouts and provider
context/output limits remain; this release does not promise unlimited
execution. Residual risk is within the Low appetite, conditional on all gates.

## Conditional release readiness

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Publication status: NOT READY until full exact-commit qualification,
  Source Quality, Release, and Publish pass.
