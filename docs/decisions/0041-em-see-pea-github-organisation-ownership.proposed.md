---
status: "proposed"
date: 2026-09-01
human-oversight: confirmed
oversight-date: 2026-09-01
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-01
supersedes: ["ADR-0016"]
---

# Em See Pea GitHub Organisation Ownership

## Context and Problem Statement

Em See Pea now has its own GitHub organisation. Tom Howard created the
organisation and transferred the public repository from `windyroad/emseepea`
to `emseepea/emseepea`. The authoritative source, website, package metadata,
and trusted-publishing identity must agree with that ownership change.

## Decision Drivers

- Give the open-source product one clear identity on GitHub and npm.
- Preserve package names, release controls, history, licences, and provenance.
- Keep existing links working through GitHub redirects while correcting current guidance.
- Prevent the next trusted npm release from failing because its repository moved.

## Considered Options

1. **Em See Pea organisation ownership** - Use `emseepea/emseepea` as the
   authoritative repository and keep the `@emseepea` npm scope.
2. **Windy Road organisation ownership** - Move the repository back to
   `windyroad/emseepea` while retaining the `@emseepea` npm scope.

## Decision Outcome

Chosen option: **"Em See Pea organisation ownership"**, because the product
now has a dedicated public organisation and the owner has completed the
transfer.

The authoritative repository is `emseepea/emseepea`. The public website is
served from `https://emseepea.github.io/emseepea/`. Future npm releases use
repository metadata and trusted publishing tied to `emseepea/emseepea`.

All other product identity decisions remain unchanged: public packages use the
`@emseepea` scope, the runtime package is `@emseepea/server`, the testing
package is `@emseepea/testing`, examples remain in the monorepo, and all source
and examples remain open source under MIT.

Existing release attestations, tags, changelogs, and historical evidence keep
their original repository identity. They are immutable records, not current
configuration.

## Consequences

### Good

- GitHub, npm, and the product name now share one public identity.
- Repository, website, issue, and source links become easier to predict.
- The organisation can use the approved Em See Pea brand independently.

### Neutral

- GitHub redirects preserve old repository links.
- Existing npm versions continue to show the repository recorded when they were published.

### Bad

- Current source links, package metadata, Pages settings, and npm trusted
  publishers must be updated together.
- Future package versions are required before npm displays the new repository metadata.

## Confirmation

- GitHub identifies `emseepea/emseepea` as the public authoritative repository.
- The organisation and repository use the approved name, mark, description, and website.
- GitHub Pages serves the website from `https://emseepea.github.io/emseepea/`.
- Active source, documentation, tests, package manifests, and Changesets use the new repository.
- Both public packages trust `.github/workflows/release.yml` in `emseepea/emseepea`.
- A release from the transferred repository passes exact-revision checks and npm provenance verification.
- Existing releases and historical records are not rewritten.

## Pros and Cons of the Options

### Em See Pea Organisation Ownership

- Good: Aligns the source, package scope, website, and product identity.
- Bad: Requires one coordinated transfer correction and patch release.

### Windy Road Organisation Ownership

- Good: Requires no change to earlier repository ownership assumptions.
- Bad: Keeps GitHub and npm identities split and reverses the completed transfer.

## Reassessment Criteria

Reassess if organisation ownership changes, GitHub Pages moves to another host,
or the npm scope changes.
