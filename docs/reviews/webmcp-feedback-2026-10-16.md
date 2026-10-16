# WebMCP feedback implementation evidence

## Result and boundary

The optional `@emseepea/feedback/webmcp` adapter, synthetic website and test-only
native browser bridge are implemented. The confirmed objective remains
incomplete: native browser-agent behaviour is not qualified, and no package
publication or completed release is established.

The objective is due Friday 23 October 2026, end of day Australia/Sydney. It
requires agents to be actively encouraged to record notable feedback openly
while completing the original task, using the existing authoritative backend.

## Verified implementation

- The browser entry point has no runtime imports. It accepts the adopter's
  connected MCP client and preserves one configured server tool's description,
  schema, receipt and returned task-continuation guidance.
- Authorization, account scope, input validation and persistence remain in the
  existing MCP server. Native rejection and authentication tests establish zero
  backend writes for invalid calls and separation of two authenticated accounts.
- The adapter captures no surrounding conversation, DOM, URL or credentials.
  Context is explicit and bounded by the server contract.
- Disposal removes only the owned registration and cancels pending work. The
  caller owns client closure and account changes. Uncertain write outcomes do
  not claim rollback and never trigger an automatic retry.
- The same-origin synthetic website and independent MCP client share a backend.
  Its human form and native search tool share the same application function and
  visible result state.

## Checks

All 27 focused deterministic checks passed: 11 adapter, seven native-browser,
six bridge and three evidence-correlation checks. The native browser was
Chromium 154.0.8037.57, with WebMCP development features enabled. Browser API
support is experimental; this does not establish other browser or agent support.

The fresh repository build, public type contracts and existing JSON/production
boundary benchmarks passed. The corrected full `npm test` run passed, including
all workspace suites, all standalone packed initializers, and 440 final boundary,
documentation and release-workflow checks. The final phase reported no failures
or skips. The local run used Node.js 24.21.0 and npm 12.0.2.

Automated light/dark accessibility checks, keyboard operation, visible focus,
status regions and mobile overflow checks passed for the demo. Manual
screen-reader comprehension and full WCAG conformance are not established.

The initial full run caught two outdated native-API assumptions in new tests,
which were corrected. An existing PostgreSQL fixture also failed because its
public schema file was not readable by the database user in Docker. Local file
permissions were corrected without changing tracked content; that fixture's
rerun passed. A second run exposed the same file-mode issue in generated
projects and dense new documentation paragraphs. The paragraphs were split at
sentence boundaries. Running the complete suite with standard public-file
permissions (`umask 022`) resolved the generated-schema fixture issue; no test
assertion or budget was weakened.

The packed feedback archive includes the browser entry point and its public
type declarations.

## Original cloud authentication blocker

The separate semantic cases exercise this precise path:

```text
Codex CLI -> sole loopback MCP bridge -> native Chromium WebMCP
          -> actual website task or feedback adapter -> authoritative backend
```

The model receives only native website application tools. The fixture exposes
no general browser automation or direct backend shortcut. Correlation checks
match native provider outcomes, raw browser results, visible task state and
authoritative feedback records. A real limited search must precede feedback,
and a real successful search must establish task completion.

One run with explicit model `gpt-6.1-sol` attempted four cases and twelve fresh
trials. Every trial failed authentication with HTTP 401 before any model
response or tool call. Zero answer turns and zero meaning judgments were
observed. The failed result remains in `artifacts/webmcp-eval.json`; no semantic
retry or alternative model was used to obtain a passing result.

Usable inference authentication is required for cloud execution to qualify
friction recognition, positive feedback, ordinary operation, disclosure,
objections, duplicate avoidance and original-task continuation. Existing Claude
release requirements remain mandatory. Local Codex evidence would qualify only
the named bridge path, not Chrome's built-in agent or a published release.

## Review and next action

Independent architecture, JTBD and risk reviews assessed each executable plan.
Architecture and JTBD reviews passed the corrected implementation. Exact-content
public-prose reviews are recorded in the
[dated cognitive-accessibility record](cognitive-accessibility-2026-10-16.md).
Commit/push risk requires the completed full deterministic check and final
review snapshot; plan review does not approve publication.

Resume with working model-runner authentication, retain the existing failed
evidence, execute the unqualified cases without retrying incorrect answers,
and complete the established exact-commit delivery and release checks.


## Local qualification handoff

Tom confirms `gpt-6.1-sol` and excludes Claude execution for this task. The local
Em See Pea GM offers an authorized local Codex session for the same unchanged
harness and exact reviewed commit. The original cloud failure remains retained;
its SHA-256 is `2c521bd8fa060c5bbe42d0fc7671caffba5204a058b46e2100564ce69b6c107a`.
Local results cannot establish repaired cloud authentication or satisfy the
existing Claude release gate. No release policy is weakened.

Fresh origin remains `9b760e98fa1c1151e623182fb7c6d2d427704577`. Proposed WebMCP
ADRs are renumbered 0127/0128 to preserve the GM's reported concurrent allocation
of 0125/0126. Product push and release sequencing require GM coordination while
the other delivery is blocked. The immediate artifact is a portable patch;
merge, publication and objective completion remain unestablished.

## Local Chromium 156 boundary

The local Em See Pea GM reports that the unchanged 27-check suite on exact
commit `c9482a33677b1216ef87416e948ec3d7762fa0c6` failed against Chromium
156.0.8078.4: 16 passed, 10 failed and one was cancelled. No model inference ran.
The GM retains the raw logs locally; they have not been independently inspected
in this cloud checkout.

The reported native API returns object-valued tool input schemas and requires
object input to `executeTool`. The test bridge and browser checks assume the
string-valued Chromium 154 API, producing schema parsing and invocation errors.
Native API presence alone therefore does not qualify this fixture on 156.
This result does not establish that the production registration adapter fails.

The next local check uses unchanged source with Chromium 154.0.8037.57, the exact
cloud-tested version. Its result can qualify only that observed path. Any 156
repair requires separate review and fresh native checks before inference;
failed native execution must never trigger a write retry or backend shortcut.


## Verified local semantic failure

The exact local sanitized harness artifact was received and verified as
109802 bytes, SHA-256
`0a8eafe63e65c23bef221eb07861ea1d9e87c72df68339592214f34fb9543fac`.
It is retained separately from the cloud failure. Its status is failed,
`authoritative` is false and model evidence is configured; none is upgraded.
The GM reports full build and 27 native checks passed on unchanged source
`c9482a3`, Chromium 154.0.8037.57, Node 24.22.0, npm 12.0.2 and Codex 0.162.0.

Inspection confirms three semantic cases passed nine judgments each: friction,
disclosure, continuation and no duplicate; objection and continuation; and an
ordinary empty result. The positive case failed the feedback-detail assertion
before native verification or meaning judgments. It has zero praise judgments.

All three positive trials contain one successful `submit-feedback` provider
outcome with an allowed positive observation, a receipt, explicit context
`feature: variety-search`, and detail attributing an unexpectedly helpful,
time-saving catalogue search to the user. All disclose recording feedback.
The detail omits the literal query word `shelling`, required by the assertion.
These provider outcomes do not establish the unexecuted positive native/backend
correlation or passing positive meaning judgments. Overall qualification remains
failed; a separately reviewed correction must preserve that result.


## Reviewed positive-feedback test correction

Architecture, JTBD and risk reviewers passed plan revision 6 after independently
inspecting the verified local artifact. Applied architecture and JTBD reviews
passed the resulting two-line test correction. The positive case now verifies
native/backend correlation before its content assertion, requires the operation
and benefit rather than the literal query, and independently judges faithful
user attribution, disclosure and absence of invented measurements.

No production code, model-facing prompt, tool guidance, schema, provider, model,
trial count, judgment count, retry policy or release gate changed. A fresh local
run of all 27 deterministic WebMCP checks passed on Chromium 154.0.8037.57;
syntax and lint checks passed for the corrected semantic file. The original
full repository checks and benchmarks passed before this test-only correction;
they have not been rerun in full for the follow-up.

No new semantic inference has run. The original local result remains failed,
and its positive native correlation and meaning judgments remain unqualified.
One fresh evaluation of the reviewed new contract is required on its exact
follow-up commit; old answers cannot qualify it. The separate Chromium 156
fixture gap and existing release requirements remain unresolved.

## Revision 6 local result: failed meaning judgment

The successor `8be00504` was qualified locally once with the same configured
`gpt-6.1-sol`, Codex 0.162.0, Node 24.22.0 and Chromium 154.0.8037.57.
The GM reports all 27 native checks passed again. Exact sanitized semantic
JSON was received and verified: 122673 bytes, SHA-256
`f3ed7d8c6172c456150ea629c20e93cf1b006f7e67d23babfa27891a8cd286c5`.
It remains failed, non-authoritative, configured model evidence, with zero retries.

The three other cases each passed all nine judgments. The positive case
reached native/backend verification and passed detail assertions in every
trial, but one of its nine meaning judgments failed. The complete run therefore
failed with 35 of 36 judgments passing; passing votes do not override failure.

The independently transferred positive native summary was verified: 994 bytes,
SHA-256 `52aeb179c525b8cbc0ec7e58664aa7aac34b89541d9c6bb230df33ce7bbd1ca8`.
It records two calls and one exact feedback record per trial, on the pinned
browser. Its underlying raw native event files have not been transferred here;
the summary records their separate hashes. Semantic qualification still requires
the matching complete harness result.

Trial 3's complete response was: “Glad it saved you time. I recorded feedback
that the catalogue search was unexpectedly helpful.” Its stored observation
attributed helpful search and saved time to the user. Judgment 2 rejected the
omission of time saved from the feedback-summary sentence; judgments 1 and 3
accepted the complete response under the same request hash
`e51dfcbcd36e7abf505210ab3ec48791138f844dc91ab94c194138b3267782f4`.
The disagreement establishes neither a passing case nor a production defect.

Independent JTBD review identifies a whole-response interpretation ambiguity:
the job requires disclosure and benefit in the same response, not necessarily
the same sentence. A proposed clarification must preserve useful durable detail,
actual writes, disclosure, independent judgments and fail-closed aggregation.
No new source change or inference follows solely from receiving this evidence.

## Reviewed whole-response clarification

Architecture, JTBD and risk reviewers passed plan revision 7 before its edit.
Applied architecture and JTBD reviews passed the one-line semantic expectation
clarification. It assesses the complete response, allows related sentences to
jointly communicate benefit and disclosure, and retains rejection of missing
benefit, missing disclosure, unidentified operation and invented facts.

All three fresh trials and all three independent judgments remain required;
any rejected judgment still fails qualification. No prior answer is installed
as an approved example. Production guidance, user prompts, schemas, harness,
model, native correlation and release gates are unchanged.

All 27 deterministic WebMCP checks passed again on Chromium 154.0.8037.57;
syntax and lint passed. Full repository tests and benchmarks have not been
rerun for this expectation-only follow-up. No further inference has run.
The incremental handoff does not itself authorize inference, integration or
release, and all earlier failed evidence remains failed.

## Revision 7 failure and assessed revision 8 correction

The exact revision 7 artifact was received and verified: 75297 bytes, SHA-256
`46594ee3a4ecd417b59b328d328624d15c51fe25988c22b3220c8ab04d52450f`.
Its failed status, non-authoritative label, configured model evidence and zero
retries are unchanged. Positive feedback and objection each passed all nine
judgments. Friction and ordinary-empty cases remain unqualified.

All three friction trials report “model command timed out” with empty turn
arrays. Source inspection confirms the existing runner kills the process at
180 seconds and rejects before parsing captured output. Empty turn arrays
therefore cannot establish that there were no calls or backend writes, nor
identify authentication, transport or provider behaviour as the cause.

All ordinary-empty trials queried the requested full name. Trial 3 followed
the actual shorter-search hint with “Example”; both provider outcomes were
empty, and no feedback call was made. The exact one-search assertion failed
before native verification and meaning judgments. Those missing checks remain
missing, regardless of the plausible refinement.

The GM excluded previous-run friction and empty summaries from the revision 7
snapshot. Inspection confirms fixed case-name paths and success-only summary
writes could leave such stale files behind. Only positive and objection native
summaries are reported current for revision 7; their raw files were not supplied
in this artifact transfer.

Architecture, JTBD and risk reviews passed revision 8 before implementation.
The corrected empty-search contract requires the full name first, followed only
by hinted contiguous whole-word shortenings. Each removes a word, deriving a
maximum of three calls from the original three-word name. Actual empty native
results, visible empty state, zero writes and independent meaning checks remain
required. Repeated or unrelated queries cannot satisfy this contract.

Native evidence now gets a fresh private run directory, source/case/trial
provenance and explicit absent or caller-reported revision. Existing bounded
synthetic native files survive pre-verification failures. Verified checkpoints
are numbered, exclusive and tied to exact bytes and call counts; later activity
cannot inherit their verification. Previous runs and legacy files are preserved.

Applied architecture and JTBD reviews passed these fixture changes. All 33
focused deterministic checks passed, including negative refinement paths,
provenance/isolation, partial-file retention, immutable checkpoints and a real
native write retained after a simulated pre-verification assertion failure.
The feedback package build/type checks and focused lint checks passed. Full
repository tests and benchmarks have not been rerun for this fixture-only change.

No further inference has run. The correction does not repair the friction
timeouts. The next local action is read-only inspection of already retained
logs and host/process evidence; unavailable diagnostics must be reported as
unavailable. A fresh inference plan requires independent assessment after that
inspection. The 180-second cap, model, prompts, quorum and release gates remain
unchanged. No blind retry, side-effect absence or completed objective is claimed.

## Historical timeout investigation closed: cause undetermined

The local GM reverified the retained revision 7 JSON/log hashes and inspected
the approved evidence inventory. Friction trials contain only timeout errors,
with no recorded turns or provider-failure category. No contemporaneous host
resource/process snapshot or friction native checkpoint remains available.
The GM did not inspect authentication profiles or raw provider logs and did not
use current disk availability to infer past conditions.

Source inspection confirms buffered output is rejected before parsing when
the 180-second cap fires. Conversation and old native temporary directories
were subsequently removed. There is no retained approved evidence establishing
the historical cause or write effects. Both remain undetermined. That read-only
investigation is complete; it is not waiting on recoverable diagnostics.

The corrected evidence fixture can retain future native execution files but
cannot recover the discarded revision 7 data. A proposed one-invocation,
friction-only diagnostic would examine those new observations under unchanged
model-command limits. It would remain filtered diagnostic evidence, not complete
semantic qualification or proof that the historical cause was repaired.
Independent plan assessment and local partner review precede any execution.

## Reviewed single diagnostic handoff

The GM reports revision 8 independently passed all 33 native/deterministic
checks on its clean exact commit/tree with Node 24.22.0 and Chromium
154.0.8037.57. Reported log SHA-256:
`071b8e49fd6e13e176c5b0028f598d4d502d8369e5d191d94b1d1e19c45bb11d`.
That local log has not been transferred here. It is fixture evidence, not new
semantic qualification.

Architecture, JTBD and risk reviews passed the refined revision 9 diagnostic
and exact launcher. The launcher is 4496 bytes, SHA-256
`7fdd17eeff0c9c4373e3dfff73b9bdac64828c97e1ffafcb58d15ed8de23fc98`.
Syntax was checked; it has not been executed here. Source and model-facing
case prompts remain unchanged.

The launcher requires clean exact revision 8 source, pinned browser and recorded
CLI versions. An anchored test-name filter selects only friction through the
existing semantic CLI, with explicit Codex selection. Existing three trials,
judgments, provider isolation and 180-second command limits remain intact.
A 20-minute outer CLI deadline signals its existing cancellation handler;
forced CLI termination records cleanup uncertainty and failure.

Private scope and outcome manifests explicitly deny full qualification even
if the selected-case CLI result passes. Only the logged native run may be
collected. Missing or partial native files cannot prove absence of effects.
The GM must independently verify cleanup of owned processes after the run.
One locally reviewed diagnostic is permitted; no automatic further inference,
full qualification or release follows. Historical cause/effects stay undetermined.


## Verified instrumented friction result

The one revision 9 diagnostic completed locally on clean exact source
`a6f5b36f8ff0033c43e47ca12d220aa86918084d`, tree
`c91ac52a307452f449fc5c33d11799a839c90424`, with Codex-local/gpt-6.1-sol and
Chromium 154.0.8037.57. Its private transport is 76120 bytes, SHA-256
`b65b9e4863a56386f645fefe57da3f763fde87af070d285c74e13c65e8628a53`.
The package hash and all 11 contained file hashes were verified outside the
product repository. The exact synthetic evidence remains private.

Independent reapplication of native correlation and observed-friction assertions
confirmed all three trials: actual visible limitation, Highland Snap recovery,
one receipt after three first-turn calls, then the same single receipt after
five cumulative calls. Both immutable checkpoint hashes match their JSONL
prefixes. All nine recorded judgments pass. Run `run-LzWq0n`, semantic source
hash and selected-case revision agree. The local GM independently reports no
remaining owned processes and a clean checkout; no process snapshot was
transferred here.

This remains filtered diagnostic evidence, with `authoritative: false`,
`modelEvidence: configured` and `fullQualification: false`. Historical revision 7
timeout cause and effects remain undetermined. No complete qualification on
revision 8 has yet run. Independently assessed plan revision 10 permits one complete run
without changing source, prompts, assertions, model-command limits or judgments.
Earlier failures and separate cloud, compatibility and release gates remain.


Architecture, JTBD and risk reviews passed the exact revision 10 launcher,
4486 bytes, SHA-256
`ac904c1c89cf180061565cbba274e60c803f3db08dbdf50269d117ddf5b84063`.
Risk is 5/25. Syntax was checked; no inference ran here. The launcher requires
empty NODE_OPTIONS, explicit Codex selection and the clean exact revision 8
checkout. It invokes the complete file once through the existing semantic CLI,
with the existing 180-second model cap and a 38-minute outer bound. Private
manifests leave qualification unestablished pending independent review of all
four cases, 12 fresh trials, 36 judgments, matching native effects and cleanup.
Fresh local review precedes execution. Stop after the invocation regardless of
outcome; no automatic replay, product push or release follows.


## Verified complete local synthetic suite

The reviewed launcher ran once against clean exact revision
`a6f5b36f8ff0033c43e47ca12d220aa86918084d`, tree
`c91ac52a307452f449fc5c33d11799a839c90424`, using Codex-local/gpt-6.1-sol,
Node 24.22.0/npm 12.0.2/Codex 0.162.0 and Chromium 154.0.8037.57.
The GM reports exit 0 after 215.44 seconds, without outer deadline or forced
termination. No further inference followed.

The private transport is 200448 bytes, SHA-256
`9f62d7ca59a273b0703cee1f8841bb70d86158525a1745a98d5fbc2082fdd002`.
Its package hash and all 28 file hashes were verified outside the repository.
Independent reapplication of native correlation and case-specific assertions
confirmed all 12 trials. All six checkpoints match their exact raw JSONL
prefixes; final checkpoints cover the current files. All four case names,
36 passing tool-free judgments, source hash and revision agree with native run
`run-8jC7yx`. Each friction/positive trial wrote one real backend receipt;
objection/ordinary-empty trials wrote none, with no duplicate feedback.

The GM's independent review records a clean checkout and zero matching owned
processes afterward. A process snapshot was not transferred here. This is
bounded local synthetic qualification only: `authoritative: false`,
`modelEvidence: configured`, zero semantic retries. It does not establish hosted
agent, production, Chromium 156 or release qualification. Earlier failed runs
remain failed and the historical timeout cause/effects remain undetermined.
The next assessed step is the existing dependency and integration controls.


## Dependency policy verification and final claim review

The workflow-pinned OSV image scanned the exact committed lockfile copy, SHA-256
`d7fc745345f34832cb06f93202e857b8ea82ff1a00f767b176cd2afec37ab0d3`.
The scanner completed with findings (exit 1), producing a 30796-byte report,
SHA-256 `e1e6af0136033f4d2f02127ecc8654de70ab1fee911ee3b93d8e27ecb214f50e`.
No scanner operational failure was treated as an empty result.

The first unchanged maturity-gate command failed because Node fetch attempted
direct registry connections outside this environment's required proxy route.
Its log remains preserved, SHA-256
`002ff6d284942fcd81e9318c4481b60b91578b123ad3ab22097b118316603edf`.
Architecture, JTBD and risk reviewers passed the environment-only correction:
run the same gate against the same report with Node's supported
`--use-env-proxy`, preserving inherited CA validation. The corrected command
passed (exit 0); its output SHA-256 is
`ebe0cbc46edaf6a535638449b12fbf5d2cd8db15233a459dec53f5671304ca68`.

All five advisories remain reported. Three Handlebars advisories have fixes not
yet 14 days old; braces and http-cache-semantics have no published fix. The
existing policy allows this result; it is not vulnerability-free clearance.
No audit fix or lockfile mutation occurred. Every locked package version,
resolved URL and integrity hash matches origin/main.

Final architecture/JTBD review found no runtime blocker and corrected one claim:
the README now identifies the verified Codex-local/gpt-6.1-sol/Chromium 154 path;
ADR-0128 describes fixture architecture without implying Claude qualification.
Both ADRs remain proposed with human oversight unconfirmed. Exact-candidate
repository checks and integration coordination remain pending.
