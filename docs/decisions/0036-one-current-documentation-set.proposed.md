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

# One Current Documentation Set

## Context and Problem Statement

The first website does not yet need several simultaneously supported sets of
instructions. Duplicated version trees would add maintenance and reader choices.

## Decision Drivers

- Keep the first reader journey simple.
- Avoid maintaining unsupported documentation versions.

## Considered Options

1. **One current set** - Document the currently supported release path.
2. **Versioned sets now** - Maintain separate documentation trees immediately.

## Decision Outcome

Chosen option: **"One current set"**, because multiple supported documentation versions are not yet needed.

Publish one current documentation set initially. Add versioned sets only when
two incompatible releases must be supported at the same time.

This does not permit stale instructions: current pages still identify the
package versions they describe and pass the guide checks.

## Consequences

### Good

- Readers do not need to choose among unnecessary versions.

### Neutral

- Older material remains available through repository history.

### Bad

- Concurrent incompatible releases would require a documentation migration.

## Confirmation

- The initial site has one maintained current guide set.
- Pages and runnable guides agree on the supported package versions.
- Simultaneous incompatible support triggers reassessment before release.

## Pros and Cons of the Options

### One current set

- Good: Less maintenance and reader ambiguity.
- Bad: Not enough for concurrent incompatible releases.

### Versioned sets now

- Good: Ready for several supported releases.
- Bad: Adds duplicate maintenance before it is needed.

## Reassessment Criteria

Revisit when two incompatible releases need simultaneous support.

## Related Decisions

- [verified guides before website publication](0035-verified-guides-before-website-publication.proposed.md)
