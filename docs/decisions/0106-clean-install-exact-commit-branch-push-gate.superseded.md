---
status: "proposed"
date: 2026-09-24
human-oversight: confirmed
oversight-date: 2026-09-24
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
reassessment-date: 2026-12-24
---

# Clean-Install Exact-Commit Branch Push Gate

## Context and Problem Statement

A feature branch was pushed before the full repository test suite ran. Continuous
integration then reported twelve failures that the developer could reproduce
locally. The failures came from lockfile drift: the committed dependency
lockfile no longer matched the expected install state. A stale local
installation made that cause harder to see.

The repository already has a command for `main` that pushes one exact commit and
then watches the remote checks. A plain branch `git push` does not have the same
local check before it sends commits. This decision defines three things: what
local evidence is required before a branch push, how that evidence is tied to
the exact commit being pushed, and whether the dependency install must be rerun
before testing.

## Decision Drivers

- Reject a push before remote continuous integration receives a revision whose
  full deterministic repository checks have not passed.
- Bind evidence to every exact outgoing branch tip so a commit or rebase
  invalidates earlier evidence.
- Establish dependencies from the committed lockfile before testing, so stale
  installed packages cannot mask or misattribute failures.
- Cover repository-wide coupling across packages, tests, examples,
  documentation, decisions, workflows, and the root lockfile.
- Reuse the existing `npm test` contract and native Git boundary without adding
  a task runner, hook framework, or path classifier.
- Keep deletion-only pushes possible because they introduce no new remote
  revision to qualify.

## Considered Options

1. **Full exact-commit gate** - Run the existing `npm test` contract and bind
   its pass marker to every outgoing branch tip, while leaving `npm ci` as a
   documented post-rebase prerequisite.
2. **Clean-install exact-commit gate** - Run `npm ci` and then `npm test`, verify
   the checkout did not change, and bind the pass marker to every outgoing
   branch tip.
3. **Path-scoped exact-commit gate** - Require exact-commit evidence only when a
   maintained path classifier says a change can affect packages or tests.
4. **Continue relying on remote continuous integration** - Permit branch pushes
   without local qualification and let the remote pipeline find failures.

## Decision Outcome

Chosen option: **"Clean-install exact-commit gate"**, because it closes both
parts of the observed failure: the absent push-boundary control and the stale
dependency state that disguised the reproducible failure.

Every branch push that sends a commit must start from a clean committed checkout.
In this decision, that means Git has no uncommitted file changes before the check
starts. The qualification command runs `npm ci` and then the existing `npm test`.
After the tests pass, it confirms that `HEAD` still points to the same commit and
the checkout is still clean. It then writes a pass marker: a local record that
names the qualified commit SHA. A SHA is Git's unique commit identifier. The
repository-owned `pre-push` hook accepts the push only when each pushed branch
tip has a matching pass marker. A branch tip is the commit that the branch
currently points to. A new commit or rebase changes the branch tip, so it
automatically invalidates earlier evidence.

The hook and its installation path are repository-owned. They add no Husky or
other dependency, no path classifier, and no second test contract. The existing
`npm run push:watch` remains the separate `main` push-and-remote-evidence
operation governed by the trunk push decision.

## Consequences

### Good

- Remote continuous integration receives branch revisions only after the full
  deterministic local suite passes for the exact pushed tip.
- A clean lockfile installation makes the local evidence independent of stale
  `node_modules` state.
- Rebases and new commits fail closed without marker cleanup logic.
- Repository-wide changes stay covered without a fallible path classifier.
- The treatment reuses npm scripts and native Git, adding no dependency.

### Neutral

- Deletion-only pushes bypass qualification because they send no new commit.
- Remote continuous integration and release verification remain authoritative
  for their own environments and published artifacts; local qualification does
  not replace them.
- `npm run push:watch` continues to govern pushes to `main` and may compose with
  the same local qualification evidence.

### Bad

- `npm ci` plus the full repository suite adds installation and test latency
  before every newly qualified branch tip can be pushed.
- Qualification needs network and registry availability even when the working
  dependencies already appear current.
- A repository-owned Git hook needs an explicit, verified installation path.
  Cloning the repository does not install Git hooks automatically.
- `git push --no-verify` remains a Git-provided escape hatch. Use of that option
  is outside the normal governed workflow and leaves no local qualification
  claim.

## Confirmation

- A behavioural test proves a branch push that sends a commit is rejected when
  no pass marker matches the branch commit being pushed.
- A behavioural test proves a marker for an earlier commit is rejected after a
  commit or rebase changes the branch commit being pushed.
- A behavioural test proves multiple pushed branches must each carry matching
  evidence and deletion-only ref updates do not require it.
- The qualification command runs `npm ci` before `npm test`, stops on either
  failure, and writes no marker on failure.
- The qualification command records the commit SHA, Git's commit identifier,
  only after confirming `HEAD` is unchanged and the checkout is clean.
- The installed `pre-push` hook uses the repository-owned tracked implementation
  and fails closed when it cannot read or validate evidence for the exact
  commit.
- Installation is verified in a fresh clone or worktree, and documentation uses
  the repository's npm-script command contract.
- The standing risk remains above the accepted risk level until two things are
  true: behavioural checks pass, and a real push has demonstrated that the gate
  works. Only after that evidence exists may the risk record reduce the control
  gap and the remaining likelihood.

## Pros and Cons of the Options

### Full Exact-Commit Gate

- Good: reuses `npm test` with the least added runtime work.
- Good: exact-SHA evidence rejects stale markers after commits and rebases.
- Bad: stale installed dependencies can still mask or confuse the failure the
  gate is meant to prevent.
- Bad: correctness depends on a documented prerequisite that the gate cannot
  prove was followed.

### Clean-Install Exact-Commit Gate

- Good: proves tests ran from the committed dependency graph before authorizing
  the exact outgoing tip.
- Good: addresses the observed absent control and stale-install ambiguity at one
  shared push boundary.
- Bad: every newly qualified tip pays clean-install and full-suite latency.
- Bad: transient registry or network failure blocks qualification.

### Path-Scoped Exact-Commit Gate

- Good: avoids the full cost for changes classified as unrelated.
- Bad: adds base resolution and a maintained classifier.
- Bad: can miss coupling through the lockfile, decisions, documentation,
  examples, workflows, or root configuration.

### Continue Relying on Remote Continuous Integration

- Good: adds no local mechanism or latency.
- Bad: preserves the documented failure mode and spends remote capacity and review
  time finding locally reproducible failures.
- Bad: permits incomplete verification claims at the branch-push boundary.

## Reassessment Criteria

Reassess if measured qualification latency materially disrupts contributor flow,
if `npm ci` can no longer reproduce the supported dependency state, if Git gains
a repository-distributed hook mechanism that removes installation setup, or if
evidence shows the full repository suite no longer represents the deterministic
checks required before a branch push.

## Related

- [Problem 005: Branch Push Is Ungated, So Untested Changes Reach Continuous Integration](../problems/open/005-branch-push-is-ungated-so-untested-changes-reach-ci.md)
- [Risk R015: Untested Branch Pushes Consume Continuous Integration (CI) and Weaken Verification Claims](../risks/R015-untested-branch-pushes-consume-ci-and-weaken-verification-claims.active.md)
- [ADR-0076: npm Scripts as the User-Facing Command Contract](0076-npm-scripts-as-the-user-facing-command-contract.proposed.md)
- [ADR-0100: Trunk Push and Watch Under a Publish Branch](0100-trunk-push-and-watch-under-a-publish-branch.proposed.md)
- [JTBD-101: Publish Installable Packages Safely](../jtbd/framework-maintainer/JTBD-101-publish-installable-packages-safely.proposed.md)
