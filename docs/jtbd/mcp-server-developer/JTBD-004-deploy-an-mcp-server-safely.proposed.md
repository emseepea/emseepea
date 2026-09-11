---
status: proposed
job-id: deploy-an-mcp-server-safely
persona: mcp-server-developer
date-created: 2026-09-11
human-oversight: confirmed
oversight-date: 2026-09-11
screens:
  - README.md
  - website/src/content/docs/getting-started.md
  - website/src/content/docs/examples.md
  - examples/*/README.md
---

# JTBD-004: Deploy a Model Context Protocol Server Safely

## Job Statement

When I move a generated Model Context Protocol server into production, I want a
repeatable container path with secure defaults, so I can deploy it without
weakening its network, secret, or process boundaries.

## Desired Outcomes

- Build every standalone initializer through the same documented npm command.
- Fail closed unless the runtime supplies an explicit trusted-proxy policy.
- Keep credentials and provider connection strings out of image layers and source control.
- Run one non-root application process with bounded, observable health and shutdown behavior.
- Keep Docker Compose database services clearly limited to local development.
- Scale the PostgreSQL example as separate containers sharing managed PostgreSQL.

## Persona Constraints

The generated project must remain standalone. Routine commands must be
discoverable in `package.json`, and production guidance must not require users
to memorize raw container commands.

## What Developers Do Today

Developers design their own image, proxy, runtime configuration, secret, and
shutdown boundaries after generating an example, with no exact qualification
that the copied project still works outside the monorepo.
