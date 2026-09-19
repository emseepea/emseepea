---
status: proposed
job-id: prove-an-ai-understands-the-result
persona: mcp-server-developer
date-created: 2026-08-29
human-oversight: confirmed
oversight-date: 2026-09-20
screens:
  - examples/*/eval/*.test.mjs
---

# JTBD-003: Prove Artificial Intelligence Understands the Result

This is a job to be done (JTBD): something a person needs to accomplish,
written from their point of view rather than as a feature request. The person
here builds a server that speaks the Model Context Protocol (MCP), the protocol
an artificial intelligence (AI) system uses to call tools.

## Job Statement

When a tool returns correct data, I want to test what an AI system concludes
from it, so users receive an answer with the right meaning.

## Desired Outcomes

- Describe important meanings and edge cases in test cases a person can read.
- Run checks that never call a model, so they give the same result every time.
- Run checks that do call a model, repeatedly, before a release.

## Persona Constraints

The check must catch a conclusion that sounds plausible but is wrong. Catching
badly shaped data is not enough.

## What Developers Do Today

Developers ask an AI system questions by hand and inspect a few of its answers.
