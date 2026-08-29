---
status: proposed
job-id: extend-the-supported-protocol
persona: framework-maintainer
date-created: 2026-08-29
human-oversight: unconfirmed
screens:
  - packages/framework/
  - tests/black-box/
---

# JTBD-100: Extend the Supported Model Context Protocol

## Job Statement

When I add a Model Context Protocol (MCP) capability, I want tests through the
real public boundary, so the framework advertises and performs exactly what it
supports.

## Desired Outcomes

- Derive behavior from the public Model Context Protocol specification and ratified decisions.
- Test valid use, invalid input, cancellation, and safe failures.
- Keep unsupported capabilities out of discovery and documentation.

## Persona Constraints

Public and backend data contracts must stay separate and checked.

## What Maintainers Do Today

Maintainers rely on software development kit (SDK) types and one-off integration checks.
