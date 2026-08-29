---
status: proposed
job-id: keep-guidance-accurate
persona: framework-maintainer
date-created: 2026-08-29
human-oversight: unconfirmed
screens:
  - README.md
  - docs/
  - examples/
---

# JTBD-102: Keep Guidance Accurate

## Job Statement

When framework behavior changes, I want published guidance and examples checked
with the same revision, so adopters can follow them successfully.

## Desired Outcomes

- Test copied examples outside the monorepo.
- Review published writing for clarity and cognitive accessibility.
- State what works, what does not, and which evidence supports each claim.

## Persona Constraints

Documentation must work on a phone and use language a developer can understand
without knowing the release process.

## What Maintainers Do Today

Maintainers update examples and guides manually after implementation changes.
