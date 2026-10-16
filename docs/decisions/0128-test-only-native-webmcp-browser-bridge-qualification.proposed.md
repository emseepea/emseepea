---
status: "proposed"
date: 2026-10-16
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2027-01-16
---

# Test-only Native WebMCP Browser Bridge Qualification

## Context and Problem Statement

The optional feedback adapter preserves active guidance, but native API checks
alone cannot show an agent recognising notable feedback, disclosing a report,
respecting objections or completing the website task. The existing semantic
harness limits each model trial to one loopback Model Context Protocol (MCP)
server and excludes browser automation and other ambient tools from the model.
We need native WebMCP evidence without weakening that model-facing boundary.

## Decision Drivers

- Exercise real native WebMCP discovery and execution, the website task, and the
  feedback adapter and authoritative synthetic backend.
- Preserve unchanged user messages, native provider events and independent
  meaning judgments without model coaching or semantic retries.
- Keep browser automation internal to an isolated test fixture.
- Distinguish a CLI-to-browser bridge result from built-in browser-agent support
  and release authority.

## Considered Options

1. **Test-only loopback MCP bridge to native website WebMCP (chosen).** Reuse the
   existing semantic harness and correlate model events with browser evidence.
2. **Give the model browser automation tools.** Allow direct browser control in
   addition to website tools.
3. **Use only simulated WebMCP results.** Keep deterministic adapter checks as
   the sole evidence.

## Decision Outcome

Chosen option: **Test-only loopback MCP bridge to native website WebMCP**,
because it exercises the actual native execution path while preserving the
semantic harness's one-server application-tool boundary.

The fixture path is a supported CLI → the sole loopback MCP browser bridge
→ native Chromium WebMCP → the actual synthetic demo task or feedback
adapter/backend. This is test infrastructure, not a new production API or a
claim of compatibility with Chrome's built-in agent.

The fixture internally uses Playwright to discover the page's registered
WebMCP tools and invoke them through the native browser API. The model receives
only those application tools through its one MCP connection. It receives no
browser automation, shell, filesystem, tool search, plugin or ambient MCP tools.
The bridge does not substitute canned execution results or coach the model.

Retain the existing harness's three fresh conversations, unchanged user
messages, native provider tool-event assertions and three independent tool-free
meaning judgments for each meaning assertion. All trials must pass. Semantic
retries remain disabled. A missing or unavailable chosen model, native browser
API, judgment or correlation observation produces incomplete or failed evidence,
never a success inferred from deterministic checks.

Correlate provider-native calls and outcomes with actual native WebMCP results,
visible task state and authoritative fixture backend writes. Test useful
friction feedback, notable positive feedback, ordinary operation, objection,
duplicate avoidance, disclosure and continuation of the requested website task.
The original task must produce its observable website result and an answer;
a feedback-only response cannot establish continuation.

The opt-in fixture is `packages/feedback/eval/webmcp-server.mjs`; cases in
`packages/feedback/eval-webmcp/meaning.test.mjs` use the existing semantic
harness. Use isolated synthetic website/backend state and bounded native
evidence summaries in `artifacts/webmcp-native`. Summaries require a matching
semantic harness result; they do not independently establish an agent pass.

Local Codex evidence is non-authoritative and limited to the model and native
browser path actually exercised. The existing pinned, credentialed Claude
release authority and its evidence requirements remain unchanged. No model is
implicitly selected by this decision, and no semantic success is asserted.

## Consequences

### Good

- Agent choices exercise actual page-registered tools through native WebMCP.
- Provider, browser, visible task and storage observations can be checked
  together rather than assuming a tool event proves the whole journey.
- Existing semantic controls and model-facing restrictions remain intact.

### Bad

- The fixture depends on an available native Chromium WebMCP API and chosen
  model; API or provider changes can block qualification.
- The bridge cannot establish built-in browser-agent compatibility.
- Synthetic native summaries and semantic outputs need matching run evidence;
  either alone is insufficient.

## Confirmation

- Verify the model sees exactly the page-registered application tools through
  one loopback server and has no ambient browser or shell access.
- Verify real native discovery/execution and correlation of provider events,
  native results, visible task state and backend writes.
- Verify unchanged prompts, three fresh trials, independent tool-free judges,
  no model coaching, no semantic retries and fail-closed missing evidence.
- Record the chosen model, browser version and matching semantic/native results
  before claiming a scoped pass. Keep unexecuted or failed slices unqualified.
- Preserve the existing Claude release gate and distinguish local Codex results
  from release qualification and Chrome built-in-agent support.

## Pros and Cons of the Options

The test-only bridge uses native WebMCP while preserving the existing harness,
but introduces a browser fixture and correlated evidence checks. Giving the
model browser automation would expand its tool boundary and test a different
interaction. Simulated results are useful deterministic checks but cannot show
that the native website executed the agent's chosen operation.

## Reassessment Criteria

Reassess when native browser-agent tooling offers an equivalent automatable
journey, WebMCP changes its API, provider event evidence changes, or the bridge
can no longer preserve one-server isolation and authoritative correlation.
