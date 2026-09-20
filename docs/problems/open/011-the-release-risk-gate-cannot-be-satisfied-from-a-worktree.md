# Problem 011: The Release Risk Gate Cannot Be Satisfied From a Worktree

**Status**: Open
**Reported**: 2026-09-20
**Priority**: 12 (High) — Impact: 3 × Likelihood: 4 — it blocks releasing rather than breaking anything released, but it fires every time work is done in a worktree, which is how this project is worked
**Origin**: internal
**Effort**: S (small) — one assertion in this repository's own release script; the plugin needs no change
**Jobs To Be Done (JTBD)**: JTBD-101 — a job to be done: publish installable packages safely
**Persona**: framework-maintainer

## Description

Two controls disagree about which checkout a release runs from, and no checkout
satisfies both.

The release script requires the checkout to be on `main`:

```
assert.equal(await run("git", ["branch", "--show-current"]), "main",
  "release checkout is not on main");
```

The risk gate requires the checkout to be the one the risk assessment was made
in. It identifies a checkout by hashing the device and inode of its Git
toplevel. Which directory that is gets fixed before the check runs:
`_enter_hook_cwd` reads the `cwd` field out of the hook payload — the session's
directory — and moves the hook there. The command string is never read, which is
exactly why a leading `cd` cannot change the answer.

Work in this project happens in a worktree, and a worktree cannot be on `main`
while the primary checkout has `main` checked out. So the assessment binds to
the worktree and the release must run from the primary, and there is no
arrangement that satisfies both.

The gate's own advice does not resolve it. It says to retry the command with a
leading `cd` to the assessed checkout. That cannot work: the hook does not see
the command's working directory, and the assessed checkout is the one that
fails the `main` assertion anyway. Moving the session to the primary checkout
was also refused, because a session running in a worktree cannot be moved.

On 2026-09-20 this blocked a release that had already been assessed at 5 out of
25, within appetite, with the gate's own message saying not to rescore. The
release was run from the maintainer's terminal instead, which is outside the
gate entirely — so the effect of the deadlock is that the gate gets bypassed
rather than satisfied.

Two things should be said about that rather than left implied. The risk policy
authorises exactly two ways past a gate, a risk-reducing marker and an
incident-release marker, and this was neither. And the binding check is not a
technicality standing in the way of an established fact: it exists to establish
that the score describes the tree being released. A score bound to a different
checkout is not weak evidence that the released tree was assessed — it is the
absence of that evidence. Treating the verdict as portable between checkouts is
the one thing the check declines to grant.

## Symptoms

- `npm run release:watch` prefixed with a `cd` into the primary checkout is
  refused with "this event resolved to a different Git checkout than the valid
  risk assessment". The leading `cd` changes nothing, because the hook reads the
  session's directory from its payload rather than the command.
- The same command without that prefix is refused by the release script with
  "release checkout is not on main".
- Re-scoring does not help: the marker binds to the session's checkout, which
  never changes.
- The remediation the refusal recommends cannot be carried out.

## Workaround

Run the release from a session whose own directory is the primary checkout, so
the assessment and the release land in the same place. That is the only
workaround that keeps the gate satisfied.

Running it in a terminal works because a terminal is not gated. That is not a
sanctioned option — it is outside both authorised bypass paths, and anyone who
does it is releasing without the gate, not around a technicality. If it is done,
say so plainly and record it.

## Impact Assessment

- **Who is affected**: anyone releasing while working in a worktree.
- **Frequency**: every release attempted that way.
- **Severity**: nothing incorrect was published. That is narrower than it
  sounds: Problem 010 records that the same release left three packages briefly
  unable to resolve their own runtime dependency, so "nothing released is wrong"
  is about content, not about the release going smoothly. The cost here is that
  a control meant to gate releases ends up being worked around, which is worse
  than it blocking cleanly, because the bypass becomes the habit. A second cost is that
  the weaker check does not catch a stale checkout: on this release the primary
  checkout was several commits behind, passed the branch-name check, and was
  caught a moment later by the base-commit comparison and fast-forwarded by
  hand. It was stopped, but not by the check that names it.
- **Analytics**: observed 2026-09-20 on a release assessed within appetite.

## Root Cause Analysis

The gate binds to a checkout identity that the session fixes, while the release
requires a checkout identity that the branch layout fixes, and the two cannot be
made equal. Neither control is unreasonable on its own.

But only one of them needs to change, and it is this project's own. The branch
check at line 34 of `scripts/release-and-watch.mjs` asserts the checkout's
branch is named `main`. Eleven lines later the same function asserts the thing that
actually matters: that the open release pull request's base commit equals local
`HEAD`. That second check is what stops a release being built against the wrong commit.
The branch name adds little on top of it — not nothing: it also excludes a
detached HEAD, and a feature branch that happens to sit on the same commit as
the release pull request's base. Whether either is worth keeping is part of the
decision below.

It is also weaker than it looks in one direction. A checkout can be on `main`
and several commits stale, pass the name check, and only fail later at the base
comparison. That happened during the 2026-09-20 release: the primary checkout
sat five commits behind and had to be fast-forwarded by hand first.

Asserting that `HEAD` equals the trunk tip would be a better check than the name
on its own terms, and it dissolves the deadlock as a side effect: a worktree
sitting exactly on the tip could then release, and the risk assessment would
bind to that same worktree. The new assertion has to fetch first. `origin/main`
is a local remote-tracking ref and this script never updates it before the
checks run, so comparing against it unchanged would be as stale as the branch
name it replaces.

### Investigation Tasks

- [ ] Replace the branch-name assertion with one that `HEAD` equals the trunk
  tip, fetching first — an unfetched remote-tracking ref can be exactly as stale
  as the branch name was, so asserting against it unchanged would reproduce the
  defect being fixed — and cover it with a test.
- [ ] Report the unfollowable remediation advice upstream: the hook cannot see a
  leading `cd`, so recommending one cannot work. This is worth doing even though
  the deadlock is fixable here, because the advice misleads on its own.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: Problem 002 (Release Readiness Verifier Only Tests
  Fixture-Like Stable PASS Marker). The shared shape is narrow and worth stating
  exactly: in 002 a review gate exists to reword a file that another gate
  requires exact literals in, and here one gate fixes the checkout by session
  while another fixes it by branch. Both are pairs of individually reasonable
  controls whose requirements cannot both be met at once.

## Related

- `scripts/release-and-watch.mjs` holds the `main` assertion.
- `tests/docs/release-and-watch.test.mjs` pins the current behaviour with a
  `not on main` case, so replacing the assertion means replacing that case, not
  only adding one.
- The risk gate lives in the installed `wr-risk-scorer` plugin (verified against
  version 0.19.5), in `hooks/lib/gate-helpers.sh` (`_enter_hook_cwd`,
  `_checkout_id`, `_checkout_matches`) and `hooks/lib/risk-gate.sh`. The refusal
  text quoted above comes from `hooks/git-push-gate.sh`; the general path words
  it differently, from `hooks/lib/risk-gate.sh`. Both advise the same leading
  `cd`. The gate needs no change for the deadlock; only that advice is worth
  reporting. **Upstream report pending** -- external dependency identified;
  invoke /wr-itil:report-upstream when ready.
- Captured at the maintainer's direction after the deadlock blocked a release.
