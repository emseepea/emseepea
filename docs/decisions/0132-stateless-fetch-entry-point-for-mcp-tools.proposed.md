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

# Stateless Fetch Entry Point for MCP Tools

## Context and Problem Statement

Adopters need to run the same MCP tool on Node and Cloudflare Workers.

In a test of Em See Pea 0.26.1 with Wrangler 4.162.0 and local `workerd`,
the tool returned its expected result on Node. With the Workers HTTP bridge,
Fastify failed when its router tried to compile code at runtime. Moving
initialization to module startup still failed during Fastify boot.

## Decision Drivers

- Let the adopter maintain one tool definition across both deployments.
- Preserve input validation, output validation, and MCP result handling.
- Keep the current Node/Fastify entry point compatible.
- Publish a support claim backed by a real `workerd` run.

## Considered Options

1. **Stateless Fetch entry point.** Expose a Fetch handler and portable tool
   declarations that can run on Node and Cloudflare Workers.
2. **Fastify through the Workers HTTP bridge.** Continue using the existing
   Node package entry point and depend on a compatible bridge and router.

## Decision Outcome

Chosen option: **Stateless Fetch entry point**, because the official MCP SDK
can serve Fetch requests and the existing framework tool checks can be shared
across both paths.

Em See Pea exposes a stateless Fetch entry point for Cloudflare Workers.
An adopter can use the same explicitly registered tool definition on Workers
and Node/Fastify, with the same validation, execution, and result handling.
An MCP client can discover, list, and call the tools on either runtime.

The request protection policy is defined in
[ADR-0133](0133-explicit-request-protection-at-the-workers-boundary.proposed.md).

## Consequences

- An adopter can deploy the same portable tool definition on both runtimes.
- The framework must qualify a second public entry point and keep shared
  tool behaviour aligned across the two serving paths.
- Adopter tool code and dependencies must also run in the target runtime.

## Confirmation

- Verify that the installed package serves the same declared tool in Fastify
  and `workerd`.
- From an MCP client, discover, list, and call the tool on both runtimes.
  Confirm matching structured tool output and equivalent rejection of invalid
  tool inputs and results.
- Verify that an adopter's deployed Worker serves the tool through its
  production MCP endpoint before recording production confirmation.

## Pros and Cons of the Options

The Fetch path uses the existing SDK protocol handler and avoids routing
through Fastify on Workers. It adds a public entry point to maintain.

The bridge would keep one framework entry point. The reproduced Fastify
boot failure leaves that option without a working Workers path today.

## Reassessment Criteria

Reassess if the shared implementation can no longer preserve the public tool
contract across the two runtimes or qualification exposes a dependency that
cannot run in `workerd`.
