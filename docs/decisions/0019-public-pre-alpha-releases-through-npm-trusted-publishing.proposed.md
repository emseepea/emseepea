---
status: "proposed"
date: 2026-08-27
human-oversight: confirmed
oversight-date: 2026-08-27
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
supersedes: ["ADR-0003"]
---

# Public Pre-Alpha Releases Through npm Trusted Publishing

## Context and Problem Statement

Em See Pea now has a qualified public framework slice and a green Changesets
release pull request, but the ratified release decision deliberately prohibits
npm publication. The project needs an installable pre-alpha release that proves
the public registry pipeline without publishing examples or introducing a
long-lived release credential.

## Decision Drivers

- Make the MIT framework usable through its intended public package name.
- Prove the release path against the exact commit that is published.
- Keep examples and the monorepo root private.
- Use standard Changesets, GitHub Actions, and npm capabilities.
- Minimize durable release authority and produce verifiable supply-chain evidence.
- Avoid implying stability or capability beyond the currently qualified slice.

## Considered Options

1. **Public pre-alpha releases through npm trusted publishing** - Publish only
   `@emseepea/server` from the Changesets workflow using GitHub Actions OIDC,
   automatic provenance, the `next` dist-tag, exact-commit qualification, and
   attached release evidence.
2. **Public releases through a durable npm token** - Store a reusable npm write
   token in GitHub and let the Changesets workflow publish with it.
3. **Continue release pull requests without npm publication** - Keep all
   packages private and defer registry proof.

## Decision Outcome

Chosen option: **"Public pre-alpha releases through npm trusted publishing"**,
because it proves the real adopter path while keeping release authority short
lived, workflow-specific, and independently verifiable.

Only `@emseepea/server` is publishable. The root and every example remain
private. The first public version is exactly `@emseepea/server@0.0.1` under the
`next` dist-tag; the workflow must not move `latest`. A public stable or
default-tag release requires a later decision.

Changesets creates the release pull request. Required checks pass before it is
merged, and the exact merged `main` SHA is requalified before publication.

The release workflow uses npm trusted publishing from the public
`windyroad/emseepea` repository and the exact `.github/workflows/release.yml`
workflow on a GitHub-hosted runner. Its publish job receives job-scoped
`id-token: write`; it receives no durable npm token. Trusted publishing supplies
automatic npm provenance.

Before publishing, the workflow qualifies the exact `main` commit in a clean
checkout, including build, tests, dependency audit, performance budget, package
contents, SHA-256 checksum, and CycloneDX SBOM. The GitHub release identifies
the exact commit, lockfile, supported slice, exclusions, reviews, checksum, and
SBOM. The tag and GitHub release are created only after npm confirms publication.

npm requires a package to exist before its package-scoped trusted publisher can
be configured. Any one-off first-package bootstrap must therefore be separately
reviewed once its exact least-privilege mechanism is known. It must not become a
dormant workflow fallback, and any bootstrap credential must be removed
immediately after the trusted publisher is configured and verified.

## Consequences

### Good

- Adopters can install the qualified framework through the public npm registry.
- Routine releases use no long-lived npm write secret.
- npm provenance and attached evidence bind the package to its public source and
  exact qualification run.
- `next` communicates the pre-alpha support boundary without occupying `latest`.

### Neutral

- The release workflow repeats qualification to bind evidence to the publishing
  commit.
- The first package needs one separately governed bootstrap action before OIDC
  can become the sole publisher.

### Bad

- npm publication is immutable enough that a failed post-publish evidence step
  cannot retract the version safely.
- GitHub Actions and npm become release-path dependencies.
- The first bootstrap temporarily has a different authentication path from
  routine releases.

## Confirmation

- `@emseepea/server` is public under MIT; the root and examples remain private.
- The first publication is exactly `@emseepea/server@0.0.1` under `next`.
- Changesets creates the release pull request, required checks pass before
  merge, and the exact merged SHA is requalified before publication.
- The workflow publishes only through `next`, and anonymous registry inspection
  proves `latest` was not created or changed.
- The exact publishing commit passes build, tests, audit, performance, and pack
  checks on the GitHub-hosted release runner before publication.
- npm records GitHub Actions trusted-publisher provenance for the public package.
- No `NPM_TOKEN` or other durable npm write secret is present after bootstrap.
- The GitHub release contains the exact commit, supported slice and exclusions,
  SHA-256 checksum, CycloneDX SBOM, lockfile reference, and review evidence.
- Anonymous `npm view`, exact-version `0.0.1` clean install, public import, and
  smoke execution succeed and resolve through `next`.
- The corresponding GitHub tag and release exist only after npm publication.
- `SECURITY.md`, `SUPPORT.md`, and `CONTRIBUTING.md` state the public boundaries.

## Pros and Cons of the Options

### Public pre-alpha releases through npm trusted publishing

- Good: Uses short-lived, workflow-bound credentials and automatic provenance.
- Good: Proves the actual install path with precise pre-alpha claims.
- Bad: Requires a one-off package-creation bootstrap and OIDC-capable runners.

### Public releases through a durable npm token

- Good: Can create the first package and works with the standard action example.
- Bad: Leaves reusable write authority in repository secrets and weakens the
  intended supply-chain boundary.

### Continue release pull requests without npm publication

- Good: Adds no registry authority or publication risk.
- Bad: Leaves the framework unavailable through its chosen package identity and
  does not prove the end-to-end release pipeline.

## Reassessment Criteria

Reassess before moving `latest`, declaring a stable release, publishing another
package, changing CI provider or workflow filename, using a self-hosted runner,
or accepting a release mechanism that cannot provide exact-commit evidence and
trusted-publisher provenance.
