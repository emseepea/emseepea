---
status: "proposed"
date: 2026-10-04
human-oversight: pending
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
reassessment-date: 2027-01-04
---

# Opt-In Checked Webhook Subscriptions for Model Context Protocol Events

> Captured via /wr-architect:capture-adr. The decision substance was derived from the request and architecture review. Human oversight remains unconfirmed until ratified after successful production use.

## Context and Problem Statement

ChatGPT's Model Context Protocol (MCP) Events integration can start work when an MCP server reports a matching change. It requires the 2026-07-28 event methods, durable subscriptions, verified HTTPS (encrypted web) callbacks, and signed webhook delivery. Em See Pea currently offers process-local resource subscriptions, not this cross-request event lifecycle. Treating the two as equivalent would falsely advertise persistence and delivery. The protocol also supplies a callback URL (web address), whereas the existing checked execution boundary prevents callers from choosing backend destinations.

## Decision Drivers

- Support the requested ChatGPT webhook event lifecycle without changing basic servers.
- Keep event definitions immutable through a deployment and advertise only working capabilities.
- Preserve the checked authentication and authorization boundary, including after access changes.
- Persist subscription identity, ownership, expiry, and delivery state across process restarts.
- Admit a protocol callback without allowing caller-selected backend destinations or unsafe outbound requests.
- Bound delivery attempts and make duplicate requests and events safe.

## Considered Options

1. **Opt-in checked webhook subscriptions (chosen)** — Provide a framework-owned event protocol boundary backed by an adopter-supplied durable store and safe outbound delivery.
2. **No MCP Events support** — Keep only process-local resource subscriptions and do not advertise events.
3. **Application-owned raw webhooks** — Leave event methods, subscription state, and delivery to each adopter outside the framework boundary.

## Decision Outcome

Chosen option: **"Opt-in checked webhook subscriptions"**, because the requested trigger needs durable subscriptions and a single enforceable security boundary.

- **Available only when ready:** A server advertises events only when its fixed event catalogue, authenticated endpoint, durable subscription store, and outbound delivery are configured and ready.
- **Supported:** Webhook `events/list`, `events/subscribe`, and `events/unsubscribe`.
- **Not supported initially:** Polling, streaming, gap or terminated notifications, and replay.

Subscriptions bind the authenticated owner, event and canonical filter arguments, verified callback URL, signing secret, and expiry. Subscribe and unsubscribe are idempotent. Access is checked at subscription time and again before delivery; revocation or provider failure stops delivery. A capability-specific store owns atomic persistence rather than introducing a universal distributed-state framework.

The callback URL supplied by the MCP client is a narrow exception for this protocol's outbound notification, not a backend adapter destination. The framework permits only verified HTTPS callbacks to public addresses. It checks Domain Name System (DNS) results and addresses at connection time, preserves hostname verification, and forbids redirects. It limits request time, response size, and delivery attempts. It signs the exact payload bytes with Standard Webhooks. Backend provider destinations remain fixed or allowlisted under the existing execution boundary. Required store or delivery unavailability fails readiness closed.

## Consequences

### Good

- Adopters can offer event-triggered ChatGPT work without implementing a second unchecked MCP boundary.
- Basic servers gain no subscription state or outbound traffic unless they opt in.
- Durable ownership and delivery controls remain explicit and testable.

### Neutral

- Event catalogues change through redeployment, while individual subscriptions change during runtime.
- Events are delivered at least once with bounded retries; consumers must tolerate duplicates and out-of-order arrival.

### Bad

- Adopters must supply durable storage and permitted outbound HTTPS connectivity.
- Client-supplied callbacks increase server-side request forgery (SSRF) and secret-handling risk, requiring stringent validation and operational controls.
- Without replay, events missed beyond the retry window cannot be recovered through this protocol.

## Confirmation

- An opt-in server advertises an event catalogue and handles list, subscribe, refresh, and unsubscribe on its authenticated MCP endpoint; a basic server does not advertise or accept those methods.
- A real production deployment retains a subscription through restart, filters an emitted event, verifies and signs the callback, and has ChatGPT receive the event and perform the user's requested follow-up.
- Invalid, unauthorized, expired, revoked, and mismatched requests produce no application event or callback delivery. Repeated subscribe and unsubscribe requests do not create duplicate subscriptions or effects.
- Delivery tests reject local and private addresses, DNS/address changes, redirects, invalid callback challenges, oversized responses, and unsafe secret handling; retries are bounded and retain stable event identifiers.
- Required store or delivery failure removes readiness, and documentation distinguishes the verified webhook subset from unsupported event modes and replay.

## Pros and Cons of the Options

### Opt-In Checked Webhook Subscriptions

- Good, because one checked boundary can enforce persistence, authorization, and safe egress for every adopter.
- Bad, because the framework must maintain a security-sensitive delivery lifecycle.

### No MCP Events Support

- Good, because it adds no state or outbound security surface.
- Bad, because it cannot deliver the requested event-triggered ChatGPT workflow.

### Application-Owned Raw Webhooks

- Good, because adopters could build specialized delivery behavior independently.
- Bad, because duplicated protocol code can bypass the framework's checked authorization and destination controls.

## Reassessment Criteria

Reassess if the event specification or ChatGPT integration changes its delivery contract, a production adopter needs replay, or evidence shows the capability-specific store and egress boundary cannot meet its documented safety or availability claims.
