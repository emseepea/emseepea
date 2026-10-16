# WebMCP feedback delivery

## Confirmed objective

By Friday 23 October 2026, end of day Australia/Sydney, deliver and qualify
optional Em See Pea support for website feedback through WebMCP. Encourage
agents to record notable feedback openly while continuing the original task,
using the same authoritative backend as existing MCP tools.

Completion requires a working website and MCP client sharing a backend;
active tool and result guidance; browser-agent evidence of recognising useful
feedback, submitting it, disclosing it, respecting objections and continuing
the task; boundary tests; accurate documentation and applicable delivery checks.
Keep authorization and account separation enforced on the server. Accept only
bounded, explicitly supplied context, and keep credentials out of feedback.
Preserve existing MCP behaviour. Browser/API
availability and universal agent compliance are not guaranteed.

## Foundation increment — assessed revision 2

### Implemented scope

Deliver a browser-safe opt-in `@emseepea/feedback/webmcp` entry point that
registers one explicitly selected feedback submission tool from an existing
authenticated MCP client. Reuse the server's advertised schema, active
description, execution, receipt and backend rather than building a parallel
feedback service or duplicating authorization. The adopter supplies the MCP
client and its normal authentication; server packages stay out of the browser
adapter. The default tool is `submit-feedback`; explicit collection-specific
names may be selected. Do not expose arbitrary catalogues by default.

Support feature detection, cancellation, registration cleanup, bounded
discovery and execution, safe failure messages and explicit WebMCP annotations.
Bind registration to the supplied client's account/session lifetime: dispose
on logout or account/client change; prevent further execution, cancel pending
calls, and leave the caller-owned client open. Own only this registration and
reject name collisions. Keep successful receipts and nextAction; distinguish
tool rejection from success and uncertain write outcomes. Cancellation does
not prove rollback. Do not weaken schemas to satisfy browser registration.
Do not capture the DOM, location, chat, tokens, or page state automatically.
Server schemas bound any adopter-declared context. Do not retry writes.
The adopter's trusted configuration alone selects the tool/collection. No
operator or event tools are registered. The example is same-origin; supplying
a client does not create a website login integration. The client owner must
restrict its endpoint and handle authentication; the server derives scope.

Acceptance requires the browser's advertised description and returned guidance
to actively encourage notable helpful, difficult, surprising or wrong feedback
without a separate permission question; require same-response disclosure and
completion of the original task; and discourage duplicates, ordinary operation
and anything after an objection. Deterministic tests prove guidance propagation,
not agent compliance.

Include a runnable website example using the official browser MCP client and
the same real HTTP server as an independent MCP client. Demonstrate task
friction alongside actively encouraged feedback, using synthetic data only.
Test native WebMCP in the available Chromium, shared backend writes, rejection
before backend calls, account separation, cancellation and cleanup. Add
adopter documentation and a Changeset, with independent code and prose reviews.
Check the example's light/dark appearance, keyboard operation, accessible
names, focus and status announcements, and automated WCAG checks. State which
manual accessibility checks remain unverified.
Run the repository-required clean install, tests and benchmark. This increment
is delivered when these artifacts and their exact verification evidence exist;
it does not by itself establish browser-agent semantic qualification or a
published release.

Assumptions to verify: the official MCP client bundles for the browser; native
WebMCP is usable in installed Chromium; the server's schema maps acceptably;
an independently controlled browser agent is available for semantic evidence.
No precise effort estimate is established until these boundaries are probed.

### Qualification still required

Close the remaining confirmed-objective gaps using real browser-agent journeys:
friction, ordinary success, disclosure, objection, continuation and no duplicate
report, including notable positive/surprising experiences. Continuation means
the requested website task's observable result is achieved and answered, rather
than a response only discussing feedback. Before executing that increment,
assess a separate native WebMCP semantic harness/policy proposal: isolated
synthetic website/backend, unchanged user messages, native execution events,
three fresh conversations and independent meaning judgments, fail-closed
unknown results. Preserve existing MCP-only semantic harness restrictions.
Native API tests cannot stand in for browser-agent evidence.
Reuse supported native agent tooling if it can exercise WebMCP; record
unavailable capabilities explicitly. Then complete repository delivery gates
and prepare the qualified change for its established release workflow.
Release qualification includes clean-checkout Node 22/24 checks, OSV scan,
applicable packed-package/contract checks, cognitive-accessibility review and
exact-commit evidence. No WebMCP closed-loop support-conversation claim is made.

### Deferred scope

Determine from remaining verified gaps. Conversations and generic WebMCP tools
are not required for this feedback-submission objective.

### Assessment

Revision 1 received architecture conditions and a JTBD requirement to clarify
active encouragement, trusted collection selection and the semantic gate.
Revision 2 incorporates those corrections. Architecture, JTBD and risk reviewers
passed the executable foundation plan before code changes. The risk review
scored local implementation at 4/25 and projected release at 5/25 only after
mandatory controls pass. Review agents apply the locally installed specialist role
definitions; plugin hooks are not active in this chat.
Apply `RISK-POLICY.md` (maximum residual risk 5/25), `QUALITY.md`, the current
feedback jobs and existing MCP boundaries. Forecast controls above are not yet
verified. No semantic, release, or conformance claim is established.

## Foundation verification in progress

The optional browser entry point, synthetic same-origin website, native API
tests and adopter guidance are implemented. The independent architecture review
found no blocking adapter defect. Local adapter tests passed 11/11 and native
Chromium 154.0.8037.57 checks passed 6/6; the primary agent is repeating them
against fresh source builds. These establish API invocation and server
boundaries, not model compliance. Remaining checks and reviews are in progress.

The authenticated Codex CLI offers a feasible separately assessed native browser
bridge for semantic tests. Its native model catalogue identifies `gpt-6.1-sol`
as the available default. Use that model explicitly for local qualification;
the optional model-preference question does not block this routine test setting.
Claude CLI is installed but not authenticated; this does not count as passing
release qualification.

## Previous execution plan — revision 4

### Now

Complete the same optional feedback release increment through genuine native
browser-agent qualification and the remaining foundation delivery checks.
The foundation's 17 local tests pass; full fresh-source checks, benchmarks and
publication reviews remain required. This is not a delivered release yet.

Add a real `search-pea-varieties` WebMCP tool to the synthetic website, using
the same search function and visible result state as the human form. It must
return actual application results, including the limited-search behaviour;
no harness-supplied results or feedback-selection prompt is permitted.

Add a test-only loopback MCP bridge that discovers the website's native tools
and executes every selected call through Chromium's real
`document.modelContext.executeTool`. It must never call the backend directly.
Reuse the existing semantic harness for native provider events, unchanged user
messages, three fresh website/backend/conversation trials and three independent
tool-free judgments for each meaning assertion. Correlate provider calls with
native browser execution, resulting visible search state and authoritative
backend writes using bounded synthetic evidence. Keep private provider events,
credentials and transport configuration out of saved evidence.

Cases must establish friction recognition and useful submission without the
user asking for feedback; positive/surprising feedback; ordinary operation
without a negative report; disclosure in the same response; no duplicate
report; explicit objection; and completion of the requested catalogue task.
Use outcome-constrained call assertions where legitimate search sequences vary.
Unknown, failed, timed-out or missing evidence fails qualification. Never retry
an incorrect semantic answer or fabricate a passing result.

Document the exact path as Codex CLI (or Claude CLI) via a native WebMCP browser
bridge, not built-in Chrome-agent compatibility. Add a proposed decision and a
narrow QUALITY.md rule describing this isolated browser-backed test fixture;
preserve all existing MCP-only restrictions on ambient/browser/shell tools.
No general-purpose browser automation tools are offered to the model.

Run deterministic tests of the real bridge, including evidence correlation and
failure propagation, before semantic calls. Explicitly configure `gpt-6.1-sol`,
verified as the available default through the authenticated native model
catalogue. Do not change models or retry incorrect answers to obtain a pass.
Existing Claude release checks remain mandatory and are not replaced by local
Codex results. Review new code, public prose and cumulative risk before commit/push.

Delivered means all confirmed-objective evidence and applicable checks pass,
and the change proceeds through the established delivery workflow. Record any
unavailable irreducible capability precisely without claiming completion.

### Next

Resolve only gaps revealed by verification, then complete existing exact-commit
CI/release qualification and verify the resulting published capability. Do not
publish browser-agent compliance claims from API tests or an incomplete run.

### Later

No additional features are committed. Support conversations and arbitrary tool
catalogue bridging remain outside this objective.

### Assessment

Revision 3 passed architecture, JTBD and risk assessments before its dependent
implementation. The 26 deterministic adapter, browser, bridge and correlation
checks passed. Revision 4 retains that scope and explicitly selects the verified
local default model. Architecture, JTBD and risk assessments passed before the
single semantic qualification attempt. The existing
benchmarks passed. Full repository checks caught two initial bridge-test API
assumptions (corrected) and an unreadable PostgreSQL schema mount (local public
file permissions corrected; fixture rerun passed). The complete corrected
`npm test` run passed, including all standalone packed initializers and 440 final
boundary/documentation/release checks. Generated public files used standard
permissions (`umask 022`); new prose paragraphs were split to meet the existing
density guard. No assertion or budget was weakened.

## Original cloud completion blocker

The optional API, synthetic website and isolated browser bridge are implemented.
All 27 deterministic adapter, native-browser, bridge and evidence checks pass.
Independent architecture and JTBD reviews passed the final implementation and
the corrected observed-friction assertions. Default semantic discovery excludes
the separately invoked browser cases.

The one local semantic run attempted four cases with three fresh trials each.
All twelve trials failed inference authentication with HTTP 401 before any
model response or tool use. There were zero answer turns and zero judgments.
`artifacts/webmcp-eval.json` retains failed qualification, with no semantic
retries. Configured CLI credentials and an advertised model catalogue do not
establish usable inference access. A bounded diagnostic preserving managed
runtime context returned the same authentication failure.

Working authentication for the isolated model runner is required to resume
qualification. No browser-agent behaviour, completed objective, published
release or built-in Chrome-agent compatibility is claimed. Complete the
remaining deterministic repository checks and exact-content reviews so the
experimental implementation can be reviewed in a draft pull request. Do not
merge or publish on the strength of this failed semantic run. The full local
repository test and benchmarks have now passed. Final exact-content review and
commit/push qualification precede the draft pull request.


## Local qualification handoff — revision 5

Tom confirms `gpt-6.1-sol` and excludes Claude execution for this task. The local
Em See Pea GM offers an existing authorized Codex session for the same optional
qualification harness. Cloud authentication remains unusable; preserve the
failed twelve-trial artifact. No credential transfer or authentication repair
is proposed. Existing release gates remain unchanged and unresolved.

### Now

Prepare a reviewed exact commit and portable patch with SHA-256. Record the
base commit, model, native Chromium prerequisite and reproducible commands.
Reserve proposed ADRs 0127/0128 after checking fresh origin; the GM reports
0125/0126 allocated by concurrent delivery. Regenerate their compendium and
review the final prose and commit risk. Keep the implementation experimental.

### Next

The GM runs the unchanged optional harness on that commit in an isolated local
checkout using local Codex authentication. First confirm native browser checks;
then retain complete semantic results, native summaries, browser version,
command, commit and host identity. Do not coach answers, retry semantic failures,
substitute providers or transfer credentials. Record infrastructure failures
as failures. Local evidence applies only to the named client/browser path.

Coordinate repository integration and release sequencing with the GM before
any product push while the other delivery remains blocked. A portable patch is
the immediate handoff; no merge or publication follows from local evidence.

### Later

After genuine qualification, reconcile remaining release gates and established
human oversight. The Codex-only instruction does not itself satisfy or remove
the existing Claude release gate. Do not invoke Claude for this task or claim
objective completion while required evidence remains missing.

### Assessment

Architecture and JTBD reviewers passed this proposed execution-location change
before dependent work. Risk review passed the written revision at 5/25 residual risk before
its handoff proceeds. Final staged commit-risk review remains required. The objective and deadline remain unchanged.

## Positive-feedback evidence correction — assessed revision 6

### Learning

The GM's exact-source local run used `gpt-6.1-sol`, Codex 0.162.0,
Node 24.22.0, npm 12.0.2 and Chromium 154.0.8037.57. Build and all 27 native
checks passed. The semantic run failed: friction/disclosure/continuation/no
repeat, objection/continuation and ordinary empty results each passed nine
judgments; the positive case stopped before native verification or judgments.

The exact sanitized semantic artifact is 109802 bytes, SHA-256
`0a8eafe63e65c23bef221eb07861ea1d9e87c72df68339592214f34fb9543fac`.
Its `authoritative: false`, `modelEvidence: configured` and failed status remain
intact. All three positive trials called the allowed feedback operation, returned
receipts and disclosed it. Their explicit `variety-search` context and detail
identify the user-reported helpful catalogue search and time saved. The missing
literal query word `shelling` alone caused the feedback assertion to fail.
Native backend correlation and positive meaning judgments remain unestablished.

JTBD review identifies usefulness and specificity as the outcome; neither job
requires the literal query in the feedback detail. No production-guidance defect
is established by these complete submission arguments. Preserve the failed run,
the cloud 401 evidence and the reported Chromium 156 native-API failures.

### Now

Obtain architecture, JTBD and risk assessment of this exact test correction
before implementation. Keep model-facing prompts, tool guidance, schemas,
production code, model, trials, judgment count, retries and release gates intact.

In the browser positive case, run native/backend correlation before the detail
assertion so a later content failure does not hide that independent evidence.
Keep exactly one successful positive feedback call. Replace the literal query
requirement with identifying the operation and benefit (`search` and `time`).
Require independent meaning judgments to establish same-response disclosure of
the user's reported unexpectedly helpful catalogue search and saved time,
without claiming measured savings, a support reply or human comprehension.
Do not require repetition of the earlier query or variety as a condition of
useful positive feedback. Prior successful task completion stays required.

Record the bounded local evidence and its missing gates accurately. The existing
MCP-only positive test has a similar query-word proxy; record that observation
without silently altering its separate qualification contract in this change.
Chromium 156 fixture compatibility remains a separately reviewed gap; this
increment qualifies only the exact Chromium 154 path.

### Next

Run deterministic checks and independent code/prose/commit-risk review. Produce
a small exact follow-up commit and portable handoff. The GM may qualify that new
test contract once on a clean matching source revision, with three fresh trials
and all existing native, meaning and failure controls. This is a reviewed test
contract correction, not a product fix or an unchanged retry. Do not reclassify
the original failed run, reuse its answers for a passing result or retry an
incorrect answer within the new run.

### Later

Reassess the actual results and remaining delivery gates. No automatic push,
merge, release or completed-objective claim follows from this correction.

### Assessment

Independent architecture, JTBD and risk reviews passed revision 6 before its
dependent edits. Risk assessed the correction and fresh qualification at 5/25
residual risk. Final implementation, prose and commit-risk review remain
required before handoff; no fresh inference has run in this cloud checkout.

## Whole-response interpretation — assessed revision 7

### Learning

The verified revision 6 run remains failed. All positive native/backend checks
and detail assertions passed; eight of nine positive meaning judgments passed.
One rejected a response that acknowledges time saved in one sentence and
confirms recorded helpful-search feedback in the next. The other two judges
accepted the same complete response under an identical request hash.

The verified semantic artifact and positive native summary are retained privately
with their original failed status and authority labels. See the implementation
evidence report for hashes and limits. No majority override or unchanged retry
is proposed. JTBD review finds no requirement for a single-sentence disclosure
and no established production-guidance defect.

### Now

Assess this narrow interpretation clarification with architecture, JTBD and risk
reviewers before implementation. In the positive case's meaning expectation,
explicitly assess the whole response: benefit acknowledgment and disclosure may
be in separate sentences. Keep the substantive requirements that the saved
observation identifies the operation and faithfully attributes the benefit to
the user, and that the complete response discloses recording and communicates
the notable benefit without invented measurements or human involvement.

Generic acknowledgment without disclosure, an unidentified operation, a benefit
absent throughout the response, or invented facts still fails. Keep three fresh
trials, three independent judgments and rejection if any judgment fails.
No model-facing conversation prompt, production guidance, schema, harness,
provider, model, native correlation, browser version or release gate changes.
Do not quote the disputed answer as an approved answer in the test expectation.

### Next

After assessment, make only the reviewed expectation clarification, run syntax,
lint, native and documentation checks, and obtain applied code/prose/commit-risk
reviews. Prepare an exact incremental commit and portable handoff. Any further
qualification must evaluate that new reviewed contract on fresh conversations;
previous answers and failed judgments remain untouched. No inference execution
is authorized merely by receipt of the local evidence.

### Later

Reassess the actual outcome and remaining delivery gates, including the separate
Chromium 156 fixture gap. Keep ADR allocation 0127/0128. Do not push, merge,
release or claim objective completion from this interpretation clarification.

### Assessment

Independent architecture, JTBD and risk reviews passed revision 7 before its
dependent edit. Risk assessed preparation of the reviewed incremental handoff
at 5/25 residual risk. Applied implementation, prose and commit-risk reviews
remain required. No new inference execution is authorized by these assessments.

## Empty-search contract and evidence retention — assessed revision 8

### Learning

Revision 7 remains failed. Its exact 75297-byte semantic artifact was verified
with SHA-256 `46594ee3a4ecd417b59b328d328624d15c51fe25988c22b3220c8ab04d52450f`.
Positive feedback and objection each passed nine judgments. All three friction
commands timed out at the existing 180-second cap; their recorded turn arrays
are empty. Cause and side effects cannot be inferred from that bounded artifact.

For the ordinary-empty case, all trials searched the requested full name.
Trial 3 then followed the real result's “Try a shorter search” hint with
“Example”. Both actual provider outcomes were empty, and no trial called
feedback. The one-search assertion failed before native verification/judgments.
No passing result is established by those provider outcomes alone.

Native summaries use fixed case-name filenames and are written only after
verification. A failure before verification leaves previous-run files behind.
The GM correctly excluded old friction/empty summaries from revision 7. Fix
retention and provenance rather than deleting historical evidence or presenting
an absent current summary as success.

### Now

Obtain independent architecture, JTBD and risk assessments before dependent edits.
Keep production code, user prompts, provider, model, schemas, 180-second cap,
judgment counts, fail-closed aggregation and existing release gates unchanged.

Replace the ordinary-empty case's exact one-call assertion with a constrained
search sequence. Require the requested full name first; any subsequent query
must be a contiguous whole-word shortening of the previous query, prompted by
its real empty result and shorter-search hint. Every query must have an actual
empty native result and visible empty state, with zero feedback writes.

Derive the maximum number of calls from the original name's word count: each
optional shortening removes at least one word, so “Example Missing Variety”
permits at most three calls. This admits a legitimate hinted refinement while
rejecting unrelated queries, repeats, loops, non-empty outcomes and feedback.
Keep the existing independent meaning judgment of the completed requested task.

Give each semantic invocation a fresh private native-evidence run directory.
Bind its manifest to the semantic source SHA-256, case names and optional exact
revision. Print its unique identifier in the test log for matching collection.
Use fresh case-local execution paths before starting conversations; retain the
existing bounded synthetic native JSONL files even if startup, a turn or an
assertion fails. Missing/partial files remain unverified, not proof of no calls.

Write separate numbered native-correlation checkpoints only after existing
correlation checks succeed. Mark them as native evidence requiring the matching
semantic result. Do not overwrite legacy files, other runs or earlier
checkpoints. A checkpoint covers its recorded calls/hashes, not later activity.
Consumers must collect only the named run and match its source/revision to the
semantic artifact. Keep private provider logs, credentials and configuration out
of retained native evidence; preserve all existing per-file/value byte bounds.

Add meaningful deterministic tests for the allowed full-name/refinement paths
and rejection cases, and for run isolation, provenance, retained partial files
and immutable checkpoints. Run existing native checks, type/build/lint checks
appropriate to the fixture, and independent implementation/prose/commit reviews.

### Next

Prepare an exact incremental source artifact and diagnostics handoff for the
local GM. This correction does not repair or explain the friction timeouts.
Before any new inference, ask the GM to inspect already preserved local logs
and available host/process evidence without model calls, credential export or
sensitive log disclosure. Report only bounded sanitized facts about timing,
termination, resource failures and any surviving native execution evidence.
Do not assume authentication failure, no writes, or provider availability.

If no retained evidence identifies a remedy, report the precise blocker:
friction inference did not finish within the unchanged cap and its partial
native effects are unavailable. Do not simply repeat that failed execution,
raise its timeout or represent these source corrections as its resolution.
Fresh qualification of any corrected source requires a separately assessed
execution plan and local partner review; no inference follows automatically.

### Later

Reassess actual evidence and remaining delivery gates. Preserve Chromium 156's
separate API gap and ADR allocation 0127/0128. No push, merge, publication or
completed-objective claim is authorized by these fixture corrections.

### Assessment

Independent architecture, JTBD and risk reviews passed revision 8 before its
dependent implementation. Residual plan risk is 5/25. Applied reviews and
verification remain required before the source artifact handoff; no new
inference execution is authorized by this assessment.
