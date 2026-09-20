---
status: proposed
job-id: keep-guidance-accurate
persona: framework-maintainer
date-created: 2026-08-29
human-oversight: confirmed
oversight-date: 2026-09-20
screens:
  - README.md
  - docs/
  - examples/
  - website/src/content/docs/
---

# JTBD-102: Keep Guidance Accurate

This is a job to be done (JTBD): something a person needs to accomplish,
written from their point of view rather than as a feature request.

## Job Statement

When the framework's behaviour changes, I want the published guidance and
examples checked against that same change, so adopters can follow them
successfully.

## Desired Outcomes

- Copy an example out of this repository and run it somewhere else, to prove it
  works without this repository's own setup around it.
- Review published writing for clarity, including whether someone who finds
  dense text hard to follow can still act on it.
- State what works, what does not, and which evidence supports each claim.

## Persona Constraints

Documentation must work on a phone. It must use language a developer can
understand without knowing how this project releases software.

## What Maintainers Do Today

Maintainers update examples and guides by hand after the implementation changes.
