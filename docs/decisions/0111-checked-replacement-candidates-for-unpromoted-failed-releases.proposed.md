---
status: "proposed"
date: 2026-10-06
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "Jobs To Be Done review"]
informed: []
reassessment-date: 2027-01-06
---

# Checked Replacement Candidates for Unpromoted Failed Releases

Captured via /wr-architect:capture-adr. This substance was derived from the
recovery investigation and awaits human review. It is not an accepted decision.

## Context and Problem Statement

A release merge can reach the publish branch before its exact head qualifies.
The promotion verifier then stops it without changing latest tags. The trunk
still holds pending changesets, but the next release is blocked because the
failed publish head has not been merged back. Immutable versions published by
an earlier candidate cannot be republished from a replacement commit.

[Publish on Merge to a Publish Branch](0098-publish-on-merge-to-a-publish-branch.proposed.md)
keeps version changes off the trunk until publication succeeds. Recovery must
preserve that boundary rather than satisfy an ancestry check by merging an
unpublished release back early.

## Decision Drivers

- Keep the trunk and latest tags unchanged until a checked release succeeds.
- Preserve consumed versions and their exact-source provenance.
- Preserve failed publish history without publishing its unchecked tree.
- Use one release plan for generation, readiness and verification.

## Considered Options

1. **Checked replacement candidate**: replace an unpromoted failed candidate
   with a fresh planned package set whose checked tree retains publish history.
2. **Abandonment reconciliation**: revert the failed publish tree and merge its
   history back before publication.
3. **Keep the failed state**: leave promotion blocked without a recovery path.

## Decision Outcome

Chosen option: **checked replacement candidate**, because it permits recovery
without importing unpublished version changes into the trunk or reusing
immutable versions from another source.

A replacement is eligible only when the exact failed publish merge and its
unpromoted package set are independently verified. Its complete tree must
match the release plan generated from a checked source. Its ancestry retains
the failed publish head, while every changed public package receives a fresh
version on its actual planned version line. The replacement qualifies and
publishes under next before it can be promoted. Normal merge-back remains
after successful publication, including any planned website deployment.

This adds a bounded recovery case to the existing release shape. It does not
permit ignoring ancestry, provenance, source qualification or website-byte
binding for ordinary releases.

## Consequences

### Good

- An unpromoted failed merge can recover without stranding the trunk.
- One exact head owns the replacement package set and its evidence.
- Failed history and consumed versions remain inspectable.

### Neutral

- Ordinary releases retain their existing generation and promotion path.

### Bad

- Recovery adds a second eligible ancestry shape that must fail closed.
- Abandoned versions remain available to consumers who selected them directly.
- A concurrent promotion or source update invalidates the recovery evidence.

## Confirmation

- A replacement preserves the generated source tree and failed publish ancestry.
- No replacement begins when any abandoned version has reached latest.
- Every changed public package has a fresh immutable version from the same
  qualified replacement head, without claiming an artificial major change.
- Registry, semantic, initializer and guide checks bind to that exact head.
- The website deploys the measured checked-source artifact, without rebuilding.
- The trunk receives the replacement version changes only after publication.

## Pros and Cons of the Options

### Checked replacement candidate

- Good, because the publication-before-merge-back boundary remains intact.
- Bad, because recovery needs independently checked ancestry and version inputs.

### Abandonment reconciliation

- Good, because it could reuse the ordinary ancestry check afterward.
- Bad, because it changes the existing prohibition on early merge-back.

### Keep the failed state

- Good, because no additional publication authority is introduced.
- Bad, because the verified release remains unavailable through latest.

## Reassessment Criteria

Reassess if recovery permits a mixed-source package set, accepts a promoted
failed candidate, changes normal release behavior, or repeatedly needs manual
tree reconciliation. Reassess by 2027-01-06 even if none of these occurs.
