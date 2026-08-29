---
status: proposed
job-id: publish-installable-packages-safely
persona: framework-maintainer
date-created: 2026-08-29
human-oversight: unconfirmed
screens:
  - .github/workflows/release.yml
---

# JTBD-101: Publish Installable Packages Safely

## Job Statement

When I publish a release, I want to verify the exact downloaded packages before
announcing them, so adopters receive working code with trustworthy evidence.

## Desired Outcomes

- Inspect the files each package will contain before publication.
- Confirm the downloaded packages match and can be installed and imported.
- Bind proof of where the package came from, tags, and release evidence to the exact commit.
- Stop when either public package is missing or incomplete.

## Persona Constraints

Publication is permanent. A broken version must be deprecated and replaced,
not overwritten.

## What Maintainers Do Today

Maintainers rely on source tests and assume the package manager included build output.
