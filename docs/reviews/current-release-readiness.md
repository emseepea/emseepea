# Current Release Readiness

Date: 2026-10-27

## Correlated operational logs

Status: **RELEASED AND VERIFIED**.

`@emseepea/server@0.25.4` is on npm's `latest` tag. Website 0.0.16 deploys the
[Traces, metrics and logs guide](https://emseepea.github.io/emseepea/tracing/).
The application-owned Node SDK recipe exports all three signals and shuts down
its providers. Useful HTTP duration buckets remain overridable through Views.

`openTelemetry({ logs: true })` adds safe completion logs with the valid local
request span's correlation IDs and completion timestamp. Logs default off.
Fixed INFO records use existing bounded attributes and exclude request payloads,
credentials, baggage and opaque trace state. The public custom-adapter event
contract remains unchanged. Synchronous counter, histogram and logger API
failures are guarded independently.

The existing release checks bind these revisions:

- Source `749210473633c6ee1accfffe326e2ecd9287e34a` —
  [Quality 40530849235](https://github.com/emseepea/emseepea/actions/runs/40530849235).
- Candidate `4a1e75162efd04c083ab1ae541ddc8fd2acaec50` —
  [Release 40534202322 attempt 2](https://github.com/emseepea/emseepea/actions/runs/40534202322).
- Publish merge `8baf84fbf120293b12e96c3ee1e757208d417318` —
  [Publish 40540106105](https://github.com/emseepea/emseepea/actions/runs/40540106105).
- Merge-back `daff3b3a5d0f3af31edb289468c4ff7029fb94fe` —
  [full Quality 40540849751](https://github.com/emseepea/emseepea/actions/runs/40540849751).

Source and candidate qualification, latest promotion, website deployment and
full merge-back qualification all passed. The detailed chain and retained
failures are recorded in [#205](https://github.com/emseepea/emseepea/issues/205)
and [#206](https://github.com/emseepea/emseepea/issues/206).

The registry-installed recipe passed real traces, HTTP metrics and correlated
log export, safe resource attributes, seconds/buckets and shutdown checks.
Independent canonical registry readbacks matched all sixteen changed packages'
versions, tags, integrities and candidate commits. The live guide returned
HTTP 200 with its canonical URL; both copy-button JavaScript payloads matched
the qualified source after decoding the renderer's newline representation.

The original local qualification failure caused by the task-added proxy flag
remains recorded in #206. Restoring that flag to its original setting preserved
inherited proxy/CA settings; the unchanged control and fresh full qualification
passed. Candidate Release attempt 1 later failed on a registry-read
`ECONNRESET` after publication. One initial metadata readback also returned an
older initializer tag; the complete fresh canonical readback matched the
candidate before the bounded failed-job-only retry.

Attempt 2 retained the successful semantic result's original timestamps and
passed the remaining strict checks. These failures were not relabelled as
success. The genuine reviewed website-changelog receipt was normally qualified
and pushed before promotion at `d151ba8`, with documentation-only Quality
40535028816 passed and release preparation skipped. It did not replace full
merge-back qualification.

The release publishes these sixteen package versions. The private shared UI
workspace has dependency metadata only; the private website is deployed rather
than published to npm.

- Published: `@emseepea/create-api-backed-server@0.1.29`
- Published: `@emseepea/create-database-schema-server@0.1.29`
- Published: `@emseepea/create-html-ui-server@0.1.29`
- Published: `@emseepea/create-mongodb-backed-server@0.1.29`
- Published: `@emseepea/create-multi-instance-postgres-server@0.1.29`
- Published: `@emseepea/create-openapi-backed-server@0.1.29`
- Published: `@emseepea/create-progress-streaming-server@0.1.29`
- Published: `@emseepea/create-react-ui-server@0.1.29`
- Published: `@emseepea/create-resources-and-prompts-server@0.1.29`
- Published: `@emseepea/create-soap-backed-server@0.1.29`
- Published: `@emseepea/create-tool-server@0.1.29`
- Published: `@emseepea/feedback@0.11.4`
- Published: `@emseepea/react@0.4.15`
- Published: `@emseepea/server@0.25.4`
- Published: `@emseepea/svelte@0.2.15`
- Published: `@emseepea/testing@0.26.7`

The SDK/metrics prerequisite (server 0.25.3 and website 0.0.15) was accepted
under #203/#204. Its earlier permissions, ledger and API-state failures remain
recorded in #203.

The single native ChatGPT pair remains bounded by
[#198's evidence](https://github.com/emseepea/emseepea/issues/198#issuecomment-6438956084).
HTTP carriers reached the forwarded fixture with unknown injector provenance;
tracing fields were absent in both calls' `params._meta`. No additional
operation timer, result-frame parser or tested-path `_meta` propagation is
added. The GM retains the separately tracked inert app/chat cleanup; probe,
forwarders and OAuth connection are already stopped or disconnected.

The scoped release risk remains 5/25, within appetite. The required release
checks above completed successfully. This update records the delivered result.

- Result: PASS
- Final result: within appetite.

## Historical SDK and metrics preparation (released as recorded above)

## Useful HTTP metrics and standard SDK recipe

Status: **SOURCE PREPARED; DELIVERY PENDING**.

Outcome #195 revision 4, increment #203 and contribution #204 add useful
second-based histogram advice and replace the tracing guide's manual provider,
context-manager and propagator setup with the standard Node SDK. The application
owns its SDK, exporters and shutdown. No additional production MCP timer,
result-frame parser or target-specific `_meta` propagation is added.

The owned loopback OTLP/HTTP experiment verified real traces, backend parentage,
request counts, duration seconds/buckets, restricted resource attributes and
shutdown. Focused controls also prove that 6 ms and 300 ms samples fall in
separate advised buckets and that application Views override the advice.
Advice changes the default histogram layout for providers honoring it; it is an
experimental API recommendation, not an enforced backend schema. Metric names,
units, timing and attributes are unchanged. Logs remain a separate increment.

The compatible SDK dependency is development-only. The framework continues to
use the application's OpenTelemetry API/providers. The recipe disables automatic
resource detection and automatic transport instrumentation. Its exporter timeouts
are per export; they are not an overall application shutdown deadline.

Required full qualification, remote dependency qualification, exact-source/candidate
publication, registry-installed recipe, latest promotion, website deployment and
merge-back remain pending. Compute the actual package closure from the generated
candidate; do not infer completed publication from these local controls.

The current Changesets plan computes sixteen public package patches (server,
eleven initializers, feedback, React, Svelte and testing), plus the private website
patch. The private shared UI workspace has dependency metadata only. The retained
Fastify Changeset accounts for the initializer closure. Immutable candidate
versions are allocated by the existing release workflow, not guessed here.
The new lockfile passed the pinned OSV scan and existing fix-eligibility gate.
Normal and stalled-collector controls passed: the latter confirms a successful
tool response followed by reported shutdown failure, not acknowledged export.

The prerequisite #199/#200 is independently accepted. Source `3bf6edf` passed
canonical Quality 40487853868 and candidate `2e5c0dd` passed Release 40490975981,
including all sixteen changed packages verified under `next`. Its earlier failed
local benchmark is retained at #199 comment6439334586; canonical success does not
explain or relabel that failure. Server `latest` remains 0.25.1 at this checkpoint.

One genuine native ChatGPT pair is recorded in #198 comment6438956084. Both calls
completed with matching server results and one metric sample per mode. HTTP
tracing carriers reached the fixture through its forwarder; injection provenance
remains unknown. Neither call carried tracing fields in `params._meta`. This is
bounded evidence, not universal client support or incompatibility. The pair must
not repeat. Probe/tunnels are stopped and OAuth disconnected; the GM owns final
inert UI cleanup. Native cleanup does not block this server-side improvement.

## Historical baseline preparation (qualified in the result above)

Status: **SOURCE PREPARED; QUALIFICATION PENDING**.

Outcome #195 plan revision 3, prerequisite #199 and contribution #200 restore
the qualified source baseline for telemetry delivery. Fastify 5.12.5 is replaced
with the exact 5.12.6 patch for
[GHSA-389g-gv7q-r4x8](https://github.com/advisories/GHSA-389g-gv7q-r4x8),
which concerns case-sensitive `propertyNames` enum/const validation in header
schemas. This is not a claim of a general authentication bypass.

The discovery source at `7cb001dd567206644d15d6e1bda55bfdc7aaaed0` passed
full local qualification, its five collector controls and required benchmarks.
[Source Quality 40464650869](https://github.com/emseepea/emseepea/actions/runs/40464650869)
passed Node.js 22 and 24, website and documentation checks, but failed the
existing mature-fix dependency gate. Initializer qualification and release
preparation were skipped. The failed job log and a local pinned OSV scan both
identify Fastify 5.12.6 as the eligible fix; the fix crossed the existing
14-day threshold on 27 October. The original failure is retained, without an
unchanged retry or gate exception.

The runtime dependency diff updates only Fastify's exact pin and lock entry.
Corrected source `a4565b9fb12523370374513e00f61f04ac758a35` passed full
local qualification, benchmarks, focused controls and the pinned eligibility
gate. [Source Quality 40469067445](https://github.com/emseepea/emseepea/actions/runs/40469067445)
passed both Node versions, website/documentation, vulnerability and all eleven
initializer jobs. Release preparation then failed inside the pinned Changesets
action with `createCommitOnBranch` undefined, before opening a release PR or
dispatching a candidate. That failure is retained separately from the earlier
Fastify eligibility failure.

The workflow correction selects the same pinned action's documented
`push-with-git-cli: true` option. Actor/token permissions, versioning, generated
branch/PR binding, exact-source checks and explicit candidate dispatch remain
unchanged. Generated Git CLI commits need not carry the GitHub GPG signatures
of API-created commits; signature equivalence is not claimed. Package signature,
registry integrity and provenance checks remain mandatory.

The synthetic OAuth fixture correction is tracked separately under #196/#198:
permit only `https://chatgpt.com` alongside `'self'` in `form-action`, preserving
registered callback/path, PKCE, PIN, resource and one-time-code checks. Root
integrates the independently reviewed local artifact as a separate result under
#200 and qualifies the final clean tip. Neither the fixture patch nor controlled
checks establish native ChatGPT support.

The Changeset
also covers the eleven initializer templates required to consume the updated
server. Changesets computes four further dependent package patches. The
planned sixteen-package closure below comes from the existing release-plan
reader, not a handwritten assumption about the framework alone.

- Previously planned: `@emseepea/create-api-backed-server@0.1.27`
- Previously planned: `@emseepea/create-database-schema-server@0.1.27`
- Previously planned: `@emseepea/create-html-ui-server@0.1.27`
- Previously planned: `@emseepea/create-mongodb-backed-server@0.1.27`
- Previously planned: `@emseepea/create-multi-instance-postgres-server@0.1.27`
- Previously planned: `@emseepea/create-openapi-backed-server@0.1.27`
- Previously planned: `@emseepea/create-progress-streaming-server@0.1.27`
- Previously planned: `@emseepea/create-react-ui-server@0.1.27`
- Previously planned: `@emseepea/create-resources-and-prompts-server@0.1.27`
- Previously planned: `@emseepea/create-soap-backed-server@0.1.27`
- Previously planned: `@emseepea/create-tool-server@0.1.27`
- Previously planned: `@emseepea/feedback@0.11.2`
- Previously planned: `@emseepea/react@0.4.13`
- Previously planned: `@emseepea/server@0.25.2`
- Previously planned: `@emseepea/svelte@0.2.13`
- Previously planned: `@emseepea/testing@0.26.5`

These are planned versions, not published versions. Existing allocation and
registry checks determine the actual candidate versions. A successful source
Quality run can create/update the release PR and dispatch candidate publication
to `next`; root retains the resulting workflow and registry watch. Candidate
publication does not establish `latest` promotion, installed adopter behavior or
completion of the telemetry outcome. No separate immediate `latest` promotion
is required by the scoped risk assessment.

All five independent critics passed repair plan revision 3. The risk reviewer
assessed the Git CLI transport, fixed-origin CSP correction, scoped commit, push
and automatic candidate-publication effects at
5/25, conditional on reviewing this actual package closure and passing the
existing install, full compatibility, benchmark, vulnerability, initializer,
candidate and registry gates. Those new exact-source results remain pending.
No source or publication qualification is inferred from this forecast.

The native ChatGPT task #198 remains separately owned by the GM. Tom approved
Connect; the current blocker is the observed OAuth CSP callback rejection, and
no native observe call has run. Support remains UNKNOWN. The temporary synthetic fixture does not use the
advisory's affected header-schema constraints; risk review does not require it
to stop solely for this finding. This security patch proves no native feature.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.

## Website request tracing guide

Status: **RELEASED AND VERIFIED**.

The [Trace requests guide](https://emseepea.github.io/emseepea/tracing/) is live.
It includes runnable OpenTelemetry setup, expected request/backend span
relationships, shutdown and privacy guidance. The sidebar and observability
explanation link to it. Website version 0.0.14 was generated by Changesets;
this release publishes no new npm framework package.

The [release evidence](website-tracing-release-2026-10-27.md) records the exact
source, candidate and deployment chain. Live HTTP 200, canonical URL, sidebar
and contextual navigation passed without JavaScript. The copyable example
matches the code executed against registry server 0.25.1.

Source Quality 40394110659 attempt 2 and Release 40450852566 passed. Publish
40452523342 successfully deployed the measured source artifact and completed
merge-back qualification. Exact merge-back Quality 40452750748 also completed
successfully. Increment #192 owns the independent final acceptance record.

The original source attempt's INCONCLUSIVE performance result remains valid
historical evidence. Following the renewed release instruction, the revised
website-only plan explicitly excepted local R014 retry guidance for one whole
workflow retry. No threshold, population, runtime, dependency, workflow or
permission changed. The passing retry does not explain the original spikes,
establish runtime performance equivalence or globally re-rate R014.

Independent reviews assessed the scoped website release at 5/25, within appetite
with the unchanged required gates completed successfully. The earlier blocked
website checkpoint below is historical.

- Result: PASS
- Final result: within appetite.

## Historical website checkpoint — 26 October

Status: **SOURCE ADDED; WEBSITE PUBLICATION BLOCKED**.

The guide and navigation are committed on main. They are not deployed.
The prior npm server 0.25.1 release below remains complete and does not
establish website deployment. No release candidate was created for this
website change.

The fresh external installation ran the website example verbatim against
server 0.25.1: HTTP 200, incoming parent → request → backend child, and graceful
shutdown passed. The website build and all 16 existing website checks passed.
Full local exact-commit qualification also passed for corrected source
`f4f19c7220aaba59a2985ea9a299b258d0b9b1eb`.

[Source Quality 40394110659](https://github.com/emseepea/emseepea/actions/runs/40394110659)
failed the Node 24 production performance gate. Accepted-request CPU p95 was
3.522, 3.023 and 6.179 ms across the three complete ordinary populations,
against the unchanged 5 ms ceiling. The mixed result is INCONCLUSIVE and does
not qualify. Node 22, website measurements and the other required source
checks passed; release preparation was skipped.

The separate diagnostic populations passed, but are diagnostic-only and do not
qualify. The retained evidence does not establish the cause of the ordinary
CPU spikes. No runtime or dependency change appears in this website source.
An unchanged retry cannot qualify merely because it passes, under
[risk R014](../risks/R014-performance-gate-misclassifies-a-revision-when-measurement-variance-is-unclassified.active.md).
No retry, gate change or speculative runtime optimization was made.

The [publication evidence](website-tracing-publication-2026-10-26.md) records
the exact source and retained measurements. Publication requires an evidenced
correction, separately assessed where it changes scope, followed by passing
exact-source gates, the normal candidate/deployment/merge-back workflow and
live guide/navigation verification. The Wednesday afternoon deadline remains.

Five independent critics approved the website plan. Its 5/25 cumulative risk
assessment was conditional on successful existing gates; this failure does not
satisfy that condition. Changesets still contains a private website patch.
No public npm package release is planned by this documentation change.

- Result: BLOCKED
- Final result: required exact-source performance gate did not qualify.

## Request tracing release

Status: **RELEASED AND VERIFIED**.

`@emseepea/server@0.25.1` is published on npm's `latest` tag. Operators can
continue incoming trace context through the MCP request into instrumented
asynchronous backend work. Spans cover the request lifetime and retain redacted
attributes. Applications own providers, context management, propagation,
exporters and backend instrumentation.

The [release evidence](request-tracing-release-2026-10-26.md) records the exact
source, candidate, promotion and merge-back revisions and successful workflows.
A fresh installation outside this checkout executed the installed README guide
verbatim: HTTP 200, incoming parent → request → backend child, and successful
flush and shutdown. This uses a synthetic backend and console exporter; it
does not claim verification of an operated production telemetry service.

Full exact-commit qualification, source Quality, candidate semantic evaluation,
registry integrity/provenance, promotion and merge-back Quality passed. Source
Quality required Zod 4.6.6; a focused check also exposed a timing mismatch.
The released repair uses shared monotonic request timestamps and retains the
regression assertion. Full local tests, focused tracing/schema checks and all
benchmark populations passed for the repaired source.

Independent architecture, jobs, risk, cognitive-accessibility and planning
reviews approved the release plan. The scoped cumulative commit, push and
release risk assessment is 5/25, within appetite. All existing mandatory release
gates completed successfully. No release control or permission changed.

Versions were generated by Changesets. The matching starter and dependent
packages were promoted together.

### Published public packages

- Published: `@emseepea/server@0.25.1`
- Published: `@emseepea/create-api-backed-server@0.1.26`
- Published: `@emseepea/create-database-schema-server@0.1.26`
- Published: `@emseepea/create-html-ui-server@0.1.26`
- Published: `@emseepea/create-mongodb-backed-server@0.1.26`
- Published: `@emseepea/create-multi-instance-postgres-server@0.1.26`
- Published: `@emseepea/create-openapi-backed-server@0.1.26`
- Published: `@emseepea/create-progress-streaming-server@0.1.26`
- Published: `@emseepea/create-react-ui-server@0.1.26`
- Published: `@emseepea/create-resources-and-prompts-server@0.1.26`
- Published: `@emseepea/create-soap-backed-server@0.1.26`
- Published: `@emseepea/create-tool-server@0.1.26`
- Published: `@emseepea/feedback@0.11.1`
- Published: `@emseepea/react@0.4.12`
- Published: `@emseepea/svelte@0.2.12`
- Published: `@emseepea/testing@0.26.4`

- Result: PASS
- Final result: within appetite.

## Previous readiness records, retained history

The following records describe earlier release preparation. Their pending
statuses and package lists are historical; the tracing plan above is current.

Date: 2026-10-25

## Initializer container security update

Status: **LOCAL FEEDBACK CHECKS PASS; RELEASE PENDING**.

The queued release updates all eleven initializer containers to Node.js
24.22.1 and refreshed, digest-pinned builder and runtime images. Changesets
computes the package versions below. No version is edited by hand.

The previous release build rejected valid feedback wording: one trial said
"below the search results", but the test required "below the results". The
test now retains the required detail words and uses its existing independent
judgments to check both the submitted detail and final response. Exact calls,
the friction category and the objection checks are unchanged.

Fresh local checks passed eight feedback cases, with three conversations and
nine judgments per case. These used the existing local Claude account and
`claude-sonnet-4-6`; they do not replace credentialed release qualification.
The focused builds and repository lint check also passed. The current source
still requires full clean-commit qualification, exact-source Quality, release
checks, registry verification, promotion and merge-back verification.

The local production benchmark was inconclusive. One accepted-request sample
measured 58 requests per second against the existing 100-request threshold.
CPU, allocation and wire-size checks passed in all three populations; the
other two populations passed throughput too. This is not a benchmark pass.

The repair changes tests, diagnostic output and readiness metadata, not
framework source or release controls. The root lockfile now records
`fast-json-stringify@7.2.0` and `hono@4.13.14`, which fresh consumer installs
already selected within the existing dependency constraints. The guarded
install now requests current registry metadata instead of preferring cached
metadata. That graph still requires a fresh vulnerability scan
and exact-source qualification. No public dependency
constraint changes. This release does not complete #174.
Architecture review passed. The scoped cumulative risk assessment is within
the 5/25 appetite, subject to the required exact-commit gates. Cognitive review
must cover this exact metadata before commit or publication.

### Planned public packages

- Previously planned: `@emseepea/create-api-backed-server@0.1.25`
- Previously planned: `@emseepea/create-database-schema-server@0.1.25`
- Previously planned: `@emseepea/create-html-ui-server@0.1.25`
- Previously planned: `@emseepea/create-mongodb-backed-server@0.1.25`
- Previously planned: `@emseepea/create-multi-instance-postgres-server@0.1.25`
- Previously planned: `@emseepea/create-openapi-backed-server@0.1.25`
- Previously planned: `@emseepea/create-progress-streaming-server@0.1.25`
- Previously planned: `@emseepea/create-react-ui-server@0.1.25`
- Previously planned: `@emseepea/create-resources-and-prompts-server@0.1.25`
- Previously planned: `@emseepea/create-soap-backed-server@0.1.25`
- Previously planned: `@emseepea/create-tool-server@0.1.25`

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.

## Previous release readiness, retained history

Review date: 2026-10-23.

### Operation-specific feedback descriptions

Status: **RELEASED AND VERIFIED**.

`@emseepea/feedback@0.11.0` is published on npm's `latest` tag. Its default description
limits feedback to the application operation being performed. The optional
`description` setting supports accurate application-specific wording while
preserving native execution and receipts. Website 0.0.13 publishes the guide.

The [approved outcome](feedback-description-outcome-2026-10-23.md) is complete
before the Sunday, 25 October 2026 target in Australia/Sydney. The
[release evidence](feedback-description-release-2026-10-23.md) binds the exact
source, candidate, promotion and merge-back revisions to successful workflows.
It also records the fresh installed-package and published-guide checks.

All required source, semantic, vulnerability, registry, provenance, downloaded-
package and merge-back checks passed. The local production benchmark passed all
three populations with `qualifies: true`. The feedback semantic suite passed
eight cases with three fresh answer trials and nine judge verdicts per case.

The installed-package verification passed all six supported protocol versions,
configuration typing, validation, receipt timing and failure behavior. It used
a synthetic in-memory backend. These checks do not establish native ChatGPT
production behavior, marketplace acceptance or private stored text.

Architecture and privacy boundaries remain those of the
[proposed description decision](../decisions/0127-application-specific-feedback-submission-descriptions.proposed.md).
The decision does not claim architectural ratification or actual production
confirmation. Adopters remain responsible for accurate replacement guidance,
collection policy, storage and retention.

The scoped cumulative commit, push and release risk assessment remains 5/25,
within the repository's appetite. The existing qualification and publication
gates all completed successfully. No approval or security control was changed.

#### Published public package

- Previously published: `@emseepea/feedback@0.11.0`

- Result: PASS
- Final result: within appetite.
