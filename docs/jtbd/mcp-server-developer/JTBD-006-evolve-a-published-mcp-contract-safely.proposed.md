---
status: proposed
job-id: evolve-a-published-mcp-contract-safely
persona: mcp-server-developer
date-created: 2026-09-15
human-oversight: confirmed
oversight-date: 2026-09-15
screens:
  - packages/testing/
  - tests/black-box/
---

# JTBD-006: Evolve a Published MCP Contract Safely

## Job Statement

When I prepare a change to a published Model Context Protocol (MCP) server, I
want its current public contract compared with prior published baselines, so I
can prevent breaking adopter-facing changes before release.

## Desired Outcomes

- Extract a deterministic contract through the real public MCP boundary.
- Compare the current contract with one or more versioned baselines using
  direction-aware compatibility rules.
- Identify incompatible changes to tools, input and output schemas, resources,
  MIME types, user interface metadata, and Content Security Policy (CSP).
- Produce concrete breaking-change reports and fail automated checks when
  incompatibilities are found.
- Keep application-specific release policy and baseline retention
  adopter-owned.

## Persona Constraints

Public and backend contracts must remain separate and checked. Reports must not
expose private application data.

## What Developers Do Today

Developers maintain custom extraction, capture, and compatibility scripts and
decide compatibility independently.
