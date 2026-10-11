---
status: "proposed"
date: 2026-09-21
human-oversight: confirmed
oversight-date: 2026-09-21
supersedes: ["ADR-0044"]
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-21
---

# Trunk Push and Watch Under a Publish Branch

This is one of three prerequisite supersessions ADR-0098 commits to, which that
record requires because a ratified decision is superseded rather than amended.
The decision below is its own, and Tom Howard ratified it on 2026-09-21 after
reading it.

## Context and Problem Statement

ADR-0044 made one command responsible for pushing committed `HEAD` to the trunk
and proving that Quality and Release both completed for that exact commit. Two
of its assumptions stop holding under ADR-0098.

The Release workflow is retired, so a command that waits for it waits forever:
`watchWorkflowRuns` in `scripts/push-and-watch.mjs` iterates
`["quality.yml", "release.yml"]` and fails closed when a watched run never
appears. Once the Release workflow is retired that will break every ordinary
push to the trunk, not only releases.

And the trunk now receives a push from automation. The merge back at ADR-0098's
step 4 is performed by a workflow, which ADR-0044's model of a person pushing
their local `HEAD` does not contemplate.

## Decision Drivers

- Keep the fail-closed property: a push is not done until its evidence is.
- Keep exact-SHA selection. Watching the newest run on a branch was rejected by
  ADR-0044 and is still wrong.
- Admit an automated actor without admitting an unwatched push.

## Considered Options

1. **Keep the watched set as a list, guarded by a drift test**, and allow a
   named automated actor.
2. **Derive the watched set at push time** from the workflow files in the
   checkout.
3. **Stop watching on push** and rely on branch protection.

### Pros and Cons of the Options

**Option 1 — a list guarded by a drift test**

- Good: the list stays explicit and readable, and it can name a workflow that
  runs because another one finished. A rule that reads trigger configuration
  cannot, unless it also follows those chains.
- Good: fail-closed behaviour and exact-SHA selection are untouched.
- Good: the failure this record exists to fix was a list nobody updated. A test
  that fails when the list and the workflow set disagree addresses that
  directly, and it fails in the test suite rather than an hour into a push.
- Bad: the test has to know which workflows a push to `main` causes to run, so
  the reasoning the other option would do at push time still has to exist
  somewhere — it just runs where a wrong answer is cheap.
- Bad: admitting an automated actor widens who can write to the trunk, and one
  push is now unwatched by construction.

**Option 2 — derive the set at push time**

- Good: nothing to maintain, and the set cannot name a workflow that no longer
  exists.
- Bad: it has to follow `workflow_run` chains as well as direct push triggers.
  A rule matching only push triggers would derive `quality.yml` alone and
  silently drop `release.yml`, which runs on Quality completing — so the watch
  would shrink without failing. A check that narrows without saying so is the
  failure mode this batch of records exists to avoid.
- Bad: interpreting trigger configuration is more code than a list, and it is
  wrong in the direction of passing.

**Option 3 — stop watching on push**

- Good: no watched set to maintain, and no timeout to wait out.
- Bad: branch protection proves a commit was allowed, not that its checks
  passed. The push would report success before its evidence existed, which is
  the failure ADR-0044 was written to prevent.

## Decision Outcome

Chosen option: **keep the watched set as a list guarded by a drift test, and
allow a named automated actor**, because what broke was a list nobody updated,
and a test that catches that is smaller and more honest than a rule that infers
the set and can infer it short.

`npm run push:watch` continues to perform a non-force push of committed `HEAD`
to `origin/main`, to reject a repository other than `emseepea/emseepea`, and to
require that remote `main` equal the captured local SHA afterwards. It discovers
runs by workflow identity and exact SHA and watches every match to completion.
What changes is that the list is no longer allowed to rot. It names the
workflows a push to `main` causes to run — directly, or because another workflow
completing starts them — and a test fails when the list and the workflow files
disagree. Under this shape that list is `quality.yml` alone: the workflows that
publish are started by dispatch and by a push to `publish`, neither of which is
a push to the trunk.

This record governs pushes to `main` only. The `publish` branch receives commits
by merge, and ADR-0098 governs who may perform that merge and what follows it.

The merge back may push to `main` from automation. That push is exempt from the
watch, because it deliberately starts no quality run — ADR-0098 records why, and
records the cost. No other automated path to the trunk is opened.

## Consequences

### Good

- Ordinary trunk pushes keep working when the workflow set changes.
- The fail-closed property and exact-SHA selection are unchanged.

### Bad

- One push to the trunk is now unwatched by construction, and nothing checks the
  merged trunk until the next ordinary push.
- The trunk's protection must admit an automated actor, which widens who can
  write to it.
- **The merge back can race a developer's push.** The command requires remote
  `main` to equal the captured local SHA after pushing. If a merge back lands in
  that window, it no longer does, and a push that succeeded is reported as
  failed. The post-condition has to tolerate the trunk advancing past the pushed
  commit while still rejecting a trunk that does not contain it.

### Neutral

- The push command's remote, force and repository checks are unchanged.

## Confirmation

- `npm run push:watch` performs a non-force push of committed `HEAD` to
  `origin/main`.
- The command rejects a repository other than `emseepea/emseepea`.
- After the push, remote `main` contains the captured local SHA. A merge back
  landing in that window advances the trunk without failing the command.
- Runs are selected by workflow identity and exact SHA, never by branch
  recency.
- The watched list names every workflow a push to `main` causes to run, whether
  triggered directly or by another workflow completing, and an ordinary push
  completes its watch.
- A test fails when the watched list and the workflow files disagree.
- Every matching rerun is watched and must succeed.
- Missing, timed-out, cancelled, or failed runs return a nonzero status.
- The merge back is the only automated push to `main`, and branch protection
  admits no other automated actor.
- Behavioral tests prove exact-SHA selection, rerun handling, and failure
  propagation.

## Reassessment Criteria

Revisit:

- If the unwatched merge back lets a broken trunk go unnoticed long enough to
  matter.
- If the automated actor is used for anything but the merge back.
- If the drift test proves unable to tell which workflows a push causes to run,
  or if the list changes often enough that maintaining both it and the test
  costs more than inferring the set would.

## Related

- Supersedes ADR-0044, whose watched set names a retired workflow and whose
  model has no automated actor.
- ADR-0098 is the release shape that makes this supersession necessary, and
  records why the merge back starts no quality run.
