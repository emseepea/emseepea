---
status: "proposed"
date: 2026-08-27
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
---

# Native Accessible Elicitation and Approval UI

## Context and Problem Statement

Form and URL elicitation can gather information or navigate a person, but neither
is authority for an effect. Approval needs a server-owned, authenticated, replay-
safe interaction without prematurely adding a client application framework.

## Decision Drivers

- Navigation consent and effect approval are different decisions.
- Approval state and effect summaries must remain server-controlled.
- UI examples must meet WCAG 2.2 AA from their first release.
- Native browser behavior covers the initial bounded workflows.

## Considered Options

1. **Server-rendered native Fastify UI** - Use semantic HTML, native controls,
   CSS, and minimal progressive enhancement.
2. **Client UI framework from the start** - Build elicitation and approval as an SPA.
3. **Client-controlled approval** - Treat protocol navigation or client state as authorization.

## Decision Outcome

Chosen option: **"Server-rendered native Fastify UI"**.

Em See Pea supports bounded form and URL elicitation while rejecting secret
collection. Effect approval is a separate authenticated server page that shows
the exact safe summary and offers explicit confirm, decline, and cancel actions.
Handles are scoped, expiring, single-use, alteration-resistant, and consumed
atomically before the effect. Client navigation consent never authorizes it.

The initial UI uses Fastify-rendered semantic HTML, native controls, CSS, and the
minimum JavaScript needed for progressive status. A frontend framework requires
a new decision after demonstrated routing, persistent state, reusable component,
complex visualization, or offline needs.

## Consequences

### Good

- Approval remains enforceable on the server.
- Native semantics reduce accessibility and security surface.
- The framework does not acquire a speculative frontend stack.

### Neutral

- Page navigation is preferred over modal interaction initially.

### Bad

- Rich client-side interaction requires a later decision.

## Confirmation

- Confirm, decline, cancel, expiry, alteration, replay, and concurrency tests pass.
- Keyboard-only and screen-reader users can complete happy and error paths.
- Automated checks cover semantics, names, focus, errors, status, and WCAG 2.2 AA contrast.
- Confirmation URLs and logs contain no secret, token, PII, or effect authority.
- Navigation without server confirmation produces zero effects.

## Pros and Cons of the Options

### Server-rendered native Fastify UI

- Good: Meets the bounded need with the native platform.
- Bad: Offers less client-side interaction.

### Client UI framework from the start

- Good: Supports complex UI growth.
- Bad: Adds dependencies and accessibility work before that growth exists.

### Client-controlled approval

- Good: Is easy to integrate.
- Bad: Cannot safely authorize server effects.

## Reassessment Criteria

Reassess only when a demonstrated UI need exceeds server-rendered native HTML or
the approval threat model changes.
