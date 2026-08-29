---
status: proposed
job-id: prove-an-ai-understands-the-result
persona: mcp-server-developer
date-created: 2026-08-29
human-oversight: unconfirmed
screens:
  - examples/*/eval.yaml
---

# JTBD-003: Prove Artificial Intelligence Understands the Result

## Job Statement

When a tool returns correct data, I want to test what an artificial
intelligence (AI) system concludes from it, so users receive an answer with the
right meaning.

## Desired Outcomes

- Describe important meanings and edge cases in readable test cases.
- Run checks that give the same result every time without model access.
- Run repeated model checks before release.

## Persona Constraints

The check must catch plausible but wrong conclusions, not only badly shaped data.

## What Developers Do Today

Developers manually ask an artificial intelligence system questions and inspect
a few answers.
