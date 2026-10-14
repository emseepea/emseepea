# Current Release Readiness

Date: 2026-10-14

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

## Release status

Publication status: **RELEASED (owner-authorized browser attachment)**.
Testing 0.25.1 and eleven initializer updates at 0.1.19 are on npm latest.
The browser adapter remains experimental and explicitly opt-in. Ordinary
framework tests do not enable it or install browser tooling.

- Result: FAIL
- Final result: within appetite.

The preceding source baseline included testing 0.25.0, server 0.23.1, feedback
0.10.2, React 0.4.8, Svelte 0.2.8, and initializers 0.1.18. The native resource
foundation's retained evidence below belongs to that preceding release.
Its controls and honest capability limits remain unchanged by this patch.

## Released package set

- `@emseepea/testing@0.25.1`
- `@emseepea/create-api-backed-server@0.1.19`
- `@emseepea/create-database-schema-server@0.1.19`
- `@emseepea/create-html-ui-server@0.1.19`
- `@emseepea/create-mongodb-backed-server@0.1.19`
- `@emseepea/create-multi-instance-postgres-server@0.1.19`
- `@emseepea/create-openapi-backed-server@0.1.19`
- `@emseepea/create-progress-streaming-server@0.1.19`
- `@emseepea/create-react-ui-server@0.1.19`
- `@emseepea/create-resources-and-prompts-server@0.1.19`
- `@emseepea/create-soap-backed-server@0.1.19`
- `@emseepea/create-tool-server@0.1.19`

## Release evidence and unresolved final gate

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
