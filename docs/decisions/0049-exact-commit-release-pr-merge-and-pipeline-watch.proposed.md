---
status: "proposed"
date: 2026-09-04
human-oversight: pending
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-04
---

# Exact-Commit Release PR Merge and Pipeline Watch

> Captured via /wr-architect:capture-adr. Section content was derived from the
> release-control decision in this task. Human oversight remains pending
> until the decision-maker ratifies the substance.

## Context and Problem Statement

Em See Pea uses Changesets to prepare a version pull request, then publishes
only after the resulting trunk commit passes exact-commit qualification. The
governance hook rejects a direct `gh pr merge` because it separates the merge
from observation of the Quality and Release workflows. ADR-0044 covers direct
trunk pushes, but not selection and merging of the Changesets release pull
request.

## Decision Drivers

- Preserve trunk-based delivery while keeping the generated version commit.
- Bind the selected pull request to its exact base and head revisions.
- Reject missing, ambiguous, stale, or changed release pull requests.
- Watch Quality and Release for the exact merge commit, not the newest run.
- Fail when either workflow is missing, cancelled, timed out, or unsuccessful.
- Reuse Node built-ins, Git, GitHub CLI, and the existing workflow watcher.

## Considered Options

1. **Exact-commit release pull request merge and watch (chosen)**: add one
   command that validates and merges the sole Changesets pull request, then
   watches both workflows for the resulting merge commit.
2. **Direct merge followed by manual inspection**: merge with GitHub CLI and
   inspect Actions separately.
3. **Merge and watch the newest trunk runs**: automate the merge but select
   workflow runs by recency instead of exact commit identity.

## Decision Outcome

Chosen option: **"Exact-commit release pull request merge and watch"**, because
the release state change and its fail-closed evidence must be one reproducible
operation.

`npm run release:watch` validates the `emseepea/emseepea` origin and a clean
local `main`, finds exactly one open `changeset-release/main` pull request that
targets `main`, and requires its base revision to equal local `HEAD`. It captures
the pull request head revision and merges with GitHub's merge-commit strategy
using exact-head matching. It then resolves the merge commit and watches every
Quality and Release run selected by workflow identity and that exact revision.

This command does not weaken or replace any workflow check. npm publication is
still controlled by the Release workflow after exact-merge qualification.

## Consequences

### Good

- A successful command binds pull request selection, merge, and pipeline
  evidence to exact revisions.
- Stale pull requests and unrelated workflow runs cannot appear successful.
- Maintainers have one governed command for the complete release transition.

### Neutral

- Changesets continues to own version and changelog generation.
- The helper depends on local Git and an authenticated GitHub CLI.

### Bad

- The command waits for both workflows, including credentialed semantic checks
  and registry verification when publication occurs.
- A GitHub or registry delay keeps the local command running longer.

## Confirmation

- `npm run release:watch` rejects a repository other than
  `emseepea/emseepea`, a dirty checkout, or a branch other than `main`.
- It requires exactly one open `changeset-release/main` pull request targeting
  `main`, with a base revision equal to local `HEAD`.
- The merge command includes the captured pull request head revision and uses
  merge-commit semantics.
- The merged pull request supplies one exact merge commit revision.
- Quality and Release runs are selected by workflow identity and that exact
  merge commit, and every matching attempt must succeed.
- Missing, timed-out, cancelled, or failed workflows produce a nonzero exit.
- Behavioral tests cover identity validation, exact pull request selection,
  exact-head merge binding, exact-SHA workflow selection, and failure
  propagation.

## Pros and Cons of the Options

### Exact-commit release pull request merge and watch

- Good, because it couples the release mutation to exact evidence.
- Bad, because it adds a small repository-owned delivery helper.

### Direct merge followed by manual inspection

- Good, because it adds no repository code.
- Bad, because it can separate the merged revision from the inspected runs and
  is rejected by the active governance hook.

### Merge and watch the newest trunk runs

- Good, because selecting runs by recency is simpler.
- Bad, because an older or unrelated run can be mistaken for release evidence.

## Reassessment Criteria

Reassess if GitHub provides one native command that selects an exact pull
request head, merges it, and watches all required workflows for the exact merge
commit; Changesets stops preparing version pull requests; the repository stops
using merge commits for release pull requests; or Quality and Release become one
exact-commit workflow.
