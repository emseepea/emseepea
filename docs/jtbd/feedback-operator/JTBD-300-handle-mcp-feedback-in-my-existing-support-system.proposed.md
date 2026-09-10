---
status: proposed
job-id: handle-mcp-feedback-in-my-existing-support-system
persona: feedback-operator
date-created: 2026-09-10
human-oversight: confirmed
oversight-date: 2026-09-10
screens:
  - GitHub issue
  - Zendesk ticket
  - application support workflow
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

## Persona Constraints

The support system remains authoritative. The MCP server must not maintain a
second conversation database that can drift from it.

## What Operators Do Today

Teams receive categorical signals with too little detail, or use custom
feedback stores that do not support durable threaded replies and native support
workflows.
