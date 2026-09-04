---
status: "proposed"
date: 2026-09-04
human-oversight: confirmed
oversight-date: 2026-09-04
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-04
supersedes: ["0035-verified-guides-before-website-publication"]
---

# Single Full Initializer Qualification Per Continuous Integration Event

## Context and Problem Statement

The full standalone qualification of all eight initializer packages takes about
29 minutes. Running it in both Node.js matrix entries duplicates expensive npm
installation work without adding useful language-model evidence. Live semantic
evaluation already runs once in its own release job.

## Decision Drivers

- Preserve fast compatibility evidence on every supported Node.js version.
- Preserve full standalone qualification for every initializer before merge and publication.
- Run live language-model evaluation once per release revision.
- Avoid duplicate registry and package-install work.
- Keep publication blocked when any required qualification fails.

## Considered Options

1. **Fast Node matrix plus one full Node 24 initializer job** - Run ordinary compatibility checks on Node.js 22 and 24, and run the full eight-initializer qualification once on Node.js 24.
2. **Full initializer qualification on both Node versions** - Keep the existing duplicated package-install journey in both matrix entries.
3. **Remove standalone initializer qualification** - Rely on unit tests and post-publication checks only.

## Decision Outcome

Chosen option: **"Fast Node matrix plus one full Node 24 initializer job"**, because supported-runtime compatibility and standalone package qualification are different evidence and do not need the same matrix.

Pull requests run the fast test suite on Node.js 22 and 24 and the unchanged
full initializer suite once on Node.js 24. Main-branch website and package
publication workflows use the same split. Each publication explicitly depends
on its dedicated initializer job.

Before merge, the website and guide checks still run against packed source
packages in clean temporary projects. Before publication, guide paths still run
against the exact public package versions readers install. Broken commands,
links, fragments, routes, accessibility checks, or package mappings stop the
relevant publication.

The live Claude semantic evaluation remains a separate single job. The
deterministic semantic smoke test remains part of each generated project's full
initializer qualification.

## Consequences

### Good

- Each workflow performs the expensive eight-initializer journey once instead of once per Node.js version.
- Supported Node.js versions still receive ordinary compatibility coverage.
- Publication still stops if any initializer fails to generate, install, lint, test, or pass semantic smoke checks.

### Neutral

- CI reports initializer qualification as a separate job.
- Node.js 22 compatibility is established by the fast suite rather than a second full clean install of every initializer.

### Bad

- A problem unique to installing a generated initializer on Node.js 22 could be found later than an ordinary Node.js 22 compatibility problem.

## Confirmation

- Pull-request and main-branch Node.js matrix jobs run on Node.js 22 and 24 without the full eight-initializer test.
- One Node.js 24 job per CI event runs the unchanged full initializer test against the canonical package list.
- Website and package publication explicitly depend on their dedicated initializer jobs succeeding.
- The full initializer test still checks generation, standalone dependencies, installation, lint, ordinary tests, semantic smoke tests, and expected tool selection.
- Live Claude semantic evaluation runs once per publication revision.
- Post-publication verification still checks the actual registry packages and documented npm initializer commands.
- Routes, links, fragments, assets, canonical URLs, and sitemap checks pass.
- Every runnable snippet is tested or links to tested source.
- Automated accessibility checks pass in light and dark themes.
- Named manual accessibility evidence and cognitive-accessibility review remain required.

## Pros and Cons of the Options

### Fast Node matrix plus one full Node 24 initializer job

- Good: Preserves distinct evidence while removing the largest duplicated cost.
- Bad: Does not repeat every clean initializer installation on Node.js 22.

### Full initializer qualification on both Node versions

- Good: Repeats the complete journey on both supported versions.
- Bad: Doubles a slow network-bound check and delays feedback.

### Remove standalone initializer qualification

- Good: Produces the shortest CI duration.
- Bad: Cannot prove generated packages work outside the monorepo before publication.

## Reassessment Criteria

Revisit this decision if supported-version compatibility failures escape the
fast matrix, Node.js 24 stops being the current release runtime, or the full
initializer suite becomes fast enough that duplication has negligible cost.

## Related Decisions

- [verified guides before website publication](0035-verified-guides-before-website-publication.superseded.md)
- [separate example initializer packages](0042-separate-example-initializer-packages.proposed.md)
- [model-selected tool semantic tests](0040-model-selected-tool-semantic-tests.proposed.md)
