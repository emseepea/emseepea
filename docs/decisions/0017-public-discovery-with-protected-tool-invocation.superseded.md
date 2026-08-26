---
status: "proposed"
date: 2026-08-27
human-oversight: confirmed
oversight-date: 2026-08-27
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
supersedes: ["ADR-0008"]
---

# Public Discovery with Protected Tool Invocation

## Context and Problem Statement

An MCP client must be able to understand a server before it can decide whether
and how to authenticate. Protecting the entire `POST /mcp` boundary would also
hide server details and tool contracts, even though credentials are only needed
to invoke protected tools.

## Decision Drivers

- Discovery must work before a client has credentials.
- Protected tools must be discoverable without exposing private implementation details.
- Authentication and authorization must still fail before protected work begins.
- Public tools must remain usable without acquiring an irrelevant token.
- One POST endpoint must support mixed public and protected operations safely.

## Considered Options

1. **Public discovery and listing, invocation-scoped protection** - Keep
   `server/discover` and `tools/list` anonymous; enforce access policy after a
   `tools/call` resolves its target and before its handler runs.
2. **Protect the entire MCP endpoint** - Require credentials for every request.
3. **Hide protected tools from anonymous clients** - Return a caller-specific
   tool catalogue.

## Decision Outcome

Chosen option: **"Public discovery and listing, invocation-scoped protection"**.

`server/discover` and `tools/list` are always available without authentication.
Protected tools appear in `tools/list` with only their public names,
descriptions, schemas, and required access metadata. Public contract output must
not reveal identities, credentials, backend models, destinations, or private
policy details.

Each tool explicitly declares `public` or `protected`; absence is invalid.
`tools/call` first resolves the declared tool, then enforces its policy. Public
tools run without credentials. Protected tools validate the configured OAuth
resource-server policy, including issuer, audience, expiry, scopes, and any
required object or tenant authorization, before handler or backend execution.

Caller bearer tokens are never reused as backend credentials. Provider
selection is configured rather than caller-selected. Em See Pea remains a
resource server and does not add authorization-server or
dynamic-client-registration responsibilities.

## Consequences

### Good

- Clients can inspect and configure against a server before authenticating.
- One stable catalogue describes both public and protected tools.
- Authentication protects execution without obscuring public contracts.

### Neutral

- Adopters still operate a compatible authorization server.
- Protected-path performance remains unclaimed until separately budgeted.

### Bad

- Authentication cannot be installed as blanket middleware around `/mcp`.
- The dispatcher must resolve a tool safely before applying its access policy.

## Confirmation

- A client without a token can call `server/discover` and `tools/list`.
- Protected tools are listed with only public contract and access metadata.
- Missing, invalid, expired, wrong-audience, or insufficient-scope tokens cause
  zero handler and backend calls.
- Public tools still execute without credentials when protected tools coexist.
- Caller tokens never appear in backend authorization, public output, or logs.
- Disabled capabilities remain absent and no protected-path performance claim
  is made without a separate budget.

## Pros and Cons of the Options

### Public discovery and listing, invocation-scoped protection

- Good: Preserves pre-auth interoperability and fail-closed execution.
- Bad: Requires method- and tool-aware enforcement inside the checked boundary.

### Protect the entire MCP endpoint

- Good: Is simple to express as middleware.
- Bad: Prevents unauthenticated discovery and adds needless auth to public tools.

### Hide protected tools from anonymous clients

- Good: Reveals less catalogue information.
- Bad: Produces identity-dependent contracts and makes client configuration harder.

## Reassessment Criteria

Reassess if a public MCP revision standardizes authenticated catalogue
filtering, protected tool metadata requires a different disclosure model, or a
supported authorization provider cannot enforce policy after tool resolution.
