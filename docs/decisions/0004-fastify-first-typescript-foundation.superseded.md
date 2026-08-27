---
status: "proposed"
date: 2026-08-27
human-oversight: confirmed
oversight-date: 2026-08-27
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
supersedes: ["ADR-0001"]
---

# Fastify-First TypeScript Framework Foundation

## Context and Problem Statement

Em See Pea is a reusable framework, but it is not HTTP-server agnostic. Fastify
is a deliberate part of the product foundation. Treating Fastify as an optional
example would create a second, unneeded transport boundary and obscure the
lifecycle on which the framework depends.

## Decision Drivers

- One observable HTTP lifecycle for validation, security, dispatch, and errors.
- Maintained MCP and Fastify integration rather than private protocol plumbing.
- A small public package surface without speculative transport abstractions.
- Node.js 22 and 24 qualification.

## Considered Options

1. **Fastify-first official MCP integration** - Build the framework on Fastify 5,
   the official MCP server package, and its official Fastify adapter.
2. **Server-agnostic web-standard core** - Own a generic request handler and add
   Fastify as one optional adopter integration.
3. **Raw Node.js transport** - Own HTTP serving and MCP transport behavior
   directly.

## Decision Outcome

Chosen option: **"Fastify-first official MCP integration"**.

Em See Pea uses TypeScript 6, npm workspaces with one root lockfile, Fastify 5,
`@modelcontextprotocol/server@2.0.0`, and
`@modelcontextprotocol/fastify@2.0.0`. The Fastify plugin and lifecycle form the
framework's HTTP boundary. Official Node transport code may be used beneath
that boundary where the adapter requires it, but it is not a second public
server abstraction.

The first public package is `@windyroad/emseepea`. Application handlers return
domain results and cannot construct raw HTTP, JSON-RPC, or SSE responses. Em See
Pea owns registration, policy, validation, and observable behavior around the
official dependencies. Enabled registrations determine advertised
capabilities; callers cannot supply capability maps or destinations.

No generic server or transport interface is created. Supporting a second HTTP
server, transport, or independently released package requires a new decision
based on a concrete adopter need.

## Consequences

### Good

- Framework policy follows one real Fastify lifecycle.
- Maintained official MCP integration replaces bespoke HTTP plumbing.
- Adopters receive an opinionated, testable framework rather than an abstraction
  over hypothetical servers.

### Neutral

- Fastify is a product dependency and appears in adopter integration concepts.
- Internal official Node transport code may remain necessary for Streamable HTTP.

### Bad

- Adopters committed to another HTTP server need a separate integration later.
- Major Fastify or MCP SDK changes can require framework migration work.

## Confirmation

- Clean installs, builds, and tests pass on Node.js 22 and 24.
- Real Fastify HTTP tests cover discovery, listing, calling, malformed input, and disabled capabilities.
- An independent MCP client interoperates through the Fastify endpoint.
- Examples use only the public Em See Pea API for MCP behavior.
- No public generic request-handler, server adapter, or caller-supplied capability map exists.

## Pros and Cons of the Options

### Fastify-first official MCP integration

- Good: Matches the intended framework and reuses maintained integration code.
- Bad: Deliberately couples the product to Fastify.

### Server-agnostic web-standard core

- Good: Could support multiple HTTP servers through one abstraction.
- Bad: Introduces an unused boundary and makes Fastify lifecycle behavior harder to guarantee.

### Raw Node.js transport

- Good: Gives complete implementation control.
- Bad: Rebuilds maintained public integration and increases qualification work.

## Reassessment Criteria

Reassess only when a real adopter requires a second server or transport, an
official dependency cannot satisfy a public wire requirement, or an independent
consumer proves a package split is necessary.
