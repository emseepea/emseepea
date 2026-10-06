---
status: "proposed"
date: 2026-10-07
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
supersedes: ["ADR-0106"]
reassessment-date: 2027-01-07
---

# Range-Bound Docs-Only Local Push Qualification

> Captured via /wr-architect:capture-adr. Substance was derived from the
> session's decision context and awaits human ratification.

## Context and Problem Statement

A push containing only retrospective and operational Markdown was blocked by
an unavailable local Docker daemon. The existing local gate ran all runtime
tests despite no runtime, dependency, or configuration change. Tom requested
a docs-only route so documentation work does not depend on Docker.

## Decision Drivers

- Avoid runtime testing for a narrowly defined operational-documentation change.
- Keep qualification tied to the exact commit and the actual outgoing range.
- Retain full qualification for changes outside that narrow boundary.
- Preserve the existing remote Quality and release controls.

## Considered Options

1. **Range-bound docs-only local qualification**: check eligible documentation
   without runtime tests; keep full local checks for all other changes.
2. **Always run full local qualification**: retain the previous policy,
   including its dependency on Docker for documentation-only work.

## Decision Outcome

Chosen option: **"Range-bound docs-only local qualification"**, because
operational Markdown does not require a running application or database.

Only regular Markdown files under briefing, problems, retrospectives, and
review records qualify for the exception. Both sides of the complete outgoing
change are classified against the current remote main commit. A missing base,
non-ancestor base, empty range, file-type change, or any other path uses full
qualification. Decisions, package guides, website content, changesets,
dependencies, code, tests, and workflows stay outside the exception.

Docs-only evidence binds the clean unchanged tip to its checked base and remote.
The push hook rejects a different destination or base. Documentation checks
include whitespace and content-bound cognitive-review evidence for the whole
range. Full qualification retains the clean lockfile installation and complete
test suite. Exact-commit remote watching and release checks are unchanged.

## Consequences

### Good

- Eligible local documentation qualification needs neither Docker nor an install.
- Runtime and configuration changes cannot use the documentation exception.
- A remote-base change invalidates reduced-scope evidence.

### Neutral

- GitHub still runs its existing full Quality workflow, including container work.
- The route implementation itself requires full qualification.

### Bad

- A small path classifier and base-bound evidence format require maintenance.
- Some Markdown changes still need the full suite because they affect generated
  or published software boundaries.

## Confirmation

- Real documentation pushes demonstrate that the exception checks the complete
  outgoing range without local Docker, then passes exact-commit remote Quality.
- Real mixed or executable changes retain full qualification.
- Tests demonstrate that stale bases, wrong destinations, symlinks, and missing
  cognitive-review evidence do not authorize the reduced route.

No production-use confirmation has been recorded at capture.

## Pros and Cons of the Options

### Range-Bound Docs-Only Local Qualification

- Good: removes the observed local Docker dependency for operational prose.
- Bad: introduces a classifier whose conservative boundary must remain tested.

### Always Run Full Local Qualification

- Good: has one qualification contract and no path classifier.
- Bad: blocks operational documentation on unrelated runtime dependencies.

## Reassessment Criteria

Reassess if an eligible document becomes a runtime or release input, a change
escapes classification, or the exception fails to reduce contributor friction.
