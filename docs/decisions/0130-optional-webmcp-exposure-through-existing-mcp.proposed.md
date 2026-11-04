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

# Optional WebMCP Exposure through an Existing MCP Client

## Context and Problem Statement

[Outcome #230](https://github.com/emseepea/emseepea/issues/230) requires one opt-in that exposes an existing Model Context Protocol (MCP) server’s full authorized catalogue through WebMCP. The earlier feedback-only proposal in draft pull request #178 does not meet that objective.

Tom confirmed the broader direction: adopters can expose everything without registering each capability individually. Filtering is optional. Existing server authorization must remain authoritative.

## Decision Drivers

- Make full catalogue exposure simple while preserving optional selection.
- Reuse the existing client, server contracts and authorization.
- Keep server runtime and storage code out of browser bundles.
- Explain differences between native WebMCP tools and adapted MCP capabilities.

## Considered Options

1. Generic browser adapter through the caller’s connected MCP client.
2. Feedback-only registration.
3. A parallel HTTP service with separate authorization and handlers.

## Decision Outcome

Chosen option: **"Generic browser adapter through the caller’s connected MCP client"**. Expose it through the optional `@emseepea/server/webmcp` entry point. `registerWebMcp({ client })` uses the caller-owned connected client. Discover all listing pages; do not impose the earlier eight-page cutoff. An optional filter selects a smaller set.

The first useful release exposes tools. Resources, resource templates and prompts remain required by the full outcome and will extend the same opt-in through explicit adaptations. WebMCP’s native tools do not establish native resource or prompt primitives.

Preserve advertised tool names, descriptions, input schemas and complete checked MCP results. Treat `isError` as part of the result rather than rejecting anything without a feedback receipt. Do not infer identity from browser arguments or reconstruct tools suppressed by server discovery.

Registration is a snapshot of the connected client’s visible catalogue. Dispose before logout or client/account changes and register again after reconnecting. Disposal removes only owned registrations; it never closes the client. Reject collisions without replacing page tools. Roll back partial registration on failure.

Never retry execution automatically. Cancellation and transport failures after dispatch have an unknown outcome; they do not prove rollback.

Pass cancellation to the client. Reject the adapter’s pending wait when the signal aborts, even if the client ignores cancellation. The caller can supply a deadline with `AbortSignal.timeout()`; the adapter adds no timer policy.

Preserve `readOnlyHint`. Set `consequentialHint` to `true` unless the server explicitly declares the tool read-only. This is framework policy rather than an equivalence with MCP destructive/open-world hints. Mark returned server content untrusted.

MCP `outputSchema` describes only `structuredContent`. Do not copy it onto a WebMCP result containing the full MCP envelope. The tools increment reports this schema exposure as unsupported while retaining complete results. More mapping work requires direct evidence rather than a false schema claim.

## Consequences

### Good

- One optional call exposes the client-visible tool catalogue.
- Authentication, endpoint selection and server enforcement remain in their current owners.
- Existing MCP clients and server deployments do not acquire a browser dependency.

### Bad

- Adopters must bind registration cleanup to their account/client lifetime.
- Experimental browser API changes can require adapter updates.
- Resources, templates and prompts require explicit adaptation; tools alone do not complete the outcome.

## Confirmation

- Exercise the official browser MCP client against a real HTTP server and native WebMCP.
- Check multiple tools, every listing page, optional filtering and metadata/result fidelity.
- Check authorization before handler work, account changes, collisions and cleanup.
- Verify publication and independently installed package behaviour through the existing workflow.
- Keep native API, isolated model qualification and hosted extension claims separate.

## Pros and Cons of the Options

The generic client adapter reuses authorization and checked contracts with one optional browser entry point. It requires an existing connected client and account-lifetime cleanup. This fits the confirmed catalogue-wide outcome.

Feedback-only registration is smaller but excludes the tools and other capabilities adopters asked to expose. A parallel HTTP service could avoid a browser MCP client, but duplicates transport and authorization for the same server operations.

## Reassessment Criteria

Reassess when WebMCP adds capability primitives, changes its registration or result contract, or real adopter evidence requires another client/lifecycle boundary.
