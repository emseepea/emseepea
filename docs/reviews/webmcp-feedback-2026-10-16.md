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
