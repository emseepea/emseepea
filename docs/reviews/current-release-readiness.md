# Current Release Readiness

Date: 2026-10-20

## Native Claude failure diagnostics

Status: **LOCAL FULL TEST PASS; RELEASE QUALIFICATION INCOMPLETE**.
The testing package now reports fixed failure categories for missing results,
provider execution errors, exhausted budgets, turn limits and non-text answers.
Unknown provider error subtypes use a fixed generic message. Provider payloads
are not copied into diagnostic errors. Existing authentication, model, tool and
evidence checks remain unchanged.

The new twelve-case regression test first passed five cases and failed seven
against the original parser. After the parser change, all 49 focused parser,
resource and evidence checks passed on Node.js 24.22.0. These use synthetic
fixtures, not actual model responses. Lint and whitespace checks also passed.

The normal local `npm test` command then exited unsuccessfully. Builds, type
checks and the preceding workspace tests passed, but the website stage recorded
15 passes and one cancellation: its page-by-page accessibility check exceeded
the existing 180-second timeout. The later root test stage did not run.

A separate timing diagnostic subsequently completed the same accessibility
matrix, assertions and screenshots in about 25 seconds without changing the
test source or timeout. This does not identify the cause of the original timeout
or replace the failed full-suite result. The first instrumented diagnostic had
a missing local binding and failed; the corrected diagnostic is separate.

A fresh exact-runtime run on 20 October 2026 used Node.js 24.22.0 and npm
12.0.2. `npm ci` completed, and the unchanged `npm test` command then exited
successfully. The website stage passed all 16 tests, including the accessibility
matrix in about 25 seconds, and the later root stage passed all 440 tests. This
successful rerun does not establish the cause of the earlier timeout. Release
qualification and publication evidence remain outstanding.

The earlier release failure still has no established cause. Its 66 failed
trial records contain a generic no-answer error, not recorded model answers
or judge verdicts. The diagnostic change improves future failure reporting;
it does not establish that authentication or release execution is repaired.

A patch Changeset covers `@emseepea/testing`; Changesets must calculate the
resulting package versions and dependent updates. No version is edited by hand.
Full qualification, benchmarks, exact-commit Quality, semantic release checks,
publication, registry verification and merge-back remain required. No new
publication is claimed here.

### Current planned publication

Changesets currently plans `@emseepea/testing` 0.26.1 and
`@emseepea/website` 0.0.12. `@emseepea/website` is private and is not published
to npm. The current public npm package list is:

- `@emseepea/testing@0.26.1`

## Optional Events store conformance helper

Status: **RISK REVIEWED; QUALIFICATION INCOMPLETE**. This increment adds
an opt-in testing helper for adopter-owned disposable synthetic fixtures. It
checks subscription writes, competing claims, stale lease fencing, retries,
and graceful reopen. Missing queue evidence is inconclusive, never a pass.

The helper does not establish crash recovery, cross-process coordination,
native client execution, or production readiness. The two-connection SQLite
fixture runs in one process. Framework serving code, benchmarks, dependency
lockfile, and release controls do not change.

At the time of this retained evidence, Changesets computed testing 0.26.0 and
eleven initializer patches to 0.1.21. The generated starters retained the
testing dependency, so they released together. No package version was changed
by hand. Architecture and jobs-to-be-done scope reviews passed; the public guide
and Changeset passed specialist prose review.

### Retained evidence and failures

The unchanged helper source passed its twelve focused tests. Its fresh packed
public consumer passed JavaScript execution and TypeScript checks. These are
bounded checks, not complete publication qualification.

On source base 4410d227, a fresh locked install succeeded. The full test command
then failed because MongoDB could not start. A disposable diagnostic reproduced
journal-directory disk exhaustion. After removing only generated dependencies
from a completed test copy, the unchanged MongoDB example passed 10 of 10.

The separately executed root test stage passed 439 of 440 checks. The packed
initializer journey failed to start PostgreSQL while free disk was zero.
Its wrapper removed the service logs, so the exact startup error is unavailable.
Neither command is recorded as a full pass. All failed results remain retained.

An earlier local benchmark on Node 24.19.0 failed the legacy JSON profile's
5 ms p95 process-CPU limit. Samples were not printed before the assertion.
No repeat, relaxed limit, waiver, regression claim, or environmental-cause
claim replaces that failure. Prescribed-profile qualification remains required.

### Risk review

The fresh read-only advisory review assessed cumulative commit, push, and
release risk at 5 of 25 each: impact 5 multiplied by likelihood 1. The highest
risk is an unsupported conformance claim. Bounded evidence, rejecting
inconclusive results, defective-store tests, and unchanged gates control it.

This is a risk-only PASS within appetite. Qualification remains incomplete.
The source candidate is based on 66dd31e0; the failed full-suite and root-stage
results above belong to earlier base 4410d227. They do not qualify this head.

The registered typed pipeline gate must independently bind the exact checkout
and change. This advisory record is not native gate evidence or authorization
to commit, push, or release.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.

### Retained earlier package set

| Package | Version |
| --- | --- |
| `@emseepea/testing` | `0.26.0` |
| `@emseepea/create-api-backed-server` | `0.1.21` |
| `@emseepea/create-database-schema-server` | `0.1.21` |
| `@emseepea/create-html-ui-server` | `0.1.21` |
| `@emseepea/create-mongodb-backed-server` | `0.1.21` |
| `@emseepea/create-multi-instance-postgres-server` | `0.1.21` |
| `@emseepea/create-openapi-backed-server` | `0.1.21` |
| `@emseepea/create-progress-streaming-server` | `0.1.21` |
| `@emseepea/create-react-ui-server` | `0.1.21` |
| `@emseepea/create-resources-and-prompts-server` | `0.1.21` |
| `@emseepea/create-soap-backed-server` | `0.1.21` |
| `@emseepea/create-tool-server` | `0.1.21` |

### Required delivery evidence

Monitor disk capacity before installation and during packed initializer tests;
the local partner currently reports about 3.4 GiB free. Preserve any failed or
incomplete result. Reclaim only owned generated test material if needed; do not
change tests or budgets to fit available capacity.

After the native typed review admits the exact change, complete clean committed-
head qualification through `npm run push:qualify -- --full` and the standard
`npm run push:watch`. Run the unchanged benchmark command and require exact-head
Quality on its prescribed Node 22 and 24 profiles. A prior failure is not a pass.

Publication also requires all packed initializer journeys, semantic checks,
the normal release pull request, registry integrity and provenance checks,
promotion, and merge-back qualification. No new publication is claimed here.

## Earlier initializer dependency repair

All eleven initializers are released as 0.1.20. Release run 38727625594 passed
on its same-run retry; Publish run 38733872240 passed, and merge-back Quality
38734343096 passed at main 4410d227. The local delivery partner independently
verified every npm latest tag and release gitHead. This completed repair does
not qualify the new helper batch.

## Earlier native resource evidence patch — 2026-10-14

Status: **READY FOR EXACT-COMMIT QUALIFICATION**. The planned testing 0.25.2
patch adds behavioral coverage and guidance that keep tool-returned resource
links distinct from observed native `resources/read` calls. Framework resource
semantics do not change.

Live acceptance used an authorized ChatGPT account and a disposable local HTTP
MCP through an HTTPS tunnel. Connection, synthetic attachment submission,
fresh-conversation retrieval, MCP App invocation, owner-isolation denial, and
in-flight cancellation produced correlated evidence. ChatGPT returned resource
links from the tool, then attempted `resources/read`, but did not materialize
the resources. Record this live resource slice as incomplete, not passed.

Focused testing-package checks passed 12 of 12. Documentation density, decision
compendium, exact-hash cognitive-accessibility review, and diff checks also
passed. Commit, push, and release residual risk are each 5 of 25 (Low).

The earlier review recorded PASS within appetite, subject to its exact-commit gates.

### Earlier package set

The earlier review covered `@emseepea/testing@0.25.2`.

This patch still requires full exact-head Quality, semantic and release checks,
publication, registry verification, and merge-back qualification. Run
`38489008355` checked documentation only. It did not authorize a software
release.

## Owner-session follow-up — 2026-10-14

Status: **RELEASED**. Testing 0.25.1 lets the explicitly
enabled runner attach to an already-authorized owner browser through Playwright
CDP. It does not require the profile setup helper. Existing direct integration
with an adopter-owned Playwright page remains available.

The reported Cloudflare loop occurred in an automation-launched Chrome window
showing `--no-sandbox`. That warning establishes the launch configuration, not
the challenge service's reason for rejecting verification. The patch enables
Chromium's sandbox in the existing launcher and offers attachment without
launching or changing the owner's browser. No CAPTCHA bypass is implemented.

JTBD-003 applies: developers need evidence from the user's actual host
experience. Attachment removes a launch constraint while preserving native
server evidence, natural scenarios, explicit outcomes, and cleanup. ADR-0123
continues to own the optional Playwright boundary; no browser framework or
authentication transport is added.

Five attachment tests passed, including a normally spawned Chromium fixture
with a real CDP connection. They prove zero connection for rejected authority,
fixed redacted errors, explicit CLI ownership, and preservation of the owner
browser and original tab after disconnect.

Redirect rejection proves zero
requests to the redirected destination. Browser defaults are preserved, and
WebSocket frames and the initial send queue are bounded to 16 MiB. Existing
scripted and intercepted
DOM tests retain their previous scope. None of these is live ChatGPT evidence.

Risk review uses RISK-POLICY.md. Residual impact × likelihood is 5 × 1 = 5
(Low) for the patch, its browser boundary, and the cumulative release change.
The optional interface remains explicit, literal loopback only, and adopter
owned.

Credentials, cookies, storage state, endpoint addresses, and existing
tab content are not retained. Owner browser control is powerful: dedicated
synthetic-test sessions, private loopback debugging, and bounded connections
are required. Existing cleanup and release gates remain mandatory. R003, R004,
R006, R007, and R010 retain their controls. No appetite exception is requested.

Remaining live blockers are an authorized controllable browser session and
authenticated server-call correlation. The connected Voder sandbox establishes
connector access only. A normal Chrome window without an exposed supported
interface cannot be attached by this package. Login, MFA, consent, and CAPTCHA
remain human actions; the complete issue #145 remains open.

The first source Quality run passed on dc9c0bf (38479318070). Candidate a9ef2b9
entered semantic checks in Release run 38480980700. Before npm publication,
that run was cancelled to admit Chrome's GUI browser endpoint without a browser
ID. The cancelled run is not release evidence. Corrected source passed new
source, semantic and registry gates before promotion. GUI debugging still requires owner approval and a runner on
the browser's host; it does not enable cloud access to the owner's computer.

## Earlier release status — recorded 2026-10-14

Publication status: **RELEASED (owner-authorized browser attachment)**.
At the time of the 2026-10-14 record, testing 0.25.1 and eleven initializer
updates at 0.1.19 were on npm latest.
The browser adapter remains experimental and explicitly opt-in. Ordinary
framework tests do not enable it or install browser tooling.

The preceding source baseline included testing 0.25.0, server 0.23.1, feedback
0.10.2, React 0.4.8, Svelte 0.2.8, and initializers 0.1.18. The native resource
foundation's retained evidence below belongs to that preceding release.
Its controls and honest capability limits remain unchanged by this patch.

## Previously released package set

| Package | Version |
| --- | --- |
| `@emseepea/testing` | `0.25.1` |
| `@emseepea/create-api-backed-server` | `0.1.19` |
| `@emseepea/create-database-schema-server` | `0.1.19` |
| `@emseepea/create-html-ui-server` | `0.1.19` |
| `@emseepea/create-mongodb-backed-server` | `0.1.19` |
| `@emseepea/create-multi-instance-postgres-server` | `0.1.19` |
| `@emseepea/create-openapi-backed-server` | `0.1.19` |
| `@emseepea/create-progress-streaming-server` | `0.1.19` |
| `@emseepea/create-react-ui-server` | `0.1.19` |
| `@emseepea/create-resources-and-prompts-server` | `0.1.19` |
| `@emseepea/create-soap-backed-server` | `0.1.19` |
| `@emseepea/create-tool-server` | `0.1.19` |

## Earlier release evidence and unresolved final gate — 2026-10-14

- Corrected source: b54b279d3b0dd16c19f9835099d39dda7499ddc9
- Source Quality passed: https://github.com/emseepea/emseepea/actions/runs/38482542927
- Released candidate: e80861cc7acf43a60d531507897af199e4e18338
- Semantic, next publication and registry checks passed: https://github.com/emseepea/emseepea/actions/runs/38484097161
- Release PR merged: https://github.com/emseepea/emseepea/pull/171
- Promotion and records passed: https://github.com/emseepea/emseepea/actions/runs/38486546839
- Merge-back commit: fed3be1f516518ee560f712d800ca0f7ba82e45d
- Final merge-back Quality failed: https://github.com/emseepea/emseepea/actions/runs/38486875204

Full local pre-push qualification passed for the corrected source. The local
benchmark passed before the GUI endpoint correction; both corrected-source CI
runtime profiles passed their full performance checks before publication.
The five attachment tests and existing native adapter checks retain their
fixture scope and do not establish live ChatGPT compatibility.

A fresh registry installation of testing 0.25.1 imported both default and native
entries without Playwright installed and exposed the attachment CLI help.
Its dependency graph verified 70 registry signatures and 37 attestations.

The final Node.js 22.23.2 merge-back performance classifier returned
INCONCLUSIVE with qualifies=false. Its public-boundary tests passed. Node.js 24,
all eleven standalone initializers, website, vulnerability and documentation
checks passed. Publish failed at the required final merge-back gate after
promotion; the packages remain available on latest. The overall FAIL marker
records that incomplete pipeline, not a failed attachment assertion.

No performance batch was retried, discarded or reclassified, and no budget was
weakened. The production framework and benchmark code are unchanged between
corrected source and merge-back. The performance cause remains unestablished;
[P022](../problems/open/022-accepted-path-cpu-budget-is-unqualified-on-the-node-22-ci-profile.md)
retains the existing runtime/profile investigation.

The Node.js 22 benchmark artifact is retained in that failed Quality run as
`benchmark-node-22.23.2-fed3be1f516518ee560f712d800ca0f7ba82e45d-attempt-1`
(artifact 11859404598). Local download was blocked by the artifact host, so the
receipt does not claim a locally parsed population analysis. No native account
credentials or endpoint addresses are included in this record.

## Foundation evidence and boundaries

Forty-two focused checks pass on the reconciled source. They cover registered
request scope, helper collisions, pagination, cancellation, aggregate and
empty results, coherent counts and rejection of malformed paths. Unscoped
empty Codex discovery is tolerated noise, not a configured-server operation.

The frozen genuine Codex proof has three trials and three turns per trial:
initial indexed reads, resumed template reads and fresh indexed reads. It
retains six application calls and nine resource reads. Three independent
meaning judgments per initial response passed. The configured model was
gpt-5.5, using CLI 0.159.2; the evidence is not authoritative release evidence.
Immutable traces pass the current validator offline without new model samples.
A separate retained backend trace correlates the fifteen observed operations;
fresh model sessions retain the application server.

See the [bounded evidence receipt](native-resource-evidence-2026-10-13.json).
Six resource-only attempts and the first mixed aggregate CLI failure remain
failed or unqualified. Three broader checks failed before their required
fixture was built; the unchanged checks passed after that build. None of these
failures was rewritten as a pass.

The first exact-source full qualification on 9a2a852 failed the README density
check: two paragraphs exceeded the existing 400-character limit. A diagnostic
test-stage run passed 439 checks and failed that one check. Paragraph boundaries
were repaired without changing words. The original failure remains retained;
qualification of the repaired commit was required at that stage. Its later
release and the current source passed their prepublication gates.

This foundation does not qualify general resource-only discovery, independently
observed authenticated HTTP requests, live ChatGPT, production learner behavior,
question correctness, ordinal question quality or recovered failed invocations.
These are separate verification requirements. No learner tool is hidden or
removed by this SDK change.

## Retained performance investigation

The original guard-source Node 22 Quality 38409314809 returned INCONCLUSIVE:
accepted-request CPU p95 was 4.212, 6.326 and 4.317 ms against the unchanged
5 ms limit. The corrected classifier refused publication. Later metadata reuse
passed its prescribed local comparison and normal CI checks, including the
released merge-back. Those runs used differing hardware; the earlier failure's
cause and hardware equivalence remain unestablished. No threshold was weakened.

[P022](../problems/open/022-accepted-path-cpu-budget-is-unqualified-on-the-node-22-ci-profile.md)
retains the runtime/profile investigation. P015's verified classification
control remains intact. Original learner quality and production-authentication
failures are not adjudicated by this SDK release.
