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

# Astro Starlight Documentation Generator

## Context and Problem Statement

Em See Pea needs its first website: documentation, examples, and getting-started
guides. A maintained documentation generator can supply navigation and readable
pages without custom application code.

## Decision Drivers

- Clear navigation and readable code examples.
- Good mobile behavior and accessible defaults.
- Little custom website code.

## Considered Options

1. **Astro Starlight** - Documentation-focused layouts and Markdown content.
2. **Docusaurus** - React-based documentation with versioning features.
3. **Hand-built site** - Own the layout, navigation, and build code.
4. **Repository Markdown only** - Keep GitHub as the only reading experience.

## Decision Outcome

Chosen option: **"Astro Starlight"**, because it supplies documentation layouts with little custom code.

Use **Astro Starlight** for the documentation generator. Its documentation
features fit the requested site without a custom interface.

Use the default components, Markdown, existing brand assets, and a small brand
stylesheet. Custom theme components and interactive documentation widgets are
outside the initial scope. This choice does not select hosting or repository
layout; those have their own records.

## Consequences

### Good

- Maintained documentation components reduce custom interface work.

### Neutral

- Astro and Starlight need pinned versions and ongoing dependency review.

### Bad

- Defaults still need independent accessibility checks; upgrades can affect the site.

## Confirmation

- A clean Node.js 22 and 24 checkout builds the site.
- The site uses the existing brand and accessibility requirements.
- No custom theme components are introduced without a demonstrated need.

## Pros and Cons of the Options

### Astro Starlight

- Good: Documentation-focused defaults.
- Bad: Its upgrades require compatibility checks.

### Docusaurus

- Good: Supports larger React documentation sites.
- Bad: Adds features not needed for the first site.

### Hand-built site

- Good: Full layout control.
- Bad: We must maintain navigation and accessibility ourselves.

### Repository Markdown only

- Good: No new build tooling.
- Bad: Does not deliver the requested website experience.

## Reassessment Criteria

Revisit if upgrades, accessibility defects, or accepted reader needs make
Starlight unsuitable.

## Related Decisions

- [website workspace in the existing monorepo](0031-website-workspace-in-the-existing-monorepo.proposed.md)
- [github pages website hosting](0033-github-pages-website-hosting.proposed.md)
