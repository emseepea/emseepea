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

# Website Workspace in the Existing Monorepo

## Context and Problem Statement

Website dependencies must not become dependencies of applications built with
Em See Pea. Keeping website code near examples also helps maintainers update
guides and implementation together.

## Decision Drivers

- Keep website tooling out of published framework packages.
- Update guides and examples in one repository.

## Considered Options

1. **Website workspace in this monorepo** - Separate package configuration within the existing repository.
2. **Separate repository** - Maintain website code and releases elsewhere.
3. **Inside the server package** - Mix website and framework packaging.

## Decision Outcome

Chosen option: **"Website workspace in this monorepo"**, because it keeps website tooling separate from published packages.

Create one `website` workspace alongside the framework packages in the existing
monorepo. This is **the only Em See Pea website**, not an additional site or
repository.

Set its package to `private: true` to prevent npm publication. Its source remains
public and MIT-licensed. No published framework package depends on the website.

## Consequences

### Good

- Website and example changes can be reviewed together.

### Neutral

- The root build coordinates another workspace.

### Bad

- Maintainers must keep workspace dependencies from leaking into public packages.

## Confirmation

- The website has its own package manifest with `private: true`.
- No published package depends on the website workspace.
- Website source and examples remain in the same public MIT repository.

## Pros and Cons of the Options

### Website workspace in this monorepo

- Good: Shared review and checks.
- Bad: Adds a workspace to root orchestration.

### Separate repository

- Good: Independent maintenance.
- Bad: Guide and implementation updates can drift.

### Inside the server package

- Good: Fewer package manifests.
- Bad: Website dependencies can reach adopters.

## Reassessment Criteria

Revisit if website ownership or release needs require repository separation.

## Related Decisions

- [static documentation website with astro starlight](0025-static-documentation-website-with-astro-starlight.proposed.md)
