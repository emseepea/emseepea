---
status: "proposed"
date: 2026-08-26
human-oversight: confirmed
oversight-date: 2026-08-26
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-26
---

# Public Windy Road Repository with Gated Changesets Releases

## Context and Problem Statement

Em See Pea is a public Windy Road product, but source visibility,
package publication, and a trustworthy release are different events. The
repository needs a simple contribution and release boundary that validates
clean checkouts without accidentally publishing unfinished packages.

The framework implementation remains clean-room. Generic Changesets and GitHub
Actions process may reuse Windy Road's established public repository
conventions; it is not implementation evidence and carries no product code.

## Decision Drivers

- Public ownership by Windy Road Technology.
- MIT-licensed reuse with low adopter friction.
- Clean-checkout quality evidence before publication.
- Explicit separation between public source and npm release authority.
- Standard release tooling instead of a bespoke orchestrator.
- Least-privilege, supply-chain-conscious automation.
- Frequent small commits and pushes with visible CI feedback.

## Considered Options

1. **Public repository with private packages and gated Changesets release PRs**
   - Publish source under MIT now, keep packages private, and use standard CI and
   release-PR automation without npm publication.
2. **Public repository without release automation** - Publish the source under
   MIT but defer Changesets and release workflows.
3. **Immediate public npm publication** - Make packages publishable and release
   them as soon as the repository becomes public.

## Decision Outcome

Chosen option: **"Public repository with private packages and gated Changesets release PRs"**, because it makes development and quality evidence public while preserving an explicit later decision for registry identity and publication.

The authoritative repository is public `windyroad/emseepea`. The repository is
MIT licensed. Public source visibility does not authorize npm publication. The
root remains private and `@windyroad/emseepea` remains unpublished until its
support boundary, provenance, and publication permissions are reviewed.

GitHub Actions is the required clean-checkout quality gate. The matrix covers
Node.js 22 and 24 and runs the repository's build, tests, dependency audit, and
other committed qualification checks. Two workflows are sufficient: quality
and release. No task runner or custom release orchestrator is introduced.

Changesets creates and updates the release PR. While packages are private, the
release workflow versions packages and maintains the release PR but has no
publish command or registry credential. Enabling npm publication requires a
new reviewed decision and must occur only after required checks pass.

Third-party Actions are pinned to immutable commits and receive least-privilege
permissions. Required branch checks protect the release path. Work proceeds in
small coherent commits that are pushed frequently enough for Actions to provide
useful feedback, without committing known broken intermediate states.

## Consequences

### Good

- Source, issues, CI evidence, and release preparation are publicly reviewable.
- MIT permits broad adoption and modification.
- A merged release PR cannot silently become npm publication.
- Standard Actions and Changesets keep custom release code at zero.

### Neutral

- Package versions may advance in release PRs before packages are publishable.
- Generic release-process conventions are outside the clean-room product-code
  boundary.

### Bad

- Branch-protection configuration is external state that must be verified after
  repository creation.
- MIT provides no explicit patent grant beyond its licence text.
- Deferring registry identity means the public repository initially has no
  installable npm release.

## Confirmation

- GitHub identifies `windyroad/emseepea` as public with `main` as its default branch.
- The repository includes the exact MIT licence text and public contribution, security, and support boundaries.
- Clean GitHub-hosted checkouts pass quality jobs on Node.js 22 and 24.
- Workflow dependencies use immutable pins and least-privilege permissions.
- The Changesets workflow creates or updates a release PR on `main`.
- No workflow can publish to npm while packages are private, no publish command is configured, and no registry credential is provided.
- Required checks protect `main` before a publishing path is ever enabled.

## Pros and Cons of the Options

### Public repository with private packages and gated Changesets release PRs

- Good: Separates transparent development from package publication.
- Good: Exercises the intended release mechanism before registry launch.
- Bad: Maintains release metadata for packages that cannot yet publish.

### Public repository without release automation

- Good: Has fewer initial files and no write-capable workflow.
- Bad: Defers validation of an explicitly required release-PR process.

### Immediate public npm publication

- Good: Produces an immediately installable framework.
- Bad: Forces package identity and support promises before full qualification.

## Reassessment Criteria

Reassess when the first package is ready for npm, registry identity or trusted
publishing is chosen, the supported Node.js matrix changes, or the standard
Changesets release-PR workflow cannot meet a demonstrated release requirement.
