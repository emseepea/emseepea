---
status: "proposed"
date: 2026-08-31
human-oversight: confirmed
oversight-date: 2026-08-31
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-30
---

# GitHub Pages Website Hosting

## Context and Problem Statement

The static Em See Pea website needs a public host. The project already uses
GitHub for source and automated checks.

## Decision Drivers

- Use existing project infrastructure.
- Deploy only checked repository content.

## Considered Options

1. **GitHub Pages** - Host static output through the existing GitHub repository.
2. **Another static host** - Add a separate hosting service.

## Decision Outcome

Chosen option: **"GitHub Pages"**, because it fits the existing repository workflow.

Use **GitHub Pages** to host the one Em See Pea website.

The publication workflow uses pinned action revisions, minimum permissions,
and the checked repository revision. Pull-request checks receive no deployment
credentials. Hosting selection does not claim that deployment has happened or
that publication requirements have passed.

## Consequences

### Good

- Hosting fits the existing repository workflow.

### Neutral

- Website publication becomes another checked public output.

### Bad

- GitHub Pages limits may constrain future hosting needs.

## Confirmation

- Only checked static output is deployed from the selected revision.
- Workflow actions are pinned and permissions are limited to their tasks.
- Pull requests cannot access deployment credentials.
- Guide checks and the website performance gate pass before publication.

## Pros and Cons of the Options

### GitHub Pages

- Good: Uses existing project infrastructure.
- Bad: Subject to its hosting limits.

### Another static host

- Good: May offer different hosting features.
- Bad: Adds another service to maintain.

## Reassessment Criteria

Revisit if GitHub Pages cannot meet an accepted static-hosting requirement.

## Related Decisions

- [static only website runtime](0032-static-only-website-runtime.proposed.md)
- [verified guides before website publication](0035-verified-guides-before-website-publication.proposed.md)
- [measured website performance before publication](0038-measured-website-performance-before-publication.proposed.md)
