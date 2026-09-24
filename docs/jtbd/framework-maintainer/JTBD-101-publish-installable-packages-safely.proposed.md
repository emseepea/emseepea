---
status: proposed
job-id: publish-installable-packages-safely
persona: framework-maintainer
date-created: 2026-08-29
human-oversight: confirmed
oversight-date: 2026-09-02
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
- Stop when any package in the canonical public package list is missing or
  incomplete.

## Persona Constraints

Publication is permanent. A broken version must be deprecated and replaced,
not overwritten.

## What Maintainers Do Today

Maintainers rely on source tests and assume the package manager included build output.

## Story Maps

| ID | Title | Status |
|----|-------|--------|
| STORY-MAP-001 | STORY-MAP-001: Share a verified framework change safely | draft |


## Stories

| ID | Title | Status |
|----|-------|--------|
| STORY-001 | STORY-001: Qualify Each Outgoing Branch Tip Before Push | draft |
