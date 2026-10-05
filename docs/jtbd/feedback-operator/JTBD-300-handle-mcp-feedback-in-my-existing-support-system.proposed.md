---
status: proposed
job-id: handle-mcp-feedback-in-my-existing-support-system
persona: feedback-operator
date-created: 2026-09-10
human-oversight: confirmed
oversight-date: 2026-10-05
screens:
  - GitHub issue
  - Zendesk ticket
  - application support workflow
  - Internal MCP conversation
---

# JTBD-300: Handle MCP Feedback in My Existing Support System

## Job Statement

When feedback arrives from an MCP application, I want to investigate, reply,
action, and track it in my existing support system, so I can close the loop
without operating another inbox.

## Desired Outcomes

- Receive useful detail and exact thread correlation.
- Reply in the native support system and receive later user messages there.
- Use native assignment, labels or tags, milestones, status, and notifications.
- See when a reply was offered to the AI without claiming human comprehension.
- Keep private notes out of user-visible conversation history.
- Route typed feedback events to email or another application-owned handler.
- Monitor `internal`, `customer`, or both feedback collections through Model
  Context Protocol (MCP) Events, with each subscription limited to an authorized
  subset.
- Receive body-free events with stable references, then retrieve the exact
  authoritative feedback record under separate operator authorization.
- Enable submission, monitoring, and operator retrieval independently, while
  intentionally overlapping those roles on an authorized internal MCP when
  useful.
- Submit internal feedback through an explicitly internal tool whose destination
  is fixed by server configuration.
- Keep a customer-facing MCP limited to customer-feedback submission, without
  event or operator capabilities.
- Keep assignment, status, tags, replies, notifications, and private notes in
  the authoritative support system.

## Persona Constraints

- The support system remains authoritative. The internal MCP is an authorized
  interface to that system, not a second inbox or conversation database that
  can drift from it.
- A feedback collection describes origin and audience. It is not an account,
  client, or human identity.
- Event discovery, subscription, delivery, and authoritative retrieval are
  authorized independently.
- Users and models never select the destination feedback collection.

## What Operators Do Today

Teams receive categorical signals with too little detail, or use custom
feedback stores that do not support durable threaded replies and native support
workflows.
