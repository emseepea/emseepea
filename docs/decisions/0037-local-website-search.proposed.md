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

# Local Website Search

## Context and Problem Statement

Readers need to find documentation without adding a hosted search service.
The site generator provides a local-search path.

## Decision Drivers

- Make guides searchable.
- Avoid a separate search service and its credentials.

## Considered Options

1. **Local search** - Build a search index with the site and query it in the browser.
2. **Hosted search** - Use an external search service.

## Decision Outcome

Chosen option: **"Local search"**, because it avoids adding a hosted search service.

Use local search for the first website. Keep the index with the static output;
do not add hosted search credentials or a search backend.

Reconsider hosted search only when measured site scale shows local search no
longer meets reader needs.

## Consequences

### Good

- Search needs no external service account.

### Neutral

- The browser downloads and processes the local index.

### Bad

- A large index can increase page resources and search time.

## Confirmation

- Search uses the built site index without hosted search credentials.
- Keyboard and screen-reader users can operate search.
- Search works for the published guide content.
- Index size and browser work are included in website performance measurements.

## Pros and Cons of the Options

### Local search

- Good: No hosted service to operate.
- Bad: Index cost grows with content.

### Hosted search

- Good: Can handle larger collections.
- Bad: Adds another service and data flow.

## Reassessment Criteria

Revisit when measured content scale makes local search unsuitable.

## Related Decisions

- [static documentation website with astro starlight](0025-static-documentation-website-with-astro-starlight.proposed.md)
- [measured website performance before publication](0038-measured-website-performance-before-publication.proposed.md)
