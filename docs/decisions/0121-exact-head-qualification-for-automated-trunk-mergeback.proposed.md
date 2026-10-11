---
status: "proposed"
date: 2026-10-11
human-oversight: unconfirmed
supersedes: ["ADR-0100"]
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
reassessment-date: 2027-01-11
---

# Exact-Head Qualification for Automated Trunk Mergeback

## Context and Problem Statement

Ordinary maintainer pushes to `main` use `npm run push:watch`, which pushes an
exact commit and watches its Quality run. Release mergeback is the only
automated push to `main`, but GitHub's automation token does not start the
push-triggered Quality workflow. Treating that push as permanently exempt left
the current trunk commit without exact-head evidence after a real release.

## Decision Drivers

- Preserve the governed `push:watch` path for ordinary maintainer pushes.
- Permit only the release mergeback actor to write to `main` automatically.
- Give the automated write an equally strong exact-head qualification path.
- Prevent unrelated SHA activity from cancelling or satisfying its evidence.
- Keep run discovery and failure handling fail-closed.

## Considered Options

1. **Explicit exact-head qualification for mergeback**: the Publish workflow
   dispatches and watches full Quality for the exact automated trunk commit.
2. **Keep the automated-write exemption**: leave mergeback unwatched and rely
   on the next maintainer push.
3. **Route mergeback through the maintainer push command**: require a local
   checkout and maintainer process to complete release reconciliation.

## Decision Outcome

Chosen option: **"Explicit exact-head qualification for mergeback"**, because
an automated trunk write should produce current evidence rather than defer its
first verification to unrelated future work.

Ordinary maintainer pushes continue to use `npm run push:watch`. The command
keeps its repository, clean-checkout, non-force, exact-SHA, ancestry, workflow
identity, rerun, timeout, and failure checks.

The release mergeback remains the only automated write to `main`. It does not
use `push:watch`, because the write happens inside Publish. Instead, Publish
records the pre-merge trunk SHA, performs the checked merge, dispatches full
Quality for the resulting exact SHA, uniquely correlates the new run with a
random invocation value in its visible identity, and waits for success. It also
requires every full Quality job in the selected attempt to complete
successfully. A branch or ref name alone can neither select nor satisfy the run.

Quality uses ref-scoped cancellation for ordinary pull-request and maintainer
push activity. A dispatched mergeback run instead uses its expected exact SHA
as the concurrency identity, so a later trunk SHA cannot cancel it.

## Consequences

### Good

- Every authorized path that changes `main` now produces exact-head Quality
  evidence.
- Existing maintainer push behavior and checks remain unchanged.
- A later `main` push cannot hide or cancel mergeback qualification.

### Neutral

- Two mechanisms start Quality: normal push events and a narrowly bound
  mergeback dispatch.
- The push watcher still watches only workflows caused by its own trunk push.

### Bad

- The mergeback path needs separate behavioral tests for dispatch correlation
  and parent binding.
- A failed mergeback Quality run leaves a real commit on `main` that must be
  repaired rather than rolled back casually.

## Confirmation

- `npm run push:watch` still performs a non-force push of committed `HEAD` and
  watches exact-SHA Quality evidence for ordinary maintainer work.
- Release mergeback is the only automated actor permitted to write `main`.
- The mergeback path verifies both parents before dispatch.
- The newly dispatched run is selected by workflow identity, event type,
  exact SHA, unique invocation correlation value, and an ID absent from the
  pre-dispatch snapshot.
- More than one new matching run is rejected as ambiguous.
- A concurrent run for the same commit but a different correlation value is
  ignored and cannot satisfy qualification.
- Missing, skipped, duplicate, incomplete, timed-out, cancelled, or failed
  full Quality jobs fail the mergeback job.
- Dispatch Quality concurrency is keyed by exact SHA.
- Behavioral tests cover exact selection, ambiguity, transient reads, timeout,
  cancellation, failure, parent mismatch, and successful completion.
- Successful actual production use and Tom Howard's explicit ratification are
  recorded before this decision is accepted.

## Pros and Cons of the Options

### Explicit Exact-Head Qualification for Mergeback

- Good: gives automated and maintainer trunk writes equivalent evidence.
- Bad: adds a second, tightly scoped Quality trigger path.

### Keep the Automated-Write Exemption

- Good: adds no release latency.
- Bad: preserves an observed unqualified-trunk state.

### Route Mergeback Through the Maintainer Push Command

- Good: uses one start-and-watch mechanism.
- Bad: makes release completion depend on a local maintainer process and loses
  the existing automatic reconciliation boundary.

## Reassessment Criteria

Revisit if GitHub changes automation-token workflow triggering, if the project
removes automated mergeback, or if all trunk changes move behind one protected
merge queue with exact-head workflow evidence.
