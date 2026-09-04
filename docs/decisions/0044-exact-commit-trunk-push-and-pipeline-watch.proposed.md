---
status: "proposed"
date: 2026-09-04
human-oversight: confirmed
oversight-date: 2026-09-04
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-04
---

# Exact-Commit Trunk Push and Pipeline Watch

> Captured via /wr-architect:capture-adr (foreground-lightweight aside-invocation per ADR-032, derived-substance amendment 2026-07-06 / RFC-045). Section content was derived by the capturing agent from the in-session decision context; human-oversight: unconfirmed until ratified at the /wr-architect:review-decisions drain.

## Context and Problem Statement

Em See Pea uses trunk-based development and requires a governed push command.
The active governance hook requires `npm run push:watch`, but the repository
does not provide that command. A bare push is therefore rejected while the
required replacement cannot run. The command must prove that both Quality and
Release completed for the exact commit that was pushed.

## Decision Drivers

- Preserve trunk-based delivery to `emseepea/emseepea` `main`.
- Bind pipeline evidence to the exact pushed commit.
- Never report an older or partial workflow run as current evidence.
- Preserve both Quality and Release without weakening their checks.
- Fail clearly when GitHub does not create or complete the expected runs.

## Considered Options

1. **Exact-commit push and watch command (chosen)** - Add one command that pushes committed `HEAD`, verifies the remote target, and watches both workflows for that SHA.
2. **Bare Git push followed by manual inspection** - Keep push and verification as separate, error-prone actions.
3. **Watch the newest branch run** - Select recent runs by branch without proving that they belong to the pushed commit.

## Decision Outcome

Chosen option: **"Exact-commit push and watch command"**, because the push and
its evidence must be one fail-closed operation. The command non-force pushes
the current committed `HEAD` to `emseepea/emseepea` `main`, checks that remote
`main` equals the captured local SHA, discovers Quality and Release by workflow
identity and exact SHA, and watches every matching run to completion.

## Consequences

### Good

- A successful command proves both workflows completed for the pushed commit.
- Stale runs cannot produce a false-green result.
- The required governance path exists in the repository and is reproducible.

### Neutral

- The command waits for the slower of Quality and Release.
- Reruns for the same commit are all part of the evidence set.

### Bad

- Registry or GitHub Actions delays make the local command wait longer.
- A missing or manually cancelled workflow makes the command fail even when the push itself succeeded.

## Confirmation

- `npm run push:watch` performs a non-force push of committed `HEAD` to `origin/main`.
- The command rejects a repository other than `emseepea/emseepea`.
- The remote `main` SHA must equal the captured local SHA after the push.
- Quality and Release runs are selected by workflow identity and exact SHA.
- Every matching rerun is watched and must succeed.
- Missing, timed-out, cancelled, or failed runs return a nonzero status.
- Behavioral tests prove exact-SHA selection, rerun handling, and failure propagation.

## Pros and Cons of the Options

### Exact-commit push and watch command

- Good: Couples the state change to complete evidence for the same revision.
- Bad: Adds a small repository-owned delivery helper that depends on Git and GitHub CLI.

### Bare Git push followed by manual inspection

- Good: Adds no repository code.
- Bad: Conflicts with the active hook and can separate the pushed revision from the inspected runs.

### Watch the newest branch run

- Good: Requires simpler run discovery.
- Bad: Can select a stale run or ignore a rerun for the same commit.

## Reassessment Criteria

Revisit this decision if GitHub provides one native command that pushes and
waits for all workflows for an exact SHA, the repository stops using direct
trunk delivery, or Quality and Release are replaced by one exact-commit
workflow.

## Related Decisions

- [Em See Pea GitHub organisation ownership](0041-em-see-pea-github-organisation-ownership.proposed.md)
- [single full initializer qualification per continuous integration event](0043-single-full-initializer-qualification-per-ci-event.proposed.md)
