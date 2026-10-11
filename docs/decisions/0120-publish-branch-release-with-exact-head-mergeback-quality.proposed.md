---
status: "proposed"
date: 2026-10-11
human-oversight: unconfirmed
supersedes: ["ADR-0098"]
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
reassessment-date: 2027-01-11
---

# Publish Branch Release with Exact-Head Mergeback Quality

## Context and Problem Statement

The publish-branch release flow promotes already measured packages and then
merges the publish head back into `main`. That merge uses GitHub's automation
token. GitHub does not start a push-triggered workflow for a push made with
that token, so the new merge commit on `main` receives no Quality run.

This happened after a successful release. The released bytes were qualified,
but the new trunk commit that reconciled `publish` and `main` was not. A later
developer push could only find an older failed Quality run, leaving the current
trunk without exact-commit evidence.

## Decision Drivers

- Keep the published package bytes bound to the measured release candidate.
- Qualify every resulting `main` commit by its exact SHA.
- Do not let mergeback qualification create another release candidate.
- Fail the Publish workflow when qualification evidence is missing or fails.
- Keep additional write authority limited to the job that performs mergeback.

## Considered Options

1. **Publish branch release with exact-head mergeback Quality**: keep the
   existing publish and promotion shape, then dispatch full Quality for the
   exact mergeback commit and wait for success.
2. **Leave mergeback unqualified**: accept that the next ordinary developer
   push is the first check of the reconciled trunk.
3. **Use a separate reduced mergeback check**: run only merge or documentation
   checks after reconciliation.

## Decision Outcome

Chosen option: **"Publish branch release with exact-head mergeback Quality"**,
because it closes the observed evidence gap without rebuilding or republishing
the released artifacts.

The release remains a publish-branch flow. Quality on `main` creates and stages
the release candidate. Merging that candidate into `publish` promotes the exact
staged bytes, deploys the measured website when required, and creates release
records. Only after those operations succeed does the Publish workflow merge
the publish head back into `main`.

The mergeback job records the current `main` SHA before merging. After the
non-fast-forward merge succeeds, it verifies that the new remote `main` commit
has that recorded SHA as its first parent and the released publish head as its
second parent. It then creates a unique random correlation value and dispatches
the existing full Quality workflow for the exact mergeback SHA with the three
SHAs and that correlation value as explicit inputs. The correlation value is
part of the run's visible identity.

Dispatch acceptance and overall workflow success are not qualification. The
Publish workflow snapshots existing runs before dispatch, identifies exactly
one newly created `workflow_dispatch` run with the mergeback SHA and unique
correlation value, and waits for it to finish successfully. It then reads every
page of jobs for the selected attempt and requires one completed successful
instance of every full Quality job. Missing, ambiguous, skipped, incomplete,
timed-out, cancelled, or failed evidence fails Publish.

The dispatched Quality run has no release authority. It cannot open or update
a release pull request, publish under `next`, deploy the website, or dispatch a
release build. Its concurrency identity is the exact mergeback SHA, so Quality
for a different `main` SHA cannot cancel it.

## Consequences

### Good

- Every mergeback commit on `main` receives exact-SHA full Quality evidence.
- The released tarballs and website remain the previously measured artifacts.
- A failed reconciliation check is visible in the same Publish workflow that
  created the mergeback commit.
- The repair uses the existing Quality workflow instead of a smaller substitute.

### Neutral

- Publish remains active until the dispatched Quality run completes.
- A release produces one additional full Quality run after promotion.

### Bad

- A release can be publicly promoted before mergeback Quality later fails.
  The failure cannot undo publication, but it blocks a successful Publish result
  and makes trunk repair the next work item.
- The mergeback job needs narrowly scoped `actions: write` permission in
  addition to its existing `contents: write` permission.
- The Publish workflow can run for as long as the full Quality workflow.

## Confirmation

- A successful release promotes the previously staged artifacts and does not
  rebuild or republish them during mergeback qualification.
- The mergeback commit has the recorded pre-merge `main` SHA as first parent
  and the released publish SHA as second parent.
- Publish dispatches Quality with the exact mergeback, base, and publish SHAs.
- Quality independently validates its event, SHA inputs, and parent relation.
- Every full Quality job runs for the dispatched mergeback commit, regardless
  of documentation-only classification.
- The dispatched run cannot create or publish another release candidate.
- Publish identifies exactly one newly dispatched run and waits for successful
  completion.
- Publish binds the selected run to a unique invocation correlation value and
  cannot accept a concurrent run for the same commit.
- Publish verifies one completed successful instance of every full Quality job.
- Missing, ambiguous, skipped, incomplete, timed-out, cancelled, or failed
  Quality evidence fails Publish.
- A different SHA cannot cancel the mergeback SHA's Quality run.
- Successful actual production use and Tom Howard's explicit ratification are
  recorded before this decision is accepted.

## Pros and Cons of the Options

### Publish Branch Release with Exact-Head Mergeback Quality

- Good: preserves artifact provenance and closes the exact-trunk evidence gap.
- Bad: extends the Publish workflow and adds one narrow dispatch permission.

### Leave Mergeback Unqualified

- Good: keeps the shortest release path.
- Bad: preserves the observed red or missing current-trunk evidence problem.

### Use a Separate Reduced Mergeback Check

- Good: finishes faster than full Quality.
- Bad: creates a weaker definition of a qualified trunk commit.

## Reassessment Criteria

Revisit if GitHub begins triggering trusted push workflows from the mergeback
token, if full post-promotion Quality repeatedly exceeds operational time
budgets, or if release promotion and trunk reconciliation move into one
exact-commit workflow.
