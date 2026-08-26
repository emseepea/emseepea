---
status: "proposed"
date: 2026-08-27
human-oversight: confirmed
oversight-date: 2026-08-27
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
---

# Public and OAuth Protected Resource Security

## Context and Problem Statement

Framework adopters need both deliberately public and protected MCP operations.
Authentication alone does not establish authorization, token safety, or safe
backend access.

## Decision Drivers

- Every operation has an explicit access policy.
- The framework acts as a resource server, not an authorization server.
- Backend credentials must never be confused with caller tokens.
- Authorization and SSRF controls must precede application calls.

## Considered Options

1. **Explicit public or OAuth-protected operations** - Validate identity and
   operation-specific authorization in the framework boundary.
2. **Application-owned security** - Pass identity material directly to handlers.
3. **Framework-owned authorization server** - Add login, client registration,
   and token issuance.

## Decision Outcome

Chosen option: **"Explicit public or OAuth-protected operations"**.

Every operation declares `public` or `protected`; absence is invalid. For
protected operations Em See Pea is an MCP OAuth resource server only. It
validates issuer, audience, expiry, scopes, and operation-specific object and
tenant authorization before execution. Provider selection is configured, not
caller-selected.

Caller bearer tokens are never reused as backend credentials. Secrets remain in
private configuration and redacted telemetry. Outbound destinations follow
allowlists, safe URL parsing, redirect policy, address resolution checks, and
bounded response handling. The framework does not implement authorization-server
or dynamic client-registration responsibilities.

## Consequences

### Good

- Public exposure is deliberate and protected failures are fail-closed.
- Tokens, provider credentials, and destinations remain separated.
- Security policy is testable before handler execution.

### Neutral

- Adopters still choose and operate a compatible authorization server.

### Bad

- Protected deployments require careful issuer and policy configuration.

## Confirmation

- Missing access declarations fail startup.
- Invalid issuer, audience, expiry, scope, object, or tenant authorization causes zero application calls.
- Caller tokens never appear in backend authorization or logs.
- SSRF tests cover parsing, redirects, DNS/address changes, prohibited address ranges, and size limits.
- Public operations do not accidentally inherit protected credentials or identity.

## Pros and Cons of the Options

### Explicit public or OAuth-protected operations

- Good: Provides one enforceable resource-server boundary.
- Bad: Requires detailed negative tests.

### Application-owned security

- Good: Minimizes framework code.
- Bad: Cannot support framework-wide security claims.

### Framework-owned authorization server

- Good: Could offer an integrated login stack.
- Bad: Adds an unrelated security product and large attack surface.

## Reassessment Criteria

Reassess when a public MCP revision changes resource-server duties or a supported
deployment requires a materially different authentication mechanism.
