---
status: "proposed"
date: 2026-10-16
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2027-01-16
---

# Optional WebMCP Feedback through an Existing MCP Client

## Context and Problem Statement

Website agents should be encouraged to record notable experiences while
completing the user's task. Em See Pea already supplies feedback tools, bounded
schemas, server authorization, receipts and authoritative storage through the
Model Context Protocol (MCP). WebMCP offers a separate experimental browser API
for website tools; an existing HTTP MCP endpoint is not itself a WebMCP tool.

The user confirmed the delivery objective and direction. This proposed decision
records the implementation boundary; that confirmation does not ratify this
architecture decision or establish browser-agent behavioural qualification.

## Decision Drivers

- Reuse the same server enforcement and feedback backend for both entry points.
- Preserve active encouragement, transparency, objections and task continuation.
- Keep browser support optional and backend packages out of the browser adapter.
- Bound discovery, calls, explicit context and registration lifetime.
- Distinguish native API evidence from an agent following feedback guidance.

## Considered Options

1. **Bridge one tool through an existing connected MCP client (chosen).** Reuse
   the server's schema, description, execution and receipt.
2. **Add a direct HTTP feedback service.** Extract shared services and build a
   second route, client and authorization integration.
3. **Expose the complete MCP catalogue.** Bridge arbitrary tools through WebMCP.

## Decision Outcome

Chosen option: **Bridge one tool through an existing connected MCP client**,
because it preserves the server's feedback contract and authorization through
one optional browser adapter.

Provide the optional browser-safe `@emseepea/feedback/webmcp` entry point with
`registerFeedbackWebMcp({ client, modelContext?, toolName?, signal?, timeoutMs? })`.
The adopter supplies a connected official MCP client and owns its authentication,
allowed endpoint and lifetime. Supplying a client does not create website login.
Authorization and account scope remain server-enforced on every submission.

Register only `submit-feedback` by default, or one collection submission tool
selected by trusted deployment configuration. The agent cannot choose the
collection. Do not register operator, event or arbitrary catalogue tools.
Discover the selected tool in one traversal of at most eight pages at
registration, then forward at most one MCP call per execution. These bounds
establish no measured traffic or performance improvement.

Preserve the server's input schema and active description, and retain successful
receipts and `nextAction`. Guidance encourages notable feedback without an extra
permission question, same-response disclosure, respect for objections, avoidance
of routine or duplicate reports, and completion of the original task. Deterministic
propagation checks cannot establish agent compliance.

Do not capture DOM, location, chat, credentials or page state automatically.
Adopter-declared context is explicit and bounded by server validation. Keep the
server and storage implementations out of the browser entry point.

Default to experimental `document.modelContext`; return unavailable when absent.
Allow an explicit compatible API object. Reject a tool-name collision rather
than replacing another registration. Bound discovery and execution deadlines,
permit one in-flight submission, and never retry writes automatically.
Cancellation, transport failure or an unsupported receipt may follow persistence;
report an unknown outcome without asserting rollback or exposing raw errors.

Dispose before logout or account/client changes. Disposal removes only this
registration, prevents further execution and cancels pending calls; it never
closes the caller-owned client. Cancellation does not prove a durable write was
rolled back, including when a client ignores the cancellation signal.

## Consequences

### Good

- Existing MCP and website submissions share one authoritative feedback path.
- The adopter keeps authentication and endpoint control in its existing client.
- Optional browser support leaves ordinary MCP integrations unchanged.
- Explicit lifecycle and uncertain-outcome handling reduce accidental duplicate
  writes and use of a previous account's client.

### Bad

- Adopters must already have or configure a browser-compatible MCP client.
- They must bind registration cleanup to their own account/session lifecycle.
- WebMCP API changes can require adapter revisions. The targeted
  `document.modelContext` shape in Chromium 154 does not establish general
  browser or agent support.
- Active descriptions cannot guarantee that an agent notices friction, submits
  useful feedback, discloses it or completes the user's task.

## Confirmation

- Qualification requires deterministic adapter and server boundary checks, a
  browser-bundled official MCP client, and native WebMCP calls from a synthetic
  website using the same HTTP server/backend as an independent MCP client.
- Record exact browser versions and results with the delivery evidence. The
  repository example uses synthetic, process-local records.
- Native API tests alone do not qualify browser-agent behaviour. Separate native
  agent journeys must establish notable feedback recognition, disclosure,
  objection handling, duplicate avoidance and observable task continuation.
- Missing evidence remains unqualified; this decision makes no closed-loop
  WebMCP support-conversation or published-release claim.

## Pros and Cons of the Options

The existing-client bridge retains server contracts and enforcement with one
browser adapter, but requires adopter-owned client integration. A direct HTTP
service could suit applications without MCP clients, but adds a parallel route
and authorization integration for the same operation. A complete catalogue
bridge generalizes discovery but unnecessarily exposes unrelated operations
and expands lifecycle, effect and authorization review beyond this objective.

## Reassessment Criteria

Reassess when WebMCP changes its API, native browser-agent evidence reveals
guidance or lifecycle failures, adopters need a different authenticated client
boundary, or a separately approved objective requires more than submission.
