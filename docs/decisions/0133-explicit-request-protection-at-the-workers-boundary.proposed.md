---
status: "proposed"
date: 2026-11-16
human-oversight: confirmed
oversight-date: 2026-11-16
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2027-02-16
---

# Explicit Request Protection at the Workers Boundary

## Context and Problem Statement

The Fetch entry point proposed in
[ADR-0132](0132-stateless-fetch-entry-point-for-mcp-tools.proposed.md) receives a
Web-standard request from Cloudflare Workers. The SDK Fetch handler leaves host
and origin validation and bearer verification to its caller. Fastify's
production profile can check its own proxy boundary under
[ADR-0103](0103-proved-proxy-boundary-for-production-deployments.proposed.md).
The Fetch entry point needs a policy it can enforce at the Workers boundary.

## Decision Drivers

- Refuse invalid requests before executing adopter code.
- Keep deployment routing and TLS separate from application authorization.
- Enforce a body ceiling during reading, including when the caller supplies no
  Content-Length.
- Preserve existing token verification, tool access, and scope semantics.

## Considered Options

1. **Framework checks at the Fetch boundary.** Enforce the configured MCP
   request policy before dispatch.
2. **Deployment-owned checks.** Require each adopter to supply its own
   middleware for MCP request protections.

## Decision Outcome

Chosen option: **Framework checks at the Fetch boundary**, because an installed
Em See Pea server should enforce its configured protections before running
application logic.

Em See Pea applies its existing MCP request protections at the Workers Fetch
boundary before dispatch. This includes checking the requested host and port
and any supplied browser Origin, bounding request bytes, and applying the
existing authentication and tool access policy. Caller-supplied forwarding
headers cannot override the request destination or caller identity.

## Consequences

- The framework can enforce application request protections without borrowing
  the Fastify proxy profile.
- Adopters must configure the authorities and browser origins for the
  deployment.
- The framework must qualify body-limit and access checks against real
  streaming Fetch requests.

## Confirmation

- Verify that disallowed authority or Origin, and oversized bodies with and
  without a declared length, are rejected before tool execution on `workerd`.
- Verify that forwarding headers cannot override authority or identity.
- Verify that protected calls and discovery configured to grant access by
  permission reject missing or invalid credentials and insufficient scopes.
  Verify that access works with the required credentials and scopes.
- Verify that public discovery and public OAuth metadata remain available
  without a token.
- Verify the configured request protections on an adopter's deployed Worker
  before recording production confirmation.

## Pros and Cons of the Options

Framework checks give adopters one supported policy and testable refusals.
They add code and configuration at the Fetch boundary. Deployment-owned
checks give adopters more control but require them to reproduce the protections
for each deployment.

## Reassessment Criteria

Reassess if Cloudflare changes the HTTP request facts available to Workers
or the framework can no longer enforce these checks before SDK dispatch.
