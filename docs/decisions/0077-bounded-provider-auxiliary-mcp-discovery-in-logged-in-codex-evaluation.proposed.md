---
status: "proposed"
date: 2026-09-11
human-oversight: confirmed
oversight-date: 2026-09-11
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-11
supersedes: ["ADR-0076"]
---

# Bounded Provider-Auxiliary MCP Discovery in Logged-In Codex Evaluation

## Context and Problem Statement

ADR-0076 requires Codex CLI `0.145.0` to expose only the fixture tools. Live
qualification found that Codex always exposes two read-only provider adapters,
`list_mcp_resources` and `list_mcp_resource_templates`, whenever an MCP server
is configured. The strict configuration schema has no switch for disabling
them. The provider must either admit those unavoidable adapters under a narrow
contract or be removed.

## Decision Drivers

- Keep all task-relevant tool calls on the guarded native MCP path.
- Prevent auxiliary discovery from reaching or causing effects in the fixture.
- Fail closed if provider behavior expands beyond the observed contract.
- Make retained evidence truthful about auxiliary calls.
- Keep the local OpenAI path useful without changing Claude CI authority.

## Considered Options

1. **Bounded empty discovery adapters** - Admit only the two unavoidable Codex
   discovery adapters, require empty results from the sole configured proxy,
   and record sanitized counts.
2. **Remove the Codex provider** - Keep Claude as the only semantic provider
   because the literal fixture-tools-only contract cannot be achieved.

## Decision Outcome

Chosen option: **"Bounded empty discovery adapters"**, because the adapters
are read-only provider protocol discovery and all task-relevant fixture calls
remain protected by the existing guarded proxy.

Exactly one MCP server, the invocation-scoped guarded loopback proxy, is
configured. It advertises exactly the fixture's public tools. Codex may also
invoke only `list_mcp_resources` and `list_mcp_resource_templates` as
provider-auxiliary discovery. Each adapter must address the configured proxy,
use an empty argument object, return an empty list, and stay within one call per
adapter per user turn. These calls are never forwarded to the fixture.

A non-empty discovery result, another server name, unexpected arguments, a
repeated auxiliary call, or any other non-target tool fails closed. The
fixture's separate three-call budget, schema validation, canonical duplicate
detection, and pre-forwarding rejection remain unchanged.

Evidence records only the auxiliary discovery type and count. It excludes raw
events, addresses, arguments, results, and thread identifiers. Auxiliary calls
do not count as fixture tool calls. The `native-mcp` label remains limited to
the task-relevant fixture path. OpenAI-local evidence remains
non-authoritative, and `claude-ci` remains the sole release provider.

## Consequences

### Good

- The provider matches Codex CLI's actual bounded behavior.
- Fixture effects remain behind the guarded proxy.
- Evidence no longer implies that no auxiliary discovery occurred.

### Neutral

- OpenAI-local evidence has one additional sanitized count field.

### Bad

- The harness must reject any expansion of Codex's auxiliary MCP surface.

## Reassessment Criteria

Reassess this decision if Codex adds a supported switch to disable the
discovery adapters; either adapter's name, server identity, arguments, result
shape, or invocation frequency changes; discovery returns non-empty content or
gains effects; the pinned Codex CLI or model changes; or OpenAI-local evidence
is proposed as authoritative.

## Confirmation

- A behavioral inventory check observes only fixture tools plus the two named
  provider-auxiliary adapters.
- Each auxiliary adapter returns an empty list, runs at most once per turn, and
  causes no fixture forwarding.
- Non-empty, repeated, cross-server, argument-bearing, and unknown auxiliary
  events fail before evidence can pass.
- Fixture tool safety controls and exact call evidence continue to pass.
- A real logged-in Codex fixture evaluation passes on CLI `0.145.0` with model
  `gpt-5.6-sol` and records sanitized auxiliary counts.
- Claude CI and release commands remain unchanged.

## Pros and Cons of the Options

### Bounded empty discovery adapters

- Good, because it preserves local OpenAI evaluation.
- Good, because the admitted calls are read-only and separately bounded.
- Bad, because the callable provider surface is wider than fixture tools alone.

### Remove the Codex provider

- Good, because it preserves the literal target-tools-only rule.
- Bad, because it removes the requested credential-free local OpenAI path.
