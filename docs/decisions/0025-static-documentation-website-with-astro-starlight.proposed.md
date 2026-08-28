---
status: "proposed"
date: 2026-08-28
human-oversight: pending
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-28
---

# Static Documentation Website with Astro Starlight

## Context and Problem Statement

Em See Pea needs a public website with comprehensive documentation, examples,
and getting-started guides. Those guides must stay aligned with the packages
people actually install.

The repository already contains Markdown documentation, runnable examples,
Playwright, axe-core, cognitive-accessibility review, and clean-copy tests. It
does not have a documentation website, search, or one clear home for
reader-facing guides.

## Decision Drivers

- Give readers clear navigation, local search, readable code examples, and good
  mobile behavior.
- Meet WCAG 2.2 Level AA without building a documentation interface from
  scratch.
- Keep one source for each guide instead of maintaining website copies.
- Check commands, links, examples, and package versions before publication.
- Keep the website separate from the framework packages and their runtime.
- Publish static files with no server, database, sign-in, analytics, or secrets.
- Avoid documentation versioning until incompatible releases are supported at
  the same time.

## Considered Options

1. **Astro Starlight** - Use a private website workspace, Markdown-first
   content, Starlight's documentation layout, and built-in local search.
2. **Docusaurus** - Use a React documentation framework with built-in support
   for maintaining several documentation versions.
3. **Hand-built static website** - Generate and style the site with project code
   and own its navigation, search, responsive behavior, and accessibility.
4. **Repository Markdown only** - Keep GitHub as the only documentation reader.

## Decision Outcome

Chosen option: **"Astro Starlight"**, because it is the smallest maintained
option that supplies the documentation navigation and search Em See Pea needs
without making the project maintain another web framework.

The monorepo gains one private `website` workspace. It pins Astro and Starlight
as development dependencies and produces static files only. GitHub Pages hosts
those files from a qualified repository revision.

The website uses Starlight defaults, local search, Markdown, the Em See Pea logo,
and a small stylesheet for brand colors and spacing.

The first version does not add interactive documentation components, analytics,
cookies, sign-in, runtime secrets, API routes, server-side rendering, or custom
Starlight theme components.

`website/src/content/docs` is the source for reader-facing guides. Root, package,
and example READMEs remain short entry points and link to the relevant website
page. Governance records may remain in `docs` and need not appear in the main
reader journey.

Each runnable guide has a small metadata block that names the example and public
packages it needs. Documentation checks verify site commands, local links, and
referenced examples. They only parse known command blocks; they do not run
commands copied from ordinary prose.

A runnable snippet appears once: either as a marked guide code block that the
clean consumer test extracts and runs, or as a link to a canonical source file.
An unchecked copied snippet stops publication. The existing documentation checks
provide this control; the website adds no snippet language or generator.

Pull-request checks build the site and run its guides against packed packages
from the current source in a clean temporary consumer. Public deployment runs
the same guide paths against the exact public package versions readers will
install. A missing package, stale guide mapping, failed command, broken link, or
failed example stops publication. Source-only pages are clearly labelled and
are not presented as released package behavior.

The first site publishes one current documentation set. Versioned copies are
added only when two incompatible releases must be supported at the same time.
Search remains local unless site scale demonstrates a need for a hosted service.

## Consequences

### Good

- Readers get a purpose-built documentation experience with local search.
- Static pages remain useful when client-side JavaScript fails.
- One canonical guide avoids hand-maintained website copies.
- The site is isolated from framework runtime packages.
- Existing Playwright, axe-core, clean-copy, and cognitive-accessibility checks
  can cover the new publication surface.

### Neutral

- Astro and Starlight become pinned development dependencies.
- Reader-facing guides move into the website content tree.
- GitHub Pages becomes another public release surface.
- The first measured build records page weight; no performance claim is made
  before that evidence exists.
- A separate website performance budget must be measured and ratified before
  public deployment.

### Bad

- Starlight is currently pre-1.0 and may require careful upgrades.
- The site adds dependency updates, build time, and browser checks.
- Starlight defaults still require independent accessibility testing.
- Exact-package guide checks add work to the release path.

## Confirmation

- The website is a private workspace. No published package depends on it.
- A clean Node.js 22 and 24 checkout builds the static site.
- The build uses no server adapter, API route, runtime secret, analytics, or cookie.
- Automated checks pass for routes, links, fragments, assets, canonical URLs, and
  the sitemap.
- Every generated page passes Playwright and axe checks in light and dark themes.
- Before publication, named evidence exists for keyboard use, focus, screen
  reader output, 320 CSS pixel reflow, 400% zoom, forced colors, reduced motion,
  contrast, search, navigation, and code copying.
- Every changed public page has a named cognitive-accessibility review result.
- Runnable guides pass in a clean consumer project against packages built from
  the current source before merge.
- Every runnable snippet is either extracted and tested from its guide or links
  to a canonical source file. Unchecked copies stop publication.
- Deployment repeats guide checks against the same public package versions
  readers will install.
- Publication stops when any required package or check is unavailable.
- The GitHub Pages workflow uses fixed action revisions, least permissions, no
  pull-request deployment credentials, and only the checked revision.
- Compressed HTML, CSS, JavaScript, browser processing time, and memory are
  measured from the first build. Public deployment waits for a separately
  ratified website performance budget based on that evidence.

## Pros and Cons of the Options

### Astro Starlight

- Good: Static, Markdown-first, searchable, and focused on documentation.
- Bad: Pre-1.0 dependency with its own upgrade and test burden.

### Docusaurus

- Good: Mature React tooling for versioned documentation and larger community
  sites.
- Bad: Adds a larger client and dependency surface before those features are
  needed.

### Hand-Built Static Website

- Good: Full control with no documentation framework.
- Bad: The project must build and maintain navigation, search, responsive
  behavior, and accessibility itself.

### Repository Markdown Only

- Good: No new build or hosting system.
- Bad: Does not provide the requested website, search, or guided reader journey.

## Reassessment Criteria

Reassess when Starlight reaches a breaking upgrade, accessibility checks find a
framework limitation, two incompatible releases need simultaneous support,
local search becomes too slow, a custom interactive documentation need is
accepted, or GitHub Pages no longer meets the static-hosting requirement.
