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

# Verified Guides Before Website Publication

## Context and Problem Statement

A guide can look correct while its commands fail or its package version is
unavailable. Readers need instructions checked against what they can install.

## Decision Drivers

- Prove documented commands work outside the monorepo.
- Keep published instructions aligned with npm packages.
- Preserve accessibility and plain-language checks.

## Considered Options

1. **Executable guide checks** - Test instructions before merge and before publication.
2. **Manual review alone** - Review prose without running documented paths.

## Decision Outcome

Chosen option: **"Executable guide checks"**, because readers need commands proven against installable packages.

Before merge, build the site and run guides against packed source packages in
a clean temporary consumer project. Before publication, repeat the guide paths
against the exact public package versions readers will install.

Use small guide metadata to identify the example and packages. Extract only
marked runnable blocks, or test the canonical source they link to. Do not run
commands found in ordinary prose or create a new snippet language.

Missing packages, stale mappings, failed commands or examples, unchecked
snippets, and broken links stop publication. Clearly label source-only pages;
do not present unreleased behavior as available from npm.

Reuse existing Playwright, axe-core, clean-copy, and cognitive-accessibility
checks. Automated scans supplement, rather than replace, manual accessibility
and plain-language review.

## Consequences

### Good

- Readers get instructions tested against installable packages.

### Neutral

- Guide metadata and tests become maintained content.

### Bad

- Publication waits when any required package or check is unavailable.

## Confirmation

- Build and guide checks pass on clean Node.js 22 and 24 checkouts.
- Routes, links, fragments, assets, canonical URLs, and sitemap checks pass.
- Every runnable snippet is extracted and tested or links to tested source.
- Every page passes automated accessibility checks in light and dark themes.
- Named manual evidence covers keyboard use, focus, screen-reader output, 320 CSS pixel reflow, 400% zoom, forced colors, reduced motion, contrast, search, navigation, and code copying.
- Every changed public page receives cognitive-accessibility review.
- Published guide tests use the exact npm versions named to readers.

## Pros and Cons of the Options

### Executable guide checks

- Good: Catch broken instructions and version drift.
- Bad: Add test and publication time.

### Manual review alone

- Good: Less automation to maintain.
- Bad: Cannot prove commands and examples run.

## Reassessment Criteria

Revisit the checking mechanism if it cannot verify a documented path; do not
remove the requirement for current, working instructions.

## Related Decisions

- [one source for reader guides](0034-one-source-for-reader-guides.proposed.md)
- [mandatory cognitive accessibility review for published content](0023-mandatory-cognitive-accessibility-review-for-published-content.proposed.md)
