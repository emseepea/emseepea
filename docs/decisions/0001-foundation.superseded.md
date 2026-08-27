---
status: "superseded"
date: 2026-08-26
human-oversight: confirmed
oversight-date: 2026-08-27
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-26
superseded-by: "ADR-0004"
---

# Public-Specification-First TypeScript Framework Foundation

## Context and Problem Statement

Em See Pea must be a reusable framework rather than a service-specific server. It
must implement the modern MCP `2026-07-28` Streamable HTTP server surface
without rebuilding maintained public protocol machinery. The framework must
support progressively enabled capabilities and
honest, independently testable claims while keeping its initial implementation
small enough to qualify thoroughly.

## Decision Drivers

- Observable interoperability at the real HTTP boundary.
- A universal framework product rather than a single application server.
- Honest capability advertisement and composable qualification claims.
- Minimal maintenance burden and no speculative package abstractions.
- Node.js 22 and 24 compatibility for the first public release.
- Accessible UI examples without premature client-framework complexity.

## Considered Options

1. **Public-specification-first framework using the official SDK** - Wrap the
   stable public SDK behind Em See Pea-owned validation, dispatch, and transport
   boundaries, and verify its wire behavior independently.
2. **Private protocol implementation** - Implement the protocol, schemas, and
   Streamable HTTP machinery directly in Em See Pea.
3. **Service-specific server first** - Build the first application directly and
   extract a framework later.

## Decision Outcome

Chosen option: **"Public-specification-first framework using the official SDK"**.

This keeps Em See Pea focused on the reusable safety and composition boundary while public black-box evidence, rather than dependency reputation, governs compatibility.

The implementation uses TypeScript 6, supports Node.js 22 and 24, and uses npm
workspaces with one root lockfile. The official MCP TypeScript SDK 2.0.0 stays
behind Em See Pea's public API. The first package is `@windyroad/emseepea`; modules
remain internal until an optional dependency or independent consumer proves a
package split is necessary.

Em See Pea exposes a web-standard request handler and a Node serving helper.
Application handlers return validated domain results and cannot construct raw
HTTP, JSON-RPC, or SSE responses. Registered and enabled behavior determines
advertised capabilities; callers cannot provide capability maps.

The initial claim covers only modern MCP `2026-07-28` Streamable HTTP behavior.
Legacy initialization, sessions, GET streams, replay, and stdio stay outside a
claim until implemented and qualified. Evidence consists of black-box tests,
independent clients, clean-checkout builds, lockfile integrity, checksums,
software bills of materials, and independent reviews. Em See Pea will not build a
bespoke cryptographic certification system.

UI examples begin with server-rendered semantic HTML, native controls, CSS, and
minimal progressive enhancement. A client UI framework is added only when real
routing, persistent client state, component, visualization, or offline needs
justify it.

## Consequences

### Good

- Maintained public protocol machinery is reused without surrendering the
  framework's observable contract.
- The SDK remains replaceable because qualification occurs through Em See Pea's
  public HTTP boundary.
- Capability claims can expand one qualified slice at a time.
- Native HTML keeps the initial UI example small and accessible.

### Neutral

- One package contains internal modules until a real split boundary appears.
- Supporting only the modern protocol era excludes legacy clients by design.

### Bad

- Em See Pea inherits SDK defects that its public boundary cannot intercept.
- Supporting two Node.js lines increases CI time.
- A future incompatible SDK may require replacement rather than a private fork.

## Confirmation

- Clean installs, builds, and tests pass on Node.js 22 and 24.
- Raw HTTP tests cover discovery, listing, calling, malformed input, header mismatch, and disabled capabilities.
- An independent MCP client pinned to `2026-07-28` interoperates through the real HTTP endpoint.
- Every example imports only the public framework API for MCP behavior.
- Capability advertisements are derived from enabled handlers and match tested behavior.
- UI qualification includes semantic structure, keyboard operation, visible focus, accessible names, status announcements, and automated accessibility checks.

## Pros and Cons of the Options

### Public-specification-first framework using the official SDK

- Good: Reuses maintained public schemas and protocol machinery.
- Good: Keeps framework-specific controls independently testable.
- Bad: Requires defensive qualification around an external dependency.

### Private protocol implementation

- Good: Gives complete internal control.
- Bad: Duplicates complex public machinery and creates a large maintenance
  surface.

### Service-specific server first

- Good: Can produce one narrow application quickly.
- Bad: Makes the universal framework an uncertain extraction rather than the
  product.

## Reassessment Criteria

Reassess if the official SDK cannot satisfy a proven public-wire requirement,
an independently useful package boundary appears, a second transport is needed,
or native HTML cannot meet a demonstrated UI requirement.
