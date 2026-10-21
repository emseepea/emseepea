---
status: "proposed"
date: 2026-10-22
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "Jobs To Be Done review"]
informed: []
reassessment-date: 2027-01-22
---

# Choose Unused npm Versions Automatically

This proposal guides implementation. Final human approval and successful use
in a real release remain outstanding, so this decision is not accepted.

## Context and Problem Statement

A release can publish packages to npm under the `next` tag and then fail
verification. npm permanently reserves each published package version.
The same package cannot later publish different contents under that version.

Changesets calculates versions from source manifests and queued changes.
It does not account for versions consumed by abandoned attempts. Another
attempt can consequently reuse those numbers, publish only the remaining
packages, and fail because the packages came from different commits.

An earlier draft proposed manually recording the history of each abandoned
attempt. That does not help choose a number that has never been published.
The normal generator already has the plan and can read npm itself.

## Decision Drivers

- Complete releases after abandoned attempts without manual recovery records.
- Preserve release intent reviewed and qualified on the source commit.
- Keep generation and verification consistent when npm changes afterward.
- Prevent conflicting versions from producing another partial publication.
- Preserve the existing package, provenance, promotion and merge-back checks.

## Considered Options

1. **Choose unused versions automatically** during ordinary generation.
2. **Prepare manual recovery records** for each abandoned attempt.
3. **Stop on occupied versions** and leave maintainers to repair the plan.

## Decision Outcome

Chosen option: **choose unused versions automatically**.

For each changed public package, the generator checks which npm versions
already exist. If the planned version is occupied, it takes the first unused
patch on the same major and minor version line. Private packages and packages
without a planned release keep their ordinary versioning behaviour.

The generator records changed selections alongside the existing source commit
and Quality run in `.release/origin.json`. Each entry lists the original target,
the consecutive occupied versions skipped, and the selected version.
Verification checks the structure of those selections against the source plan,
then checks generated manifests and lockfile against that fixed plan.
It does not independently prove historical occupancy or select new versions
from a later registry snapshot.

The readiness review continues to cover the ordinary source plan. Generated
selections map those targets to actual package versions; the normal release
checks verify those actual versions.

Immediately before publication, the existing registry check rejects any changed
package version already published from another commit. A retry of the same
candidate may reuse its own versions. Unchanged historical packages retain
their normal verification. Abandoned artifacts are neither reused nor promoted
merely because they consumed a version number.

## Consequences

### Good

- Maintainers can rerun release generation without constructing recovery records
  or editing generated package manifests.
- One checked candidate supplies the changed packages.
- Conflicting occupied versions are detected before any additional publication.
- Integrity, signatures, provenance, installation, promotion and merge-back
  checks still verify the actual selected versions.

### Neutral

- Abandoned versions remain in npm history.
- Patch numbers can be skipped when earlier attempts consumed them.

### Bad

- Generation requires readable npm metadata and stops on unavailable or
  malformed responses.
- Concurrent publication can consume a selected version. The prepublication
  check stops the attempt; regeneration selects unused versions again.

## Confirmation

- Real generation encounters versions consumed by an abandoned attempt and
  automatically selects unused patches on the intended version lines.
- Generated manifests, dependency pins, changelogs and lockfile agree with the
  candidate's fixed selections.
- Invalid selections and conflicting published versions are rejected before
  publication; retries of the same candidate remain supported.
- The replacement passes the existing Quality, semantic, registry, signatures,
  provenance, downloaded-package, promotion and merge-back checks.
- Selected packages reach `latest`, and independent installation verifies their
  versions and source commits. Local fixtures and staging alone do not prove
  successful production use.

## Pros and Cons of the Options

### Choose unused versions automatically

- Good: fixes ordinary generation and keeps repeated releases self-service.
- Good: preserves one generated plan for verification.
- Bad: needs registry access when generating a candidate.

### Prepare manual recovery records

- Good: explicitly describes each abandoned artifact's history.
- Bad: requires manual reconstruction unrelated to choosing unused numbers.
- Bad: adds another workflow that can itself block release.

### Stop on occupied versions

- Good: prevents conflicting publication with a small existing check.
- Bad: leaves the release blocked until someone chooses replacement versions.

## Reassessment

Reassess if Changesets handles occupied versions itself, npm changes version
immutability, or real releases show automatic allocation cannot preserve the
reviewed intent and publication checks.
