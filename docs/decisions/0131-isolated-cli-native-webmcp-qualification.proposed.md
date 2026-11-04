---
status: "proposed"
date: 2026-11-03
human-oversight: confirmed
oversight-confirmed-date: 2026-11-03
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2027-02-03
---

# Isolated CLI-to-Native-WebMCP Qualification

## Context and Problem Statement

Native browser calls prove that registered tools execute. They do not prove that a model discovers the right tool, uses its contract and completes the requested task. The framework needs model evidence without giving the model unrelated browser or system tools.

Tom ratified an isolated CLI-to-native-WebMCP browser bridge for this qualification. That approval does not establish ChatGPT or Claude extension compatibility.

## Decision Drivers

- Exercise genuine native discovery and execution through the real adapter.
- Preserve the semantic harness’s one-server application-tool boundary.
- Correlate model events, browser results and authoritative synthetic server effects.
- Preserve existing release authority and honest evidence limits.

## Considered Options

1. A test-only loopback MCP bridge to page-registered native WebMCP tools.
2. General-purpose browser automation tools offered to the model.
3. Simulated browser results only.

## Decision Outcome

Chosen option: **"Test-only loopback MCP bridge to page-registered native WebMCP tools"**. The supported CLI connects to one loopback MCP server. That fixture discovers the synthetic page’s native WebMCP tools and invokes selected calls through the native browser API, adapter and real backend.

Browser automation remains internal to the fixture. The model receives application tools rather than shell, filesystem, browser-control or ambient integration tools. Do not replace native execution with direct backend calls or fabricated results.

Retain the existing harness’s fresh trials, independent tool-free meaning judgments and no semantic retries. Preserve failed and incomplete evidence. Missing model output, native correlation or judgments cannot become a passing result from deterministic checks.

Use the requested Codex sol 6.1 model for local qualification. Record exact model, source and browser versions. Local configured evidence does not replace the existing credentialed Claude release authority or exact-source release checks.

Keep synthetic effects and evidence isolated. Preserve bounded, redacted correlation of model calls, native results, visible task outcomes and server effects. Exclude credentials, browser profiles and unrelated page contents. Verify cleanup of owned fixture processes.

## Consequences

### Good

- Models exercise actual page tools through native WebMCP.
- Existing application-tool isolation and release authority remain intact.
- Correlation distinguishes a proposed tool call from observed execution.

### Bad

- Browser/API or provider availability can block qualification.
- This path cannot establish built-in browser-agent or extension compatibility.
- Synthetic results do not prove an adopter’s production journey.

## Confirmation

- Verify the sole model-facing server exposes only page application tools.
- Correlate model-native events with real native browser and server outcomes.
- Retain fresh trials, unchanged user requests and independent judgments.
- Run the normal exact-source, package, CI and release workflow separately.

## Pros and Cons of the Options

The test-only bridge exercises real page tools while preserving the existing one-server model boundary. It requires a native browser and correlated fixture evidence. This provides the requested qualification without expanding the model’s system access.

General browser automation could test a wider journey, but changes the model-facing boundary. Simulated results are useful for deterministic tests but cannot prove native execution. Neither alternative provides the chosen combination of native evidence and isolation.

## Reassessment Criteria

Reassess when supported native browser-agent tooling can provide equivalent isolated evidence or the fixture can no longer preserve the existing harness boundary.
