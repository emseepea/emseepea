---
status: "proposed"
date: 2026-08-27
human-oversight: confirmed
oversight-date: 2026-08-27
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
supersedes: ["ADR-0017"]
---

# Public Discovery and Invocation-Scoped OAuth Security

## Context and Problem Statement

Clients must be able to understand an MCP server before deciding how to
authenticate. At the same time, protected execution needs the complete token,
authorization, credential-separation, and outbound-request controls previously
selected for the framework.

## Decision Drivers

- Discovery must work before a client has credentials.
- Protected tools must be visible without leaking private implementation details.
- Authentication and authorization must fail before protected work begins.
- Caller credentials must remain separate from backend credentials.
- Outbound requests need fail-closed SSRF and response-size controls.
- Em See Pea remains a resource server, not an authorization server.

## Considered Options

1. **Public discovery with invocation-scoped OAuth and retained outbound
   controls** - List public contracts anonymously, then enforce the selected
   tool's access, authorization, token separation, and outbound policy before
   execution.
2. **Protect the entire MCP endpoint** - Require credentials for every request.
3. **Hide protected tools from anonymous clients** - Return an identity-specific
   catalogue.
4. **Delegate security to handlers** - Pass tokens and destinations through to
   application code.

## Decision Outcome

Chosen option: **"Public discovery with invocation-scoped OAuth and retained outbound controls"**.

`server/discover` and `tools/list` are always available without authentication.
Protected tools appear in `tools/list` with only their public names,
descriptions, schemas, and required access metadata. Public contract output
contains no identities, credentials, backend models, destinations, private
policy details, or backend errors.

Each tool explicitly declares `public` or `protected`; absence is invalid.
`tools/call` first resolves the declared tool and then enforces its policy.
Public tools run without credentials. Protected tools validate the configured
OAuth resource-server policy, including issuer, audience, expiry, scopes, and
required object or tenant authorization, before handler or backend execution.
Provider selection is configured rather than caller-selected.

Caller bearer tokens are never reused as backend credentials. Secrets remain
in private configuration and redacted telemetry. Outbound destinations use
allowlists and safe URL parsing. Redirects are bounded and revalidated. DNS and
resolved addresses are checked against prohibited ranges at each connection,
including after resolution changes. Response status, headers, duration, and
body size are bounded before data crosses the public result boundary.

Em See Pea does not implement authorization-server or
dynamic-client-registration responsibilities. Authentication cannot be blanket middleware
around the shared `/mcp` route because discovery and listing remain public.

## Consequences

### Good

- Clients can inspect and configure against a server before authenticating.
- Protected execution remains fail-closed before application or backend work.
- Token confusion and caller-selected outbound destinations remain prohibited.

### Neutral

- Adopters still operate a compatible authorization server.
- Protected-path performance remains unclaimed until separately budgeted.

### Bad

- The dispatcher must safely resolve a tool before applying its access policy.
- Outbound requests require redirect and address revalidation, not one URL check.

## Confirmation

- A client without a token can call `server/discover` and `tools/list`.
- Protected tools are listed with only public contract and access metadata.
- Missing, invalid, expired, wrong-audience, or insufficient-scope tokens cause
  zero handler and backend calls.
- Public tools still execute without credentials when protected tools coexist.
- Caller tokens never appear in backend authorization, public output, or logs.
- SSRF tests cover URL parsing, redirects, DNS and address changes, prohibited
  address ranges, and response size limits.
- Public operations never inherit protected credentials or identity.
- No protected-path performance claim is made without a separate budget.

## Pros and Cons of the Options

### Public discovery with invocation-scoped OAuth and retained outbound controls

- Good: Preserves pre-auth interoperability and the full security boundary.
- Bad: Requires method- and tool-aware enforcement inside the checked kernel.

### Protect the entire MCP endpoint

- Good: Is simple to express as middleware.
- Bad: Prevents unauthenticated discovery and adds irrelevant auth to public tools.

### Hide protected tools from anonymous clients

- Good: Reveals less catalogue information.
- Bad: Produces identity-dependent public contracts.

### Delegate security to handlers

- Good: Minimizes framework code.
- Bad: Cannot support framework-wide zero-call, token-separation, or SSRF claims.

## Reassessment Criteria

Reassess if a public MCP revision standardizes authenticated catalogue
filtering, a supported authorization provider cannot enforce policy after tool
resolution, or an outbound adapter requires a materially different security
boundary.
