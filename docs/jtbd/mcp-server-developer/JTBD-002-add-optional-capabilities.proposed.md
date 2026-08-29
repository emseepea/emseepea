---
status: proposed
job-id: add-optional-capabilities
persona: mcp-server-developer
date-created: 2026-08-29
human-oversight: unconfirmed
screens:
  - examples/
---

# JTBD-002: Add Optional Capabilities

## Job Statement

When my server needs more than public tools, I want to add only the capability
I need, so the project stays small and understandable.

## Desired Outcomes

- Add authentication, streaming, resources, prompts, or a user interface separately.
- Reuse package defaults instead of copying setup code.
- Keep the basic server free from unused features.

## Persona Constraints

Optional React and Tailwind support must not be required by servers without a
user interface.

## What Developers Do Today

Developers copy feature setup from larger projects and remove unrelated code.
