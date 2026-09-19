# Problem 005: Branch Push Is Ungated, So Untested Changes Reach Continuous Integration (CI)

**Status**: Open
**Reported**: 2026-09-20
**Priority**: 15 (High) — Impact: 3 × Likelihood: 5 — see the rating note below
**Effort**: S (small) — one hook that blocks an operation until a marker exists
**JTBD**: JTBD-101 — publish installable packages safely
**Persona**: framework-maintainer

## Description

A branch was pushed and a pull request opened without running the full test
suite. CI then reported twelve failures — both Node quality jobs and all ten
standalone initializer jobs — every one of which was reproducible locally
beforehand.

Run before pushing:

- the black-box suite
- lint
- a typecheck scoped to a single package

Not run: `npm test`. It adds:

- the decisions check
- the build
- a repository-wide typecheck
- the example tests
- the `tests/docs` suite
- the `tests/llm` suite

Two tests in `tests/docs` fail on the change: the packed-getting-started test
and the packed-initializer standalone test. Those are the same failures CI
reported.

### Why the gap was easy to fall into

The worktree's `node_modules` was a week stale against the lockfile, because
nobody re-ran the install after a 169-commit rebase.

An earlier local run reported two kinds of failure. It reported four typecheck
errors. It also reported two packed-package failures. The author judged both
kinds to be a pre-existing condition of the environment, and did not investigate
either.

Running `npm ci` separated them. The typecheck errors disappeared, so they were
install staleness. The packed-package failures remained, so they were real and
caused by the change.

A stale install made a real failure look like ambient noise.

## Rating note

Likelihood is 5 because all three Likelihood 5 conditions in `RISK-POLICY.md`
apply at once: a known gap, an absent control, and a failure mode that has
already been observed.

Impact is 3 because no adopter-facing path was affected. The gate held and
nothing shipped. The cost is a CI cycle, plus a pull request whose verification
claim named only the suites that were run.

## Symptoms

CI reports failures that a full local run would have caught first. The pull
request carries a verification claim naming only the suites that were actually
run, which reads as complete without saying what was skipped.

## Workaround

Run `npm test` before every push. Re-run `npm ci` after any rebase that moves the
lockfile.

## Impact Assessment

- **Who is affected**: maintainers and reviewers, who spend a CI cycle
  discovering what a local run would have shown immediately.
- **Frequency**: (deferred to investigation)
- **Severity**: no adopter-facing effect. See the rating note above.
- **Analytics**: (deferred to investigation)

## Root Cause Analysis

This repository already blocks risky operations until a marker file exists for
them. Three gates use that pattern today: architecture review, external
communications review, and commit risk scoring. Push has no equivalent gate.

An exact-commit push command does exist, `npm run push:watch`. It pushes and then
watches the pipeline, failing closed. But it pushes to `main`, so it does not
cover a feature branch. No git hooks are installed either: `.git/hooks` holds
only the samples git ships, and there is no husky configuration. A plain
`git push` of a branch is therefore entirely ungated.

Any such gate must bind to the exact commit rather than to the session. A
session-scoped marker would have authorised this push, because the tests that
passed ran against a different tree than the one pushed: the rebase moved the
branch 169 commits forward in between.

### Investigation Tasks

- [ ] Investigate root cause
- [ ] Create reproduction test
- [ ] Decide the gate's scope: every push, or only pushes touching `packages/`
      and `tests/`. The full suite takes over ten minutes, and the packed
      initializer test alone takes about six.
- [ ] Decide whether a stale-install check belongs in the same gate, since the
      stale install is what disguised the real failure

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

Sibling of the release-readiness verifier ticket. Both sit in the same
release-confidence area, but they name different gaps: that one is about a
verifier that only tests a fixture-like stable pass marker, this one is about no
gate existing at the push boundary at all.

Captured via /wr-itil:capture-problem; expand at next investigation.
